#!/usr/bin/env node

/**
 * 🏥 Self-Health-Check - 主健康检查脚本
 *
 * 用法:
 *   node health-check.js              # 快速检查
 *   node health-check.js --full       # 完整检查
 *   node health-check.js --notify     # 发送通知
 *   node health-check.js --dry-run    # 试运行（不写入日志）
 */

const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

// 加载 .env
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// 检查模块
const checks = {
  config: require('./checks/config'),
  syntax: require('./checks/syntax'),
  dependencies: require('./checks/dependencies'),
  logs: require('./checks/logs'),
  git: require('./checks/git')
};

const logger = require('./lib/logger');
const notifier = require('./lib/notifier');

// 配置
const CONFIG = {
  clawdRoot: path.join(__dirname, '../../'),
  healthLog: process.env.HEALTH_CHECK_LOG_FILE || '/tmp/clawdbot/health-check.log',
  notionDbId: process.env.HEALTH_CHECK_NOTION_DB_ID,
  telegramGroup: process.env.HEALTH_CHECK_TELEGRAM_GROUP || 'discussion',
  alertOnly: process.env.HEALTH_CHECK_ALERT_ONLY !== 'false'
};

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    full: args.includes('--full'),
    notify: args.includes('--notify'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };
}

/**
 * 执行单个检查
 */
async function runCheck(checkName, checkFn, options = {}) {
  const startTime = Date.now();
  try {
    const result = await checkFn(CONFIG.clawdRoot, options);
    const duration = Date.now() - startTime;

    return {
      name: checkName,
      status: result.status || 'unknown',
      duration,
      ...result
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      name: checkName,
      status: 'error',
      duration,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * 生成健康检查摘要
 */
function generateSummary(results) {
  const total = results.length;
  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errors = results.filter(r => r.status === 'error').length;

  const overallStatus = errors > 0 || failed > 0 ? 'fail' : warnings > 0 ? 'warning' : 'pass';

  return {
    total,
    passed,
    warnings,
    failed,
    errors,
    overallStatus,
    timestamp: new Date().toISOString()
  };
}

/**
 * 格式化结果为文本
 */
function formatResults(results, summary) {
  const lines = [];

  // 标题
  const statusEmoji = {
    pass: '✅',
    warning: '⚠️',
    fail: '❌',
    error: '💥',
    unknown: '❓'
  };

  lines.push('🏥 Clawdbot Health Check Report');
  lines.push(`📅 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  lines.push(`📊 Overall Status: ${statusEmoji[summary.overallStatus]} ${summary.overallStatus.toUpperCase()}`);
  lines.push('');

  // 摘要
  lines.push('## Summary');
  lines.push(`Total Checks: ${summary.total}`);
  lines.push(`✅ Passed: ${summary.passed}`);
  lines.push(`⚠️  Warnings: ${summary.warnings}`);
  lines.push(`❌ Failed: ${summary.failed}`);
  lines.push(`💥 Errors: ${summary.errors}`);
  lines.push('');

  // 详细结果
  lines.push('## Details');
  for (const result of results) {
    const emoji = statusEmoji[result.status] || statusEmoji.unknown;
    lines.push(`${emoji} ${result.name} [${result.duration}ms]`);

    if (result.message) {
      lines.push(`   ${result.message}`);
    }

    if (result.details && result.details.length > 0) {
      for (const detail of result.details) {
        const detailEmoji = detail.status === 'pass' ? '✓' : '✗';
        lines.push(`   ${detailEmoji} ${detail.message}`);
      }
    }

    if (result.error) {
      lines.push(`   Error: ${result.error}`);
    }

    if (result.fix && result.fix.length > 0) {
      lines.push(`   💡 Suggested fix:`);
      for (const fix of result.fix) {
        lines.push(`      - ${fix}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();

  console.log('🏥 Starting Clawdbot Health Check...');
  console.log(`   Mode: ${options.full ? 'Full' : 'Quick'}`);
  console.log(`   Notify: ${options.notify ? 'Yes' : 'No'}`);
  console.log('');

  const results = [];

  // 基础检查（始终执行）
  const basicChecks = [
    { name: 'Config Check', fn: checks.config.run },
    { name: 'Syntax Check', fn: checks.syntax.run },
    { name: 'Dependencies Check', fn: checks.dependencies.run }
  ];

  // 完整检查
  const fullChecks = [
    ...basicChecks,
    { name: 'Logs Analysis', fn: checks.logs.run },
    { name: 'Git Status', fn: checks.git.run }
  ];

  const checksToRun = options.full ? fullChecks : basicChecks;

  // 执行检查
  for (const check of checksToRun) {
    const result = await runCheck(check.name, check.fn, { full: options.full });
    results.push(result);

    // 实时输出
    const statusEmoji = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`${statusEmoji} ${result.name} [${result.duration}ms]`);
    if (result.message) {
      console.log(`   ${result.message}`);
    }
  }

  const summary = generateSummary(results);
  const reportText = formatResults(results, summary);

  console.log('');
  console.log('## Summary');
  console.log(`Overall: ${summary.overallStatus.toUpperCase()}`);
  console.log(`Passed: ${summary.passed}/${summary.total}`);

  // 写入日志
  if (!options.dryRun) {
    await logger.append(CONFIG.healthLog, reportText);
    console.log(`📝 Log saved to: ${CONFIG.healthLog}`);
  }

  // 发送通知
  if (options.notify) {
    // 检查是否仅在有问题时发送通知
    const shouldNotify = !CONFIG.alertOnly || summary.overallStatus !== 'pass';

    if (shouldNotify) {
      console.log('📤 Sending notifications...');
      await notifier.send(CONFIG, {
        summary,
        results,
        reportText
      });
    } else {
      console.log('✓ All checks passed, skipping notification (alert-only mode)');
    }
  }

  // 返回退出码
  const exitCode = summary.overallStatus === 'pass' ? 0 : 1;
  console.log('');
  console.log(`Exit code: ${exitCode}`);

  process.exit(exitCode);
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});

// 运行
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
