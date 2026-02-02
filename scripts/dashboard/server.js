#!/usr/bin/env node

/**
 * 📊 Health Check Web Dashboard
 *
 * 提供一个简单的 Web 界面来查看健康检查结果和趋势
 *
 * 用法:
 *   node dashboard/server.js                 # 启动服务 (默认端口 3000)
 *   node dashboard/server.js --port 8080     # 指定端口
 *   node dashboard/server.js --public        # 公网访问
 */

const fs = require('fs').const promises = require('fs').promises;
const path = require('path');
const { existsSync } = require('fs');
const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const LOG_FILE = process.env.HEALTH_CHECK_LOG_FILE || '/tmp/clawdbot/health-check.log';

/**
 * 读取并解析健康检查日志
 */
async function readHealthChecks() {
  try {
    if (!existsSync(LOG_FILE)) {
      return [];
    }

    const content = await fs.readFile(LOG_FILE, 'utf-8');
    const entries = [];

    // 解析每个日志条目
    const rawEntries = content.split(/={60}\n📅 /);

    for (const entry of rawEntries) {
      if (!entry.trim()) continue;

      const timestampMatch = entry.match(/^([\d-]+T[\d:]+.[\d:]+)\n/);
      if (!timestampMatch) continue;

      const timestamp = new Date(timestampMatch[1]);

      // 提取摘要
      let overallStatus = 'unknown';
      let passed = 0, warnings = 0, failed = 0, errors = 0, total = 0;

      const summaryMatch = entry.match(/Overall Status:\s*([✅⚠️❌💥])\s*(\w+)/);
      if (summaryMatch) {
        const emoji = summaryMatch[1];
        if (emoji === '✅') overallStatus = 'pass';
        else if (emoji === '⚠️') overallStatus = 'warning';
        else if (emoji === '❌') overallStatus = 'fail';
        else if (emoji === '💥') overallStatus = 'error';
      }

      const totalMatch = entry.match(/Total Checks:\s*(\d+)/);
      if (totalMatch) total = parseInt(totalMatch[1]);

      const passedMatch = entry.match(/✅ Passed:\s*(\d+)/);
      if (passedMatch) passed = parseInt(passedMatch[1]);

      const warningsMatch = entry.match(/⚠️\s+Warnings:\s*(\d+)/);
      if (warningsMatch) warnings = parseInt(warningsMatch[1]);

      const failedMatch = entry.match(/❌ Failed:\s*(\d+)/);
      if (failedMatch) failed = parseInt(failedMatch[1]);

      const errorsMatch = entry.match(/💥 Errors:\s*(\d+)/);
      if (errorsMatch) errors = parseInt(errorsMatch[1]);

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

      entries.push({
        id: timestamp.getTime(),
        timestamp: timestamp.toISOString(),
        overallStatus,
        summary: { total, passed, warnings, failed, errors },
        checks
      });
    }

    return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error('Error reading health checks:', error);
    return [];
  }
}

/**
 * 获取统计数据
 */
function getStats(entries) {
  if (entries.length === 0) {
    return {
      total: 0,
      pass: 0,
      warning: 0,
      fail: 0,
      error: 0,
      passRate: 0
    };
  }

  const total = entries.length;
  const pass = entries.filter(e => e.overallStatus === 'pass').length;
  const warning = entries.filter(e => e.overallStatus === 'warning').length;
  const fail = entries.filter(e => e.overallStatus === 'fail').length;
  const error = entries.filter(e => e.overallStatus === 'error').length;

  return {
    total,
    pass,
    warning,
    fail,
    error,
    passRate: ((pass / total) * 100).toFixed(1)
  };
}

/**
 * 获取趋势数据（按天）
 */
function getTrendData(entries) {
  const dailyMap = new Map();

  for (const entry of entries) {
    const date = new Date(entry.timestamp).toISOString().split('T')[0];
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, pass: 0, warning: 0, fail: 0, error: 0, total: 0 });
    }
    const day = dailyMap.get(date);
    day.total++;
    day[entry.overallStatus]++;
  }

  return Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30); // 最近30天
}

/**
 * HTML 模板
 */
