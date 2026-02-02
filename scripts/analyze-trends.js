#!/usr/bin/env node

/**
 * 📈 Health Check 趋势分析工具
 *
 * 分析历史健康检查数据，生成趋势报告
 *
 * 用法:
 *   node analyze-trends.js                    # 分析最近 7 天
 *   node analyze-trends.js --days 30          # 分析最近 30 天
 *   node analyze-trends.js --output report.md # 输出到文件
 */

const fs = require('fs').promises;
const path = require('path');
const { existsSync } = require('fs');

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    days: 7,
    output: null,
    format: 'text' // text, json, markdown
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--days' && args[i + 1]) {
      options.days = parseInt(args[++i]);
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        options.format = args[++i];
      }
    } else if (arg === '--format' && args[i + 1]) {
      options.format = args[++i];
    }
  }

  return options;
}

/**
 * 解析健康检查日志条目
 */
function parseHealthCheckLog(content) {
  const entries = [];
  const rawEntries = content.split(/={60}\n📅 /);

  for (const entry of rawEntries) {
    if (!entry.trim()) continue;

    // 提取时间戳
    const timestampMatch = entry.match(/^([\d-]+T[\d:]+.[\d:]+)\n/);
    if (!timestampMatch) continue;

    const timestamp = new Date(timestampMatch[1]);

    // 提取摘要
    const summaryMatch = entry.match(/## Summary\n([\s\S]+?)##/);
    if (!summaryMatch) continue;

    const summaryLines = summaryMatch[1].trim().split('\n');
    const summary = {
      total: 0,
      passed: 0,
      warnings: 0,
      failed: 0,
      errors: 0,
      overallStatus: 'unknown'
    };

    for (const line of summaryLines) {
      const match = line.match(/(Total|Passed|Warnings|Failed|Errors|Overall):\s*(:?\d+|✅|⚠️|❌|💥|PASS|WARNING|FAIL|ERROR|UNKNOWN)/i);
      if (match) {
        const key = match[1].toLowerCase();
        const value = match[2];
        if (key === 'overall') {
          if (value.includes('✅') || value.includes('PASS')) summary.overallStatus = 'pass';
          else if (value.includes('⚠️') || value.includes('WARNING')) summary.overallStatus = 'warning';
          else if (value.includes('❌') || value.includes('FAIL')) summary.overallStatus = 'fail';
          else if (value.includes('💥') || value.includes('ERROR')) summary.overallStatus = 'error';
        } else {
          summary[key] = parseInt(value) || 0;
        }
      }
    }

    // 提取各项检查结果
    const checks = [];
    const detailsMatch = entry.match(/## Details\n([\s\S]+)$/);
    if (detailsMatch) {
      const checkLines = detailsMatch[1].split('\n');
      for (const line of checkLines) {
        const checkMatch = line.match(/([✅⚠️❌💥❓])\s+(.+?)\s+\[(\d+)ms\]/);
        if (checkMatch) {
          let status = 'unknown';
          const emoji = checkMatch[1];
          if (emoji === '✅') status = 'pass';
          else if (emoji === '⚠️') status = 'warning';
          else if (emoji === '❌') status = 'fail';
          else if (emoji === '💥') status = 'error';

          checks.push({
            name: checkMatch[2].trim(),
            status,
            duration: parseInt(checkMatch[3])
          });
        }
      }
    }

    entries.push({ timestamp, summary, checks });
  }

  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * 分析趋势
 */
function analyzeTrends(entries) {
  if (entries.length === 0) {
    return {
      totalChecks: 0,
      passRate: 0,
      avgDuration: 0,
      checkStats: {},
      dailyStats: [],
      issues: [],
      recommendations: []
    };
  }

  // 总体统计
  const totalChecks = entries.length;
  const passCount = entries.filter(e => e.summary.overallStatus === 'pass').length;
  const passRate = (passCount / totalChecks * 100).toFixed(1);

  // 平均执行时间
  const totalDuration = entries.reduce((sum, e) => {
    return sum + e.checks.reduce((s, c) => s + c.duration, 0);
  }, 0);
  const totalCheckCount = entries.reduce((sum, e) => sum + e.checks.length, 0);
  const avgDuration = Math.round(totalDuration / totalCheckCount);

  // 各项检查统计
  const checkStats = {};
  for (const entry of entries) {
    for (const check of entry.checks) {
      if (!checkStats[check.name]) {
        checkStats[check.name] = {
          total: 0,
          pass: 0,
          warning: 0,
          fail: 0,
          error: 0,
          passRate: 0
        };
      }
      checkStats[check.name].total++;
      checkStats[check.name][check.status]++;
    }
  }

  // 计算通过率
  for (const stat of Object.values(checkStats)) {
    stat.passRate = (stat.pass / stat.total * 100).toFixed(1);
  }

  // 按天统计
  const dailyMap = new Map();
  for (const entry of entries) {
    const dateKey = entry.timestamp.toISOString().split('T')[0];
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        date: dateKey,
        checks: 0,
        passed: 0,
        failed: 0
      });
    }
    const day = dailyMap.get(dateKey);
    day.checks++;
    if (entry.summary.overallStatus === 'pass') day.passed++;
    else day.failed++;
  }
  const dailyStats = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // 问题分析
  const issues = [];
  const recommendations = [];

  // 检查频繁失败的项目
  for (const [name, stat] of Object.entries(checkStats)) {
    if (stat.fail + stat.error > stat.pass && stat.total >= 3) {
      issues.push({
        severity: 'high',
        check: name,
        message: `Frequently failing: ${stat.fail + stat.error}/${stat.total} checks failed`,
        passRate: stat.passRate
      });
      recommendations.push(`Review and fix ${name} - only ${stat.passRate}% pass rate`);
    } else if (stat.passRate < 80) {
      issues.push({
        severity: 'medium',
        check: name,
        message: `Unreliable: ${stat.passRate}% pass rate`,
        passRate: stat.passRate
      });
    }
  }

  // 检查趋势
  if (dailyStats.length >= 3) {
    const recent = dailyStats.slice(-3);
    const recentPassRate = (recent.reduce((s, d) => s + d.passed, 0) / recent.reduce((s, d) => s + d.checks, 0) * 100).toFixed(1);

    const earlier = dailyStats.slice(0, -3);
    if (earlier.length > 0) {
      const earlierPassRate = (earlier.reduce((s, d) => s + d.passed, 0) / earlier.reduce((s, d) => s + d.checks, 0) * 100).toFixed(1);

      if (recentPassRate < earlierPassRate - 10) {
        issues.push({
          severity: 'high',
          check: 'Overall',
          message: `Declining health: Pass rate dropped from ${earlierPassRate}% to ${recentPassRate}%`
        });
        recommendations.push('Investigate recent configuration changes or system issues');
      } else if (recentPassRate > earlierPassRate + 10) {
        recommendations.push('Health improving! Keep up the good work.');
      }
    }
  }

  return {
    totalChecks,
    passRate,
    avgDuration,
    checkStats,
    dailyStats,
    issues,
    recommendations
  };
}

