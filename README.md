# Self-Health-Check Skill

## 概述

这是一个 Clawdbot 自我健康检查 skill，通过 heartbeat 机制定期检查系统代码、配置是否存在问题。

## 功能特性

- **配置检查**: 验证必需的环境变量是否设置
- **语法检查**: 检查 JavaScript 文件是否有语法错误
- **依赖检查**: 确保 npm 依赖正确安装
- **日志分析**: 分析最近的日志文件，检测错误模式
- **Git 状态**: 检查未提交的更改和潜在的 secret 泄露
- **趋势分析**: 分析历史数据，生成健康趋势报告
- **Web Dashboard**: 可视化查看健康检查结果

---

## 快速开始

### 一行命令安装

```bash
curl -fsSL https://raw.githubusercontent.com/your-username/clawd-skells/main/self-health-check/install.sh | bash
```

### 手动安装

```bash
# 1. 复制到 skills 目录
cp -r self-health-check ~/clawd/skills/

# 2. 安装依赖
cd ~/clawd/skills/self-health-check
npm install

# 3. 配置
npm run configure

# 4. 运行测试
npm run health-quick
```

---

## 命令使用

### NPM 脚本

```bash
# 快速健康检查
npm run health-quick

# 完整健康检查
npm run health-check

# 运行测试（不写入日志）
npm test

# 配置向导
npm run configure

# 分析趋势
npm run analyze

# 启动 Web Dashboard
npm run dashboard

# 更新 skill
npm run update

# 卸载 skill
npm run uninstall
```

### 直接运行脚本

```bash
# 健康检查
node scripts/health-check.js              # 快速检查
node scripts/health-check.js --full       # 完整检查
node scripts/health-check.js --notify     # 发送通知
node scripts/health-check.js --dry-run    # 试运行

# 趋势分析
node scripts/analyze-trends.js            # 分析最近 7 天
node scripts/analyze-trends.js --days 30  # 分析最近 30 天
node scripts/analyze-trends.js --format markdown --output report.md

# Web Dashboard
node scripts/dashboard/server.js          # 启动 (端口 3000)
node scripts/dashboard/server.js --port 8080

# 配置管理
bash scripts/configure.sh                 # 交互式配置
bash scripts/update.sh                    # 更新 skill
bash scripts/uninstall.sh                 # 卸载 skill
```

---

## Web Dashboard

启动 Web Dashboard 可以可视化查看健康检查结果：

```bash
npm run dashboard
```

然后访问 http://localhost:3000

Dashboard 功能：
- 📊 实时统计数据
- 📈 30 天趋势图
- 📝 最近检查记录
- 🔄 自动刷新（30秒）

---

## 趋势分析

分析历史健康检查数据，获取趋势报告：

```bash
# 分析最近 7 天（默认）
npm run analyze

# 分析最近 30 天
node scripts/analyze-trends.js --days 30

# 输出为 Markdown
node scripts/analyze-trends.js --format markdown --output report.md

# 输出为 JSON
node scripts/analyze-trends.js --format json
```

报告包含：
- 总体统计（通过率、平均执行时间）
- 各项检查的通过率
- 检测到的问题
- 改进建议

---

## 配置说明

### 环境变量

在 `~/clawd/.env` 中添加：

```bash
# Self-Health-Check Configuration
HEALTH_CHECK_INTERVAL=30              # 检查间隔（分钟）
HEALTH_CHECK_LOG_FILE=/tmp/clawdbot/health-check.log
HEALTH_CHECK_TELEGRAM_GROUP=discussion # 通知群组
HEALTH_CHECK_ALERT_ONLY=true         # 仅警报时通知
HEALTH_CHECK_NOTION_DB_ID=           # Notion 数据库 ID（可选）
```

### Telegram 群组选项

- `discussion` - 讨论群
- `general` - 通用群
- `daily_report` - 日报群

---

## 自动运行配置

### Cron 方式（推荐）

安装脚本会自动配置，手动添加：

```bash
crontab -e

# 每 30 分钟运行一次
*/30 * * * * cd ~/clawd/skills/self-health-check && node scripts/health-check.js
```

### Systemd 方式

```bash
# 复制服务文件
sudo cp configs/health-check.service /etc/systemd/system/
sudo cp configs/health-check.timer /etc/systemd/system/

# 修改路径
sudo nano /etc/systemd/system/health-check.service

# 启用并启动
sudo systemctl enable health-check.timer
sudo systemctl start health-check.timer
```

