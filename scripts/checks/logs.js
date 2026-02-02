/**
 * 📋 日志分析检查
 * 分析最近的日志文件，检测错误模式
 */

const fs = require('fs').promises;
const path = require('path');
const { existsSync } = require('fs');

// Clawdbot 日志目录
const LOG_DIR = '/tmp/clawdbot';
const LOG_FILE_PATTERN = /clawdbot-\d{4}-\d{2}-\d{2}\.log$/;

// 需要关注的错误模式
const ERROR_PATTERNS = [
  { pattern: /Error:/i, category: 'General Error' },
  { pattern: /Fatal error:/i, category: 'Fatal Error' },
  { pattern: /SyntaxError:/i, category: 'Syntax Error' },
  { pattern: /Cannot find module/i, category: 'Module Not Found' },
  { pattern: /EACCES|permission denied/i, category: 'Permission Error' },
  { pattern: /ENOENT.*no such file/i, category: 'File Not Found' },
  { pattern: /validation_error/i, category: 'Validation Error' },
  { pattern: /object_not_found/i, category: 'Notion Object Not Found' },
  { pattern: /telegram.*not found|Bad Request/i, category: 'Telegram Error' },
  { pattern: /dotenv.*injecting env/i, category: 'Dotenv Warning' },
  { pattern: /MODULE_NOT_FOUND/i, category: 'Module Not Found' }
];

// 需要特别关注的路径问题
const PATH_PATTERNS = [
  { pattern: /skills\/skills\//, message: 'Duplicate "skills" in path' },
  { pattern: /undefined.*(?:url|id|database)/i, message: 'Undefined critical value' }
];

/**
 * 解析日志文件
 */
async function parseLogFile(logPath) {
  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n');

    const errors = [];
    const warnings = [];
    const errorsByCategory = {};

    for (const line of lines) {
      // 检查错误模式
      for (const { pattern, category } of ERROR_PATTERNS) {
        if (pattern.test(line)) {
          if (!errorsByCategory[category]) {
            errorsByCategory[category] = [];
          }

          // 提取有用信息
          let message = line.trim();

          // 提取时间戳
          const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2})/);
          const timestamp = timeMatch ? timeMatch[1] : '';

          // 提取错误消息
          const errorMatch = line.match(/Error: (.+?)(?:\n|$)/);
          if (errorMatch) {
            message = errorMatch[1];
          }

          errorsByCategory[category].push({
            timestamp,
            message: message.substring(0, 200), // 限制长度
            fullLine: line.substring(0, 500)
          });

          errors.push({ category, timestamp, message });
          break;
        }
      }

      // 检查路径问题
      for (const { pattern, message } of PATH_PATTERNS) {
        if (pattern.test(line)) {
          warnings.push({
            type: 'path_issue',
            message,
            line: line.trim()
          });
        }
      }
    }

    return { errors, warnings, errorsByCategory };
  } catch (error) {
    return { errors: [], warnings: [], parseError: error.message };
  }
}

/**
 * 获取最新的日志文件
 */
async function getLatestLogFile() {
  try {
    const files = await fs.readdir(LOG_DIR);
    const logFiles = files
      .filter(f => LOG_FILE_PATTERN.test(f))
      .map(f => ({
        name: f,
        path: path.join(LOG_DIR, f),
        time: f.match(/clawdbot-(.+)\.log/)?.[1]
      }))
      .sort((a, b) => b.time.localeCompare(a.time));

    return logFiles[0]?.path;
  } catch {
    return null;
  }
}

/**
 * 运行日志分析
 */
async function run(clawdRoot, options = {}) {
  const details = [];
  const fixes = [];

  const logPath = await getLatestLogFile();

  if (!logPath) {
    return {
      status: 'warning',
      message: 'No log files found',
      details: [{ status: 'warning', message: `Log directory not found or empty: ${LOG_DIR}` }],
      fix: ['Ensure Clawdbot has run at least once', 'Check log directory permissions']
    };
  }

  details.push({ status: 'pass', message: `Analyzing log: ${path.basename(logPath)}` });

  const { errors, warnings, errorsByCategory, parseError } = await parseLogFile(logPath);

  if (parseError) {
    return {
      status: 'error',
      message: 'Failed to parse log file',
      details: [{ status: 'error', message: parseError }]
    };
  }

  // 统计错误
  const totalErrors = errors.length;
  const totalWarnings = warnings.length;
  const recentErrors = errors.filter(e => {
    // 简单判断最近1小时的错误
    if (!e.timestamp) return true;
    return true; // 日志可能跨天，暂时都算
  });

  details.push({ status: 'info', message: `Found ${totalErrors} errors, ${totalWarnings} warnings` });

  // 按类别汇总
  for (const [category, categoryErrors] of Object.entries(errorsByCategory)) {
    if (categoryErrors.length > 0) {
      const status = categoryErrors.length > 10 ? 'fail' : categoryErrors.length > 3 ? 'warning' : 'pass';
      details.push({
        status,
        message: `${category}: ${categoryErrors.length} occurrence(s)`
      });

      // 添加最近的错误示例
      const recentExample = categoryErrors[categoryErrors.length - 1];
      if (recentExample) {
        details.push({
          status: 'info',
          message: `  Latest: ${recentExample.message.substring(0, 80)}...`
        });
      }

      // 根据错误类型提供建议
      if (category === 'Module Not Found' && categoryErrors.length > 0) {
        fixes.push('Run npm install in affected skill directories');
      }
      if (category === 'Syntax Error') {
        fixes.push('Fix JavaScript syntax errors in affected files');
      }
      if (category === 'Notion Object Not Found') {
        fixes.push('Check Notion database IDs and integration permissions');
      }
      if (category === 'Telegram Error') {
        fixes.push('Check TELEGRAM_BOT_TOKEN and group chat IDs');
      }
    }
  }

  // 检查路径问题
  for (const warning of warnings) {
    details.push({ status: 'warning', message: `Path issue: ${warning.message}` });
    if (warning.type === 'path_issue' && warning.message.includes('Duplicate')) {
      fixes.push('Fix duplicate "skills" directory in skill paths');
    }
  }

  // 特别检查最近的错误率
  const last100Lines = await getLastNLines(logPath, 100);
  const recentErrorCount = last100Lines.filter(line =>
    ERROR_PATTERNS.some(({ pattern }) => pattern.test(line))
  ).length;

  if (recentErrorCount > 20) {
    details.push({ status: 'fail', message: `High error rate: ${recentErrorCount}% in recent logs` });
  }

  // 确定状态
  let status = 'pass';
  if (totalErrors > 50 || recentErrorCount > 20) {
    status = 'fail';
  } else if (totalErrors > 10 || recentErrorCount > 5) {
    status = 'warning';
  }

  return {
    status,
    message: `Log analysis: ${totalErrors} errors found, ${recentErrorCount}% recent error rate`,
    details,
    fix: fixes.length > 0 ? fixes : undefined
  };
}

/**
 * 获取日志文件的最后 N 行
 */
async function getLastNLines(logPath, n) {
  try {
    const content = await fs.readFile(logPath, 'utf-8');
    return content.split('\n').slice(-n);
  } catch {
    return [];
  }
}

module.exports = { run };