/**
 * 格式化为文本报告
 */
function formatTextReport(analysis, options) {
  const lines = [];

  lines.push('📈 Health Check Trend Analysis');
  lines.push('');
  lines.push(`Analysis Period: Last ${options.days} days`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // 总览
  lines.push('## Overview');
  lines.push(`Total Checks: ${analysis.totalChecks}`);
  lines.push(`Pass Rate: ${analysis.passRate}%`);
  lines.push(`Avg Duration: ${analysis.avgDuration}ms`);
  lines.push('');

  // 各项检查统计
  lines.push('## Check Statistics');
  lines.push('');

  for (const [name, stat] of Object.entries(analysis.checkStats)) {
    const status = stat.passRate >= 90 ? '✅' : stat.passRate >= 70 ? '⚠️' : '❌';
    lines.push(`${status} ${name}`);
    lines.push(`   Total: ${stat.total} | Pass: ${stat.pass} | Warning: ${stat.warning} | Fail: ${stat.fail} | Error: ${stat.error}`);
    lines.push(`   Pass Rate: ${stat.passRate}%`);
    lines.push('');
  }

  // 问题列表
  if (analysis.issues.length > 0) {
    lines.push('## Issues Detected');
    lines.push('');

    for (const issue of analysis.issues) {
      const severity = issue.severity === 'high' ? '🔴' : '🟡';
      lines.push(`${severity} ${issue.check}: ${issue.message}`);
    }
    lines.push('');
  }

  // 建议
  if (analysis.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');

    for (const rec of analysis.recommendations) {
      lines.push(`• ${rec}`);
    }
    lines.push('');
  }

  // 每日趋势
  if (analysis.dailyStats.length > 0) {
    lines.push('## Daily Trend');
    lines.push('');

    for (const day of analysis.dailyStats) {
      const passRate = (day.passed / day.checks * 100).toFixed(0);
      const bar = '█'.repeat(Math.floor(passRate / 5)) + '░'.repeat(20 - Math.floor(passRate / 5));
      lines.push(`${day.date}: ${bar} ${passRate}% (${day.passed}/${day.checks})`);
    }
  }

  return lines.join('\n');
}

/**
 * 格式化为 JSON
 */
function formatJsonReport(analysis) {
  return JSON.stringify(analysis, null, 2);
}

/**
 * 格式化为 Markdown
 */
function formatMarkdownReport(analysis, options) {
  let md = '# 📈 Health Check Trend Analysis\n\n';
  md += `**Analysis Period:** Last ${options.days} days  \n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;

  md += '## Overview\n\n';
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Checks | ${analysis.totalChecks} |\n`;
  md += `| Pass Rate | ${analysis.passRate}% |\n`;
  md += `| Avg Duration | ${analysis.avgDuration}ms |\n\n`;

  md += '## Check Statistics\n\n';
  md += `| Check | Total | Pass | Warning | Fail | Error | Pass Rate |\n`;
  md += `|-------|-------|-------|----------|-------|--------|----------|\n`;

  for (const [name, stat] of Object.entries(analysis.checkStats)) {
    md += `| ${name} | ${stat.total} | ${stat.pass} | ${stat.warning} | ${stat.fail} | ${stat.error} | ${stat.passRate}% |\n`;
  }
  md += '\n';

  if (analysis.issues.length > 0) {
    md += '## Issues Detected\n\n';
    for (const issue of analysis.issues) {
      const emoji = issue.severity === 'high' ? '🔴' : '🟡';
      md += `### ${emoji} ${issue.check}\n`;
      md += `${issue.message}\n\n`;
    }
  }

  if (analysis.recommendations.length > 0) {
    md += '## Recommendations\n\n';
    for (const rec of analysis.recommendations) {
      md += `- ${rec}\n`;
    }
    md += '\n';
  }

  return md;
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();

  // 日志文件路径
  const logPath = process.env.HEALTH_CHECK_LOG_FILE || '/tmp/clawdbot/health-check.log';

  // 检查日志文件是否存在
  if (!existsSync(logPath)) {
    console.error(`Log file not found: ${logPath}`);
    console.error('Run a health check first to generate log data.');
    process.exit(1);
  }

  // 读取日志
  console.log(`📈 Analyzing health check trends from: ${logPath}`);
  const content = await fs.readFile(logPath, 'utf-8');

  // 解析日志
  const entries = parseHealthCheckLog(content);

  // 过滤指定天数内的数据
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - options.days);
  const filteredEntries = entries.filter(e => e.timestamp >= cutoffDate);

  if (filteredEntries.length === 0) {
    console.log(`No health check data found in the last ${options.days} days.`);
    process.exit(0);
  }

  console.log(`Found ${filteredEntries.length} check(s) in the last ${options.days} day(s).`);
  console.log('');

  // 分析趋势
  const analysis = analyzeTrends(filteredEntries);

  // 格式化报告
  let report;
  switch (options.format) {
    case 'json':
      report = formatJsonReport(analysis);
      break;
    case 'markdown':
      report = formatMarkdownReport(analysis, options);
      break;
    default:
      report = formatTextReport(analysis, options);
  }

  // 输出
  if (options.output) {
    await fs.writeFile(options.output, report);
    console.log(`✓ Report saved to: ${options.output}`);
  } else {
    console.log(report);
  }

  // 返回适当的退出码
  const hasIssues = analysis.issues.some(i => i.severity === 'high');
  process.exit(hasIssues ? 1 : 0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
