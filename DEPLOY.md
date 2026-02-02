# Self-Health-Check Skill - 快速部署指南

## 📦 方法一：一键安装脚本（推荐）

### 在新电脑上执行：

```bash
# 1. 进入临时目录
cd /tmp

# 2. 下载整个 skill 文件夹
# 方式 A: 如果你有 git 仓库
git clone <your-repo> clawd-skills
cd clawd-skills/self-health-check

# 方式 B: 如果你有压缩包
unzip self-health-check.zip
cd self-health-check

# 3. 运行安装脚本
chmod +x install.sh
./install.sh
```

安装脚本会自动：
- 检查 Node.js 环境
- 查找/创建 Clawdbot 目录
- 复制 skill 文件
- 安装 npm 依赖
- 运行配置向导
- 设置自动运行

---

## 🚀 方法二：手动快速安装

```bash
# 1. 设置变量（根据你的实际路径修改）
export CLAWD_ROOT="$HOME/clawd"
export SKILL_NAME="self-health-check"

# 2. 复制 skill 文件夹
mkdir -p "$CLAWD_ROOT/skills"
cp -r self-health-check "$CLAWD_ROOT/skills/"

# 3. 安装依赖
cd "$CLAWD_ROOT/skills/$SKILL_NAME"
npm install

# 4. 添加配置到 .env
cat >> "$CLAWD_ROOT/.env" << 'EOF'

# Self-Health-Check Configuration
HEALTH_CHECK_INTERVAL=30
HEALTH_CHECK_LOG_FILE=/tmp/clawdbot/health-check.log
HEALTH_CHECK_TELEGRAM_GROUP=discussion
HEALTH_CHECK_ALERT_ONLY=true
EOF

# 5. 运行测试
node scripts/health-check.js --full
```

---

## 🌐 方法三：通过 URL 远程安装

### 从 GitHub/GitLab 仓库安装

```bash
# 创建安装脚本
cat > /tmp/install-health-check.sh << 'INSTALL_SCRIPT'
#!/bin/bash
set -e

# 配置
REPO_URL="https://github.com/your-username/clawd-skells.git"
CLAWD_ROOT="$HOME/clawd"

# 克隆仓库
git clone "$REPO_URL" /tmp/clawd-skells
cd /tmp/clawd-skells/self-health-check

# 运行安装
chmod +x install.sh
./install.sh

# 清理
rm -rf /tmp/clawd-skells
INSTALL_SCRIPT

# 运行安装
chmod +x /tmp/install-health-check.sh
bash /tmp/install-health-check.sh
```

### 从压缩文件安装

```bash
# 下载并解压
curl -L https://github.com/your-username/clawd-skells/archive/main.zip -o /tmp/clawd-skells.zip
unzip /tmp/clawd-skells.zip "clawd-skells-main/self-health-check/*" -d /tmp

# 运行安装
cd /tmp/clawd-skells-main/self-health-check
chmod +x install.sh
./install.sh
```

---

## ⚙️ 方法四：Docker 部署

### Dockerfile

```dockerfile
FROM node:22-alpine

# 安装基础工具
RUN apk add --no-cache git bash curl

# 设置工作目录
WORKDIR /app/clawd

# 复制 skill 文件
COPY self-health-check/ ./skills/self-health-check/

# 安装依赖
RUN cd skills/self-health-check && npm install --production

# 创建日志目录
RUN mkdir -p /tmp/clawdbot

# 复制环境变量模板
COPY self-health-check/.env.example /app/clawd/.env

# 设置入口点
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
```

### docker-entrypoint.sh

```bash
#!/bin/bash
set -e

# 如果有命令参数，执行它
if [[ $# -gt 0 ]]; then
    exec "$@"
else
    # 否则运行健康检查
    cd /app/clawd/skills/self-health-check
    exec node scripts/health-check.js --full --notify
fi
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  clawdbot:
    image: clawdbot:latest
    container_name: clawdbot
    environment:
      - NOTION_API_KEY=${NOTION_API_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      # ... 其他环境变量
    volumes:
      - ./data:/app/clawd/data
      - /tmp/clawdbot:/tmp/clawdbot
    restart: unless-stopped

  health-check:
    image: clawdbot:latest
    container_name: clawdbot-health-check
    environment:
      - HEALTH_CHECK_INTERVAL=30
      - HEALTH_CHECK_TELEGRAM_GROUP=discussion
    volumes:
      - /tmp/clawdbot:/tmp/clawdbot
      - ./clawd:/app/clawd:ro
    command: node /app/clawd/skills/self-health-check/scripts/health-check.js --notify
    restart: "no"
```

