/**
 * 📦 依赖检查
 * 检查 npm 依赖是否正确安装
 */

const fs = require('fs').promises;
const path = require('path');
const { existsSync } = require('fs');

/**
 * 检查单个 package.json
 */
async function checkPackageJson(pkgPath) {
  try {
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);

    const nodeModulesDir = path.join(path.dirname(pkgPath), 'node_modules');

    // 检查 node_modules 是否存在
    const nodeModulesExists = existsSync(nodeModulesDir);

    const dependencies = Object.keys(pkg.dependencies || {});
    const devDependencies = Object.keys(pkg.devDependencies || {});

    // 抽样检查一些关键依赖
    const criticalDeps = ['dotenv', '@notionhq/client', 'node-telegram-bot-api'].filter(dep =>
      dependencies.includes(dep) || devDependencies.includes(dep)
    );

    const missingCritical = [];
    for (const dep of criticalDeps) {
      const depPath = path.join(nodeModulesDir, dep);
      if (!existsSync(depPath)) {
        missingCritical.push(dep);
      }
    }

    const details = [
      { status: 'pass', message: `${dependencies.length} dependencies defined` },
      { status: nodeModulesExists ? 'pass' : 'fail', message: `node_modules ${nodeModulesExists ? 'exists' : 'missing'}` }
    ];

    if (criticalDeps.length > 0) {
      details.push({ status: 'pass', message: `Critical deps: ${criticalDeps.join(', ')}` });
    }

    if (missingCritical.length > 0) {
      details.push({ status: 'fail', message: `Missing critical deps: ${missingCritical.join(', ')}` });
    }

    return {
      status: missingCritical.length > 0 ? 'fail' : 'pass',
      details,
      fix: missingCritical.length > 0 ? [`Run: npm install in ${path.dirname(pkgPath)}`] : []
    };

  } catch (error) {
    return {
      status: 'error',
      details: [{ status: 'error', message: `Failed to check ${pkgPath}: ${error.message}` }]
    };
  }
}

/**
 * 运行依赖检查
 */
async function run(clawdRoot) {
  const details = [];
  const fixes = [];
  let checked = 0;
  let passed = 0;
  let failed = 0;

  // 检查根 package.json
  const rootPkg = path.join(clawdRoot, 'package.json');
  if (existsSync(rootPkg)) {
    checked++;
    const result = await checkPackageJson(rootPkg);
    details.push({ status: 'pass', message: 'Root package.json OK' });
    details.push(...result.details);

    if (result.status === 'pass') {
      passed++;
    } else {
      failed++;
      fixes.push(...result.fix);
    }
  }

  // 检查 skills 中的依赖
  const skillsDir = path.join(clawdRoot, 'skills');
  try {
    const skills = await fs.readdir(skillsDir);

    for (const skill of skills) {
      const skillPkg = path.join(skillsDir, skill, 'package.json');

      if (existsSync(skillPkg)) {
        checked++;
        const result = await checkPackageJson(skillPkg);

        const statusMsg = result.status === 'pass' ? 'OK' : 'Issues found';
        details.push({ status: result.status, message: `${skill}/package.json: ${statusMsg}` });

        if (result.status === 'pass') {
          passed++;
        } else {
          failed++;
          details.push(...result.details);
          fixes.push(...result.fix.map(f => `${f} (skill: ${skill})`));
        }
      }
    }

    // 检查是否有 node_modules 在 .git 中（不应该）
    const { spawn } = require('child_process');
    try {
      const gitCheck = spawn('git', ['ls-files', 'node_modules/', '*/*/node_modules/'], {
        cwd: clawdRoot,
        stdio: ['ignore', 'pipe', 'ignore']
      });

      const trackedModules = await new Promise((resolve) => {
        let output = '';
        gitCheck.stdout.on('data', (data) => { output += data.toString(); });
        gitCheck.on('close', () => resolve(output.trim().split('\n').filter(Boolean)));
      });

      if (trackedModules.length > 0) {
        details.push({ status: 'warning', message: `node_modules files tracked in git: ${trackedModules.length}` });
        fixes.push('Add node_modules/ to .gitignore and remove from git: git rm -r --cached node_modules/');
      }

    } catch {
      // git 命令失败，跳过
    }

  } catch (error) {
    details.push({ status: 'warning', message: `Could not check skills: ${error.message}` });
  }

  // 确定状态
  const status = failed > 0 ? 'fail' : checked === 0 ? 'warning' : 'pass';

  return {
    status,
    message: `Dependencies: ${passed}/${checked} package.json checks passed`,
    details,
    fix: fixes
  };
}

module.exports = { run };
