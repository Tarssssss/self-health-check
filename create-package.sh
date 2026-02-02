#!/bin/bash

################################################################################
# 📦 创建部署包脚本
#
# 用法: bash create-package.sh
#
# 生成:
#   - self-health-check.tar.gz  (Linux/Mac)
#   - self-health-check.zip     (Windows)
################################################################################

set -e

VERSION="${1:-1.0.0}"
PACKAGE_NAME="self-health-check-${VERSION}"

echo "📦 Creating deployment package: $PACKAGE_NAME"
echo ""

# 创建临时目录
TMP_DIR=$(mktemp -d)
mkdir -p "$TMP_DIR/$PACKAGE_NAME"

echo "📋 Copying files..."

# 复制核心文件
cp -r scripts "$TMP_DIR/$PACKAGE_NAME/"
cp SKILL.md package.json README.md .env.example "$TMP_DIR/$PACKAGE_NAME/"
cp install.sh "$TMP_DIR/$PACKAGE_NAME/"
cp DEPLOY.md "$TMP_DIR/$PACKAGE_NAME/"

# 创建 configs 目录并复制 systemd 配置
mkdir -p "$TMP_DIR/$PACKAGE_NAME/configs"
cp configs/health-check.service "$TMP_DIR/$PACKAGE_NAME/configs/"
cp configs/health-check.timer "$TMP_DIR/$PACKAGE_NAME/configs/"

# 创建快速启动脚本
cat > "$TMP_DIR/$PACKAGE_NAME/quick-start.sh" << 'EOF'
#!/bin/bash
# Self-Health-Check Quick Start Script

echo "🏥 Self-Health-Check - Quick Start"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# 运行安装
chmod +x install.sh
./install.sh
EOF

chmod +x "$TMP_DIR/$PACKAGE_NAME/quick-start.sh"

# 创建 Windows 批处理文件
cat > "$TMP_DIR/$PACKAGE_NAME/quick-start.bat" << 'EOF'
@echo off
echo 🏥 Self-Health-Check - Quick Start
echo.

REM 检查 Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

echo ✓ Node.js found
echo.

REM 运行安装（需要 Git Bash 或 WSL）
echo Please run install.sh using Git Bash or WSL
echo Or follow the manual installation steps in DEPLOY.md
pause
EOF

# 创建版本信息文件
cat > "$TMP_DIR/$PACKAGE_NAME/VERSION" << EOF
Package: self-health-check
Version: ${VERSION}
Build Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Platform: Universal
EOF

# 创建校验文件
cd "$TMP_DIR"
echo "🔐 Creating checksums..."

# TAR.GZ
echo "  Creating tar.gz..."
tar -czf "/tmp/${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"
cd /tmp
sha256sum "${PACKAGE_NAME}.tar.gz" > "${PACKAGE_NAME}.tar.gz.sha256"

# ZIP
echo "  Creating zip..."
zip -rq "/tmp/${PACKAGE_NAME}.zip" "$TMP_DIR/$PACKAGE_NAME"
cd /tmp
sha256sum "${PACKAGE_NAME}.zip" > "${PACKAGE_NAME}.zip.sha256"

# 复制到当前目录
cp "/tmp/${PACKAGE_NAME}.tar.gz" .
cp "/tmp/${PACKAGE_NAME}.zip" .
cp "/tmp/${PACKAGE_NAME}.tar.gz.sha256" .
cp "/tmp/${PACKAGE_NAME}.zip.sha256" .

# 清理
rm -rf "$TMP_DIR"

echo ""
echo "✅ Package created successfully!"
echo ""
echo "📦 Files:"
echo "  - ${PACKAGE_NAME}.tar.gz"
echo "  - ${PACKAGE_NAME}.zip"
echo "  - ${PACKAGE_NAME}.tar.gz.sha256"
echo "  - ${PACKAGE_NAME}.zip.sha256"
echo ""
echo "📋 Deployment:"
echo "  tar.gz:  tar -xzf ${PACKAGE_NAME}.tar.gz && cd ${PACKAGE_NAME} && ./install.sh"
echo "  zip:     unzip ${PACKAGE_NAME}.zip && cd ${PACKAGE_NAME} && ./install.sh"
echo ""
echo "🔐 Verify checksums:"
echo "  sha256sum -c ${PACKAGE_NAME}.tar.gz.sha256"
echo "  sha256sum -c ${PACKAGE_NAME}.zip.sha256"
