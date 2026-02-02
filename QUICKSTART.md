# Self-Health-Check Skill - 快速开始

## 一行命令安装

```bash
curl -fsSL https://raw.githubusercontent.com/your-username/clawd-skells/main/self-health-check/install.sh | bash
```

或者：

```bash
wget -qO- https://raw.githubusercontent.com/your-username/clawd-skells/main/self-health-check/install.sh | bash
```

---

## 三步手动安装

```bash
# 1. 下载
git clone https://github.com/your-username/clawd-skells.git
cd clawd-skells/self-health-check

# 2. 安装
chmod +x install.sh
./install.sh

# 3. 测试
cd ~/clawd/skills/self-health-check
node scripts/health-check.js --notify
```

---

## 配置说明

安装后会自动在 `~/clawd/.env` 中添加以下配置：

```bash
# Self-Health-Check Configuration
HEALTH_CHECK_INTERVAL=30              # 检查间隔（分钟）
HEALTH_CHECK_TELEGRAM_GROUP=discussion # 通知群组
HEALTH_CHECK_ALERT_ONLY=true         # 仅警报时通知
```

如需修改，编辑：
```bash
nano ~/clawd/.env
```

---

## 自动运行

### Cron 方式（推荐）

安装脚本会自动配置 Cron，查看：
```bash
crontab -l | grep health-check
```

手动添加：
```bash
(crontab -l 2>/dev/null; echo "*/30 * * * * cd ~/clawd/skills/self-health-check && node scripts/health-check.js") | crontab -
```

### Systemd 方式

```bash
# 复制服务文件
sudo cp configs/health-check.service /etc/systemd/system/
sudo cp configs/health-check.timer /etc/systemd/system/

# 编辑路径
sudo nano /etc/systemd/system/health-check.service
# 将 YOUR_USERNAME 和 /path/to/clawd 替换为实际值

# 启用服务
sudo systemctl enable health-check.timer
sudo systemctl start health-check.timer

# 查看状态
sudo systemctl status health-check.timer
sudo systemctl list-timers
```

---

## 快速命令

```bash
# 快速检查
node scripts/health-check.js

# 完整检查（含所有 skills）
node scripts/health-check.js --full

# 发送通知
node scripts/health-check.js --notify

# 查看日志
cat /tmp/clawdbot/health-check.log
```

---

## 需要的环境变量

确保 `~/clawd/.env` 中包含：

```bash
# Notion
NOTION_API_KEY=secret_*
NOTION_DISCUSSION_DATABASE_ID=xxx
NOTION_DAILY_REPORT_DATABASE_ID=xxx

# Telegram
TELEGRAM_BOT_TOKEN=xxx:xxx
TELEGRAM_DISCUSSION_GROUP_ID=-xxx
TELEGRAM_DAILY_REPORT_GROUP_ID=-xxx
TELEGRAM_GENERAL_GROUP_ID=-xxx  # 可选
```

---

## 常见问题

**Q: 安装失败？**
```bash
# 检查 Node.js
node --version  # 需要 18+

# 手动安装依赖
cd ~/clawd/skills/self-health-check
npm install
```

**Q: 通知不工作？**
```bash
# 检查环境变量
cat ~/clawd/.env | grep TELEGRAM

# 测试 Telegram
cd ~/clawd/skills/telegram-notification
node scripts/notify-group.js --target discussion --title "Test" --summary "Test"
```

**Q: 如何停止自动检查？**
```bash
# Cron 方式
crontab -e  # 删除 health-check 相关行

# Systemd 方式
sudo systemctl stop health-check.timer
sudo systemctl disable health-check.timer
```

---

## 更多帮助

- 完整文档: [README.md](README.md)
- 部署指南: [DEPLOY.md](DEPLOY.md)