function getHtml(entries, stats, trends) {
  const statusEmoji = { pass: '✅', warning: '⚠️', fail: '❌', error: '💥', unknown: '❓' };
  const statusColor = { pass: '#22c55e', warning: '#eab308', fail: '#ef4444', error: '#dc2626', unknown: '#6b7280' };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clawdbot Health Check Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      line-height: 1.6;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      border: 1px solid #334155;
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; font-size: 14px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #334155;
    }
    .stat-label { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 32px; font-weight: bold; margin-top: 8px; }
    .stat-pass { color: #22c55e; }
    .stat-warning { color: #eab308; }
    .stat-fail { color: #ef4444; }
    .stat-error { color: #dc2626; }
    .stat-total { color: #3b82f6; }
    .grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    @media (max-width: 768px) {
      .grid { grid-template-columns: 1fr; }
    }
    .card {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #334155;
    }
    .card-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #f1f5f9;
    }
    .chart-container {
      height: 200px;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding-top: 20px;
    }
    .chart-bar {
      flex: 1;
      background: #3b82f6;
      border-radius: 4px 4px 0 0;
      min-height: 4px;
      transition: all 0.2s;
    }
    .chart-bar:hover {
      background: #60a5fa;
      transform: scaleY(1.05);
    }
    .chart-bar.pass { background: #22c55e; }
    .chart-bar.warning { background: #eab308; }
    .chart-bar.fail { background: #ef4444; }
    .chart-bar.error { background: #dc2626; }
    .entry-list {
      max-height: 400px;
      overflow-y: auto;
    }
    .entry {
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 8px;
      background: #0f172a;
      border-left: 4px solid #334155;
    }
    .entry.pass { border-left-color: #22c55e; }
    .entry.warning { border-left-color: #eab308; }
    .entry.fail { border-left-color: #ef4444; }
    .entry.error { border-left-color: #dc2626; }
    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .entry-status { font-size: 14px; }
    .entry-time { color: #94a3b8; font-size: 12px; }
    .entry-summary {
      font-size: 12px;
      color: #94a3b8;
    }
    .check-list {
      margin-top: 8px;
      padding-left: 12px;
    }
    .check-item {
      font-size: 12px;
      padding: 4px 0;
      color: #cbd5e1;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #94a3b8;
    }
    .refresh-hint {
      text-align: center;
      color: #64748b;
      font-size: 12px;
      margin-top: 16px;
    }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #0f172a; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🏥 Clawdbot Health Check Dashboard</h1>
      <div class="subtitle">Last updated: ${new Date().toLocaleString('zh-CN')}</div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Checks</div>
        <div class="stat-value stat-total">${stats.total}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pass Rate</div>
        <div class="stat-value stat-pass">${stats.passRate}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Passed</div>
        <div class="stat-value stat-pass">${stats.pass}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Warnings</div>
        <div class="stat-value stat-warning">${stats.warning}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Failed</div>
        <div class="stat-value stat-fail">${stats.fail}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Errors</div>
        <div class="stat-value stat-error">${stats.error}</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">📊 Recent Checks</div>
        ${entries.length === 0 ? '<div class="empty-state">No health check data available</div>' : `
        <div class="entry-list">
          ${entries.slice(0, 20).map(entry => `
            <div class="entry ${entry.overallStatus}">
              <div class="entry-header">
                <span class="entry-status">${statusEmoji[entry.overallStatus]} ${entry.overallStatus.toUpperCase()}</span>
                <span class="entry-time">${new Date(entry.timestamp).toLocaleString('zh-CN')}</span>
              </div>
              <div class="entry-summary">
                ${entry.summary.passed}/${entry.summary.total} passed | ${entry.summary.warnings} warnings | ${entry.summary.failed} failed
              </div>
              ${entry.checks.length > 0 ? `
                <div class="check-list">
                  ${entry.checks.slice(0, 5).map(check => `
                    <div class="check-item">${statusEmoji[check.status]} ${check.name} (${check.duration}ms)</div>
                  `).join('')}
                  ${entry.checks.length > 5 ? `<div class="check-item">+${entry.checks.length - 5} more...</div>` : ''}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        `}
      </div>

      <div class="card">
        <div class="card-title">📈 30-Day Trend</div>
        ${trends.length === 0 ? '<div class="empty-state">No trend data available</div>' : `
        <div class="chart-container">
          ${trends.map(day => {
            const height = Math.max(4, (day.total / Math.max(...trends.map(t => t.total))) * 100);
            const status = day.error > 0 ? 'error' : day.fail > 0 ? 'fail' : day.warning > 0 ? 'warning' : 'pass';
            return `<div class="chart-bar ${status}" style="height: ${height}%;" title="${day.date}: ${day.pass}/${day.total} passed"></div>`;
          }).join('')}
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 10px; color: #64748b;">
          <span>${trends[0]?.date || ''}</span>
          <span>${trends[trends.length - 1]?.date || ''}</span>
        </div>
        `}
      </div>
    </div>

    <div class="refresh-hint">
      🔄 Auto-refresh every 30 seconds | Data from: ${LOG_FILE}
    </div>
  </div>

  <script>
    // 自动刷新
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>`;
}

/**
 * 创建 HTTP 服务器
 */
function createServer() {
  const server = http.createServer(async (req, res) => {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // API 路由
    if (req.url === '/api/health-checks') {
      const entries = await readHealthChecks();
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(entries));
      return;
    }

    if (req.url === '/api/stats') {
      const entries = await readHealthChecks();
      const stats = getStats(entries);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(stats));
      return;
    }

    if (req.url === '/api/trends') {
      const entries = await readHealthChecks();
      const trends = getTrendData(entries);
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(trends));
      return;
    }

    // 主页
    if (req.url === '/' || req.url === '/index.html') {
      const entries = await readHealthChecks();
      const stats = getStats(entries);
      const trends = getTrendData(entries);
      const html = getHtml(entries, stats, trends);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.writeHead(200);
      res.end(html);
      return;
    }

    // 404
    res.writeHead(404);
    res.end('Not Found');
  });

  return server;
}

/**
 * 主函数
 */
async function main() {
  console.log('📊 Starting Health Check Dashboard...');

  const server = createServer();

  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('✅ Dashboard is running!');
    console.log('');
    console.log(`   URL: http://${HOST}:${PORT}`);
    console.log(`   Log: ${LOG_FILE}`);
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down dashboard...');
    server.close(() => {
      console.log('✅ Dashboard stopped');
      process.exit(0);
    });
  });
}

main().catch(err => {
  console.error('Error starting dashboard:', err);
  process.exit(1);
});
