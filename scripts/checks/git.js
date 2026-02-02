/**
 * 🔄 Git 状态检查
 * 检查未提交的更改、潜在的 secret 泄露等
 */

const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

/**
 * 执行 git 命令
 */
function gitExec(cwd, ...args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `git ${args.join(' ')} failed`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * 检查文件是否包含疑似 secret 的内容
 */
const SECRET_PATTERNS = [
  { name: 'Notion API Token', pattern: /secret_[a-zA-Z0-9]{32,}/ },
  { name: 'Telegram Bot Token', pattern: /\d{8,}:[A-Za-z0-9_-]{35}/ },
  { name: 'API Key', pattern: /api[_-]?key["\']?\s*[:=]\s*["\']?[a-zA-Z0-9_-]{20,}/i },
  { name: 'Password', pattern: /password["\']?\s*[:=]\s*["\']?[^\s"']+["\']?/i },
  { name: 'Token', pattern: /token["\']?\s*[:=]\s*["\']?[a-zA-Z0-9_-]{20,}/i },
  { name: 'Bearer Token', pattern: /bearer\s+[a-zA-Z0-9_-]{20,}/i },
  { name: 'Base64 Secret', pattern: /["\'][A-Za-z0-9+/]{40,}={0,2}["\']/ }
];

/**
 * 检查单个文件是否包含 secret
 */
function checkFileForSecrets(content, filePath) {
  const findings = [];

  for (const { name, pattern } of SECRET_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      findings.push({
        type: name,
        match: matches[0].substring(0, 30) + '...'
      });
    }
  }

  // 排除常见误报
  const safePaths = ['.env.example', 'sample.env', '.env.template', 'test/fixtures'];
  if (safePaths.some(safe => filePath.includes(safe))) {
    return [];
  }

  return findings;
}

/**
 * 检查是否有未提交的更改包含 secrets
 */
async function checkUncommittedForSecrets(cwd) {
  const findings = [];

  try {
    // 获取未暂存的更改
    const changedFiles = (await gitExec(cwd, 'diff', '--name-only'))
      .split('\n')
      .filter(Boolean);

    // 获取已暂存的更改
    const stagedFiles = (await gitExec(cwd, 'diff', '--cached', '--name-only'))
      .split('\n')
      .filter(Boolean);

    const allChangedFiles = [...new Set([...changedFiles, ...stagedFiles])];

    for (const file of allChangedFiles) {
      // 只检查文本文件
      if (/\.(js|ts|json|md|env|txt|yml|yaml)$/.test(file)) {
        try {
          const diff = await gitExec(cwd, 'diff', file);
          const secretFindings = checkFileForSecrets(diff, file);

          for (const finding of secretFindings) {
            findings.push({
              file,
              type: finding.type,
              match: finding.match
            });
          }
        } catch {
          // 忽略单个文件的错误
        }
      }
    }

  } catch {
    // git diff 失败，跳过
  }

  return findings;
}

/**
 * 检查最近的提交是否有 secrets
 */
async function checkRecentCommitsForSecrets(cwd) {
  const findings = [];

  try {
    // 检查最近5次提交
    const commits = (await gitExec(cwd, 'log', '--oneline', '-5'))
      .split('\n')
      .filter(Boolean);

    for (const commit of commits) {
      const commitHash = commit.split(' ')[0];

      try {
        // 获取提交中更改的文件
        const files = (await gitExec(cwd, 'diff', '--name-only', `${commitHash}^..${commitHash}`))
          .split('\n')
          .filter(Boolean);

        for (const file of files) {
          if (/\.(js|ts|json|md|env|txt|yml|yaml)$/.test(file)) {
            try {
              const content = await gitExec(cwd, 'show', `${commitHash}:${file}`);
              const secretFindings = checkFileForSecrets(content, file);

              for (const finding of secretFindings) {
                findings.push({
                  commit: commitHash,
                  file,
                  type: finding.type,
                  match: finding.match
                });
              }
            } catch {
              // 文件可能已被删除
            }
          }
        }
      } catch {
        // 跳过此提交
      }
    }

  } catch {
    // git log 失败，跳过
  }

  return findings;
}

/**
 * 运行 Git 检查
 */
async function run(clawdRoot, options = {}) {
  const details = [];
  const fixes = [];
  let status = 'pass';

  // 检查是否在 git 仓库中
  const gitDir = path.join(clawdRoot, '.git');
  if (!existsSync(gitDir)) {
    return {
      status: 'warning',
      message: 'Not a git repository',
      details: [{ status: 'warning', message: '.git directory not found' }],
      fix: ['Initialize git repo: git init']
    };
  }

  details.push({ status: 'pass', message: 'Git repository detected' });

  // 检查未提交的更改
  try {
    const statusOutput = await gitExec(clawdRoot, 'status', '--porcelain');

    if (statusOutput) {
      const changedFiles = statusOutput.split('\n').filter(Boolean);
      details.push({
        status: 'info',
        message: `${changedFiles.length} uncommitted file(s)`
      });

      // 检查是否有 .env 文件未提交（不应该提交）
      const envFiles = changedFiles.filter(f => f.includes('.env') && !f.includes('.env.example'));
      if (envFiles.length > 0) {
        details.push({
          status: 'warning',
          message: `${envFiles.length} .env file(s) in changes`
        });
      }
    } else {
      details.push({ status: 'pass', message: 'Working directory clean' });
    }
  } catch (error) {
    details.push({ status: 'warning', message: `Could not check git status: ${error.message}` });
  }

  // 检查未提交更改中的 secrets
  try {
    const uncommittedSecrets = await checkUncommittedForSecrets(clawdRoot);

    if (uncommittedSecrets.length > 0) {
      status = 'fail';
      details.push({
        status: 'fail',
        message: `Found ${uncommittedSecrets.length} potential secret(s) in uncommitted changes`
      });

      for (const secret of uncommittedSecrets.slice(0, 5)) {
        details.push({
          status: 'fail',
          message: `  ${secret.file}: ${secret.type} detected`
        });
      }

      fixes.push('Remove secrets from uncommitted changes before committing');
      fixes.push('Use environment variables for sensitive data');
    }
  } catch (error) {
    details.push({
      status: 'warning',
      message: `Could not check for secrets in changes: ${error.message}`
    });
  }

  // 检查最近提交中的 secrets
  try {
    const commitSecrets = await checkRecentCommitsForSecrets(clawdRoot);

    if (commitSecrets.length > 0) {
      status = 'fail';
      details.push({
        status: 'fail',
        message: `Found ${commitSecrets.length} potential secret(s) in recent commits`
      });

      for (const secret of commitSecrets.slice(0, 3)) {
        details.push({
          status: 'fail',
          message: `  Commit ${secret.commit}: ${secret.file} contains ${secret.type}`
        });
      }

      fixes.push('Remove secrets from git history using git-filter-repo or BFG Repo-Cleaner');
      fixes.push('Rotate exposed secrets immediately');
    }
  } catch (error) {
    details.push({
      status: 'warning',
      message: `Could not check recent commits: ${error.message}`
    });
  }

  // 检查远程仓库状态
  try {
    const branches = await gitExec(clawdRoot, 'branch', '-vv');

    // 检查是否有未推送的提交
    const pushNeeded = branches.split('\n').filter(line =>
      line.includes('*') && line.includes('[') && !line.includes('[behind')
    );

    if (pushNeeded.length > 0) {
      details.push({
        status: 'info',
        message: 'Unpushed commits detected'
      });
    }
  } catch {
    // 跳过
  }

  return {
    status,
    message: 'Git status check completed',
    details,
    fix: fixes.length > 0 ? fixes : undefined
  };
}

module.exports = { run };
