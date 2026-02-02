/**
 * 📤 通知发送工具
 * 将健康检查结果发送到 Telegram 或 Notion
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * 发送 Telegram 通知
 */
async function sendTelegram(config, report) {
  const { summary, results, reportText } = report;

  // 构建消息
  const statusEmoji = {
    pass: '✅',
    warning: '⚠️',
    fail: '❌'
  };

  const title = `${statusEmoji[summary.overallStatus]} Health Check: ${summary.overallStatus.toUpperCase()}`;
  const summaryText = `Passed: ${summary.passed}/${summary.total} | Warnings: ${summary.warnings} | Failed: ${summary.failed}`;

  let message = `*${title}*\n\n`;
  message += `${summaryText}\n\n`;

  // 添加失败的检查详情
  const failedChecks = results.filter(r => r.status === 'fail' || r.status === 'error');
  if (failedChecks.length > 0) {
    message += '*Issues Found:*\n';
    for (const check of failedChecks) {
      message += `• ${check.name}\n`;
      if (check.message) {
        message += `  ${check.message.substring(0, 100)}...\n`;
      }
    }
    message += '\n';
  }

  // 添加警告
  const warnings = results.filter(r => r.status === 'warning');
  if (warnings.length > 0) {
    message += '*Warnings:*\n';
    for (const check of warnings) {
      message += `• ${check.name}: ${check.message || ''}\n`;
    }
  }

  // 截断消息（Telegram 限制 4096 字符）
  if (message.length > 3000) {
    message = message.substring(0, 3000) + '...\n\n(Full report in logs)';
  }

  // 调用 telegram-notification skill
  const notifyScript = path.join(config.clawdRoot, 'skills/telegram-notification/scripts/notify-group.js');

  return new Promise((resolve) => {
    const args = [
      '--target', config.telegramGroup,
      '--title', title,
      '--summary', summaryText
    ];

    const proc = spawn('node', [notifyScript, ...args], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('✓ Telegram notification sent');
        resolve({ success: true, output: stdout });
      } else {
        console.error('✗ Telegram notification failed:', stderr);
        resolve({ success: false, error: stderr });
      }
    });

    proc.on('error', (err) => {
      console.error('✗ Failed to send notification:', err.message);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * 发送到 Notion
 */
async function sendNotion(config, report) {
  const { summary, reportText } = report;

  if (!config.notionDbId) {
    console.log('⚠ No Notion DB configured, skipping');
    return { success: false, error: 'No Notion DB ID' };
  }

  // 构建页面数据
  const title = `Health Check ${new Date().toISOString().split('T')[0]}`;

  // 构建内容
  const content = `## Summary\n\n` +
    `- Status: ${summary.overallStatus}\n` +
    `- Passed: ${summary.passed}\n` +
    `- Warnings: ${summary.warnings}\n` +
    `- Failed: ${summary.failed}\n` +
    `- Errors: ${summary.errors}\n\n` +
    `## Full Report\n\n` +
    reportText;

  // 调用 notion-persistence-universal skill
  const saveScript = path.join(config.clawdRoot, 'skills/notion-persistence-universal/scripts/save-content.js');

  return new Promise((resolve) => {
    const args = [
      '--type', 'health_check',
      '--content', content
    ];

    const proc = spawn('node', [saveScript, ...args], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('✓ Notion page created');
        resolve({ success: true, output: stdout });
      } else {
        console.error('✗ Notion save failed:', stderr);
        resolve({ success: false, error: stderr });
      }
    });

    proc.on('error', (err) => {
      console.error('✗ Failed to save to Notion:', err.message);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * 发送通知（根据配置选择渠道）
 */
async function send(config, report) {
  const results = [];

  // 发送到 Telegram
  try {
    const telegramResult = await sendTelegram(config, report);
    results.push({ channel: 'telegram', ...telegramResult });
  } catch (error) {
    results.push({ channel: 'telegram', success: false, error: error.message });
  }

  // 发送到 Notion
  if (config.notionDbId) {
    try {
      const notionResult = await sendNotion(config, report);
      results.push({ channel: 'notion', ...notionResult });
    } catch (error) {
      results.push({ channel: 'notion', success: false, error: error.message });
    }
  }

  return results;
}

module.exports = { send };