---

## 📋 首次配置清单

在新电脑上部署后，请检查以下项目：

- [ ] **环境变量配置**
  ```bash
  nano ~/clawd/.env
  ```
  确保包含：
  - `NOTION_API_KEY`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_DISCUSSION_GROUP_ID`
  - `TELEGRAM_DAILY_REPORT_GROUP_ID`

- [ ] **Skill 依赖检查**
  ```bash
  cd ~/clawd/skills/self-health-check
  npm install
  ```

- [ ] **运行首次测试**
  ```bash
  node scripts/health-check.js --full --notify
  ```

- [ ] **确认日志输出**
  ```bash
  cat /tmp/clawdbot/health-check.log
  ```

- [ ] **配置自动运行**（选其一）
  ```bash
  # 方式 A: Cron
  crontab -e
  # 添加: */30 * * * * cd ~/clawd/skills/self-health-check && node scripts/health-check.js

  # 方式 B: 系统服务（systemd）
  sudo cp configs/health-check.service /etc/systemd/system/
  sudo systemctl enable health-check
  sudo systemctl start health-check
  ```

---

## 🔧 常见问题

### Q1: 找不到 Clawdbot 目录

**A:** 安装脚本会尝试自动定位，或手动指定：
```bash
CLAWD_ROOT=/path/to/your/clawd ./install.sh
```

### Q2: Node.js 版本不兼容

**A:** 确保使用 Node.js 18+：
```bash
# 检查版本
node --version

# 如果版本过低，使用 nvm 安装新版本
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22
```

### Q3: 权限问题

**A:** 确保有执行权限：
```bash
chmod +x install.sh
chmod +x scripts/health-check.js
```

### Q4: 依赖安装失败

**A:** 尝试清理缓存重试：
```bash
cd ~/clawd/skills/self-health-check
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Q5: Telegram 通知不工作

**A:** 检查配置：
```bash
# 确认环境变量已设置
grep TELEGRAM ~/clawd/.env

# 测试 Telegram 连接
cd ~/clawd/skills/telegram-notification
node scripts/notify-group.js --target discussion --title "Test" --summary "Test message"
```

---

## 📦 部署包准备

### 创建可移植的部署包

```bash
#!/bin/bash
# create-deploy-package.sh

VERSION="1.0.0"
PACKAGE_NAME="self-health-check-${VERSION}"

# 创建临时目录
TMP_DIR=$(mktemp -d)
mkdir -p "$TMP_DIR/$PACKAGE_NAME"

# 复制文件
cp -r scripts "$TMP_DIR/$PACKAGE_NAME/"
cp SKILL.md package.json README.md .env.example "$TMP_DIR/$PACKAGE_NAME/"
cp install.sh "$TMP_DIR/$PACKAGE_NAME/"

# 创建压缩包
cd "$TMP_DIR"
tar -czf "/tmp/${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"
zip -r "/tmp/${PACKAGE_NAME}.zip" "$PACKAGE_NAME"

# 复制回当前目录
cp "/tmp/${PACKAGE_NAME}.tar.gz" .
cp "/tmp/${PACKAGE_NAME}.zip" .

# 清理
rm -rf "$TMP_DIR"

echo "Package created: ${PACKAGE_NAME}.tar.gz"
echo "Package created: ${PACKAGE_NAME}.zip"
```

### 部署包使用说明

接收方只需要：
```bash
# 解压
tar -xzf self-health-check-1.0.0.tar.gz
cd self-health-check-1.0.0

# 安装
chmod +x install.sh
./install.sh
```

---

## 🔄 持续更新

### 设置自动更新

```bash
# 在 crontab 中添加
0 3 * * * cd ~/clawd/skills/self-health-check && git pull && npm install
```

### 手动更新

```bash
cd ~/clawd/skills/self-health-check
git pull origin main
npm install
```