---

## 检查项说明

| 检查项 | 说明 | 检测内容 |
|--------|------|----------|
| **Config** | 配置完整性 | .env 文件存在、必需变量设置 |
| **Syntax** | JavaScript 语法 | 关键脚本语法错误检测 |
| **Dependencies** | 依赖状态 | package.json 与 node_modules 一致性 |
| **Logs** | 日志分析 | 错误模式统计、路径问题检测 |
| **Git** | 仓库状态 | 未提交更改、secret 泄露检测 |

---

## 检查结果

### 状态说明

- **✅ pass**: 检查通过，无问题
- **⚠️ warning**: 发现警告，建议修复
- **❌ fail**: 检查失败，需要修复
- **💥 error**: 检查过程出错

### 输出示例

```
🏥 Clawdbot Health Check Report
📅 2026-02-02 14:30:00
📊 Overall Status: ✅ PASS

## Summary
Total Checks: 5
✅ Passed: 5
⚠️  Warnings: 0
❌ Failed: 0
💥 Errors: 0

## Details
✅ Config Check [45ms]
   13/13 required vars set

✅ Syntax Check [120ms]
   45/45 files passed

✅ Dependencies Check [85ms]
   8/8 package.json checks passed

✅ Logs Analysis [230ms]
   Found 5 errors, 0 warnings

✅ Git Status [150ms]
   Working directory clean
```

---

## 部署到其他电脑

### 方式一：一键安装脚本

```bash
curl -fsSL https://your-url/install.sh | bash
```

### 方式二：部署包

```bash
# 创建部署包
chmod +x create-package.sh
bash create-package.sh

# 在目标电脑上
tar -xzf self-health-check-1.0.0.tar.gz
cd self-health-check-1.0.0
./install.sh
```

### 方式三：Git 克隆

```bash
git clone https://github.com/your-repo/clawd-skells.git
cd clawd-skells/self-health-check
./install.sh
```

详见 [DEPLOY.md](DEPLOY.md) 和 [QUICKSTART.md](QUICKSTART.md)

---

## 项目结构

```
self-health-check/
├── install.sh              # 一键安装脚本
├── create-package.sh       # 创建部署包
├── configure.sh            # 配置向导
├── update.sh               # 更新脚本
├── uninstall.sh            # 卸载脚本
├── SKILL.md                # Skill 配置
├── package.json            # NPM 配置
├── README.md               # 本文档
├── QUICKSTART.md           # 快速开始
├── DEPLOY.md               # 部署指南
├── .env.example            # 环境变量模板
├── scripts/
│   ├── health-check.js     # 主入口脚本
│   ├── analyze-trends.js   # 趋势分析
│   ├── dashboard/
│   │   └── server.js       # Web Dashboard
│   ├── checks/             # 检查模块
│   │   ├── config.js
│   │   ├── syntax.js
│   │   ├── dependencies.js
│   │   ├── logs.js
│   │   └── git.js
│   └── lib/                # 工具库
│       ├── logger.js
│       └── notifier.js
└── configs/
    ├── health-check.service
    └── health-check.timer
```

---

## 依赖的 Skills

- `telegram-notification`: 发送 Telegram 通知
- `notion-persistence-universal`: 保存报告到 Notion

---

## 故障排除

### Q: 检查失败但没有通知？

**A**: 检查 `HEALTH_CHECK_ALERT_ONLY` 是否设置为 `true`，确认 Telegram bot token 和群组 ID 正确。

### Q: Web Dashboard 无法访问？

**A**: 确认端口未被占用，尝试指定其他端口：
```bash
node scripts/dashboard/server.js --port 8080
```

### Q: 趋势分析没有数据？

**A**: 需要先运行至少一次健康检查生成日志数据。

### Q: 如何停止自动检查？

**A**:
```bash
# Cron 方式
crontab -e  # 删除 health-check 相关行

# Systemd 方式
sudo systemctl stop health-check.timer
sudo systemctl disable health-check.timer
```

---

## 更新日志

### v1.0.0
- 初始版本
- 配置、语法、依赖、日志、Git 检查
- Heartbeat 定时机制
- Web Dashboard
- 趋势分析
- 一键安装/卸载/更新脚本

---

## License

MIT
