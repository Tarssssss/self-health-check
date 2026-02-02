/**
 * 📝 日志记录工具
 */

const fs = require('fs').promises;
const path = require('path');
const { existsSync } = require('fs');

/**
 * 确保日志目录存在
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // 目录可能已存在
  }
}

/**
 * 追加日志
 */
async function append(logPath, content) {
  await ensureDir(path.dirname(logPath));

  const timestamp = new Date().toISOString();
  const separator = '='.repeat(60);

  const logEntry = `${separator}\n📅 ${timestamp}\n${separator}\n${content}\n\n`;

  await fs.appendFile(logPath, logEntry);
}

/**
 * 写入新日志（覆盖）
 */
async function write(logPath, content) {
  await ensureDir(path.dirname(logPath));
  await fs.writeFile(logPath, content);
}

/**
 * 读取最近的日志条目
 */
async function readRecent(logPath, n = 5) {
  try {
    if (!existsSync(logPath)) {
      return [];
    }

    const content = await fs.readFile(logPath, 'utf-8');
    const entries = content.split(/={60}\n📅 \d{4}-\d{2}-\d{2}T/);

    return entries.slice(-n);
  } catch {
    return [];
  }
}

module.exports = {
  append,
  write,
  readRecent
};
