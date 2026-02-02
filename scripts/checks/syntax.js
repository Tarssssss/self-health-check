/**
 * 📝 JavaScript 语法检查
 * 检查关键脚本是否有语法错误
 */

const fs = require('fs').promises;
const path = require('path');
const { existsSync } = require('fs');

// 需要检查的关键文件
const CRITICAL_FILES = [
  'scripts/notion-heartbeat.js',
  'skills/notion-persistence-universal/scripts/save-content.js',
  'skills/telegram-notification/scripts/notify-group.js',
  'skills/event-coordinator/scripts/coordinate.js'
];

// 需要检查的目录模式
const CHECK_PATTERNS = [
  'skills/*/scripts/*.js',
  'scripts/*.js'
];

/**
 * 使用 Node.js 检查单个文件的语法
 */
async function checkFileSyntax(filePath) {
  return new Promise((resolve) => {
    const proc = spawn('node', ['--check', filePath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ status: 'pass', message: path.basename(filePath) });
      } else {
        // 解析错误信息
        const errorMatch = stderr.match(/(\w+\.js):(\d+)/);
        const location = errorMatch ? `${errorMatch[1]}:${errorMatch[2]}` : filePath;

        resolve({
          status: 'fail',
          message: `${location}: ${stderr.split('\n').find(l => l.includes('Error'))?.trim() || 'Syntax error'}`,
          error: stderr.trim()
        });
      }
    });

    proc.on('error', (err) => {
      resolve({ status: 'error', message: `Failed to check ${filePath}: ${err.message}` });
    });
  });
}

/**
 * 查找匹配模式的文件
 */
async function findFilesByPattern(rootDir, pattern) {
  const { glob } = require('glob');
  return new Promise((resolve, reject) => {
    glob(pattern, { cwd: rootDir, absolute: true }, (err, files) => {
      if (err) reject(err);
      else resolve(files);
    });
  });
}

/**
 * 运行语法检查
 */
async function run(clawdRoot) {
  const details = [];
  const errors = [];
  const fixes = [];
  let checked = 0;
  let passed = 0;
  let failed = 0;

  // 检查关键文件
  for (const relativePath of CRITICAL_FILES) {
    const fullPath = path.join(clawdRoot, relativePath);

    if (!existsSync(fullPath)) {
      details.push({ status: 'warning', message: `${relativePath} not found` });
      continue;
    }

    checked++;
    const result = await checkFileSyntax(fullPath);

    if (result.status === 'pass') {
      passed++;
      details.push({ status: 'pass', message: `${relativePath}: OK` });
    } else {
      failed++;
      details.push({ status: 'fail', message: result.message });
      errors.push(result.message);
      fixes.push(`Fix syntax error in ${relativePath}`);

      // 尝试提取更多有用的信息
      if (result.error) {
        const lineMatch = result.error.match(/(\d+)$/);
        if (lineMatch) {
          fixes.push(`Check line ${lineMatch[1]} in ${relativePath}`);
        }
      }
    }
  }

  // 扫描其他 JS 文件（在完整模式下）
  try {
    const { glob } = require('glob');
    const allJsFiles = await glob('skills/*/scripts/*.js', {
      cwd: clawdRoot,
      absolute: true
    });

    // 只检查还没有检查过的文件
    const additionalFiles = allJsFiles.filter(
      file => !CRITICAL_FILES.some(critical => file.endsWith(critical))
    );

    for (const file of additionalFiles.slice(0, 20)) { // 限制检查数量
      const result = await checkFileSyntax(file);
      checked++;
      if (result.status === 'pass') {
        passed++;
      } else {
        failed++;
        details.push({ status: 'fail', message: result.message });
        errors.push(result.message);
      }
    }
  } catch (globError) {
    // glob 不可用时跳过
  }

  // 确定状态
  let status = 'pass';
  if (failed > 0) {
    status = 'fail';
  } else if (checked === 0) {
    status = 'warning';
  }

  return {
    status,
    message: `Syntax check: ${passed}/${checked} files passed`,
    details,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    fix: fixes
  };
}

module.exports = { run };
