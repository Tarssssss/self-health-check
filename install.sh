#!/bin/bash

################################################################################
# 🏥 Self-Health-Check Skill - 一键安装脚本
#
# 用法:
#   curl -fsSL https://your-repo/raw/main/install.sh | bash
#   或
#   bash install.sh
#
################################################################################

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_step() { echo -e "${BLUE}▶${NC} $1"; }

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 获取 Clawdbot 根目录
find_clawd_root() {
    local possible_paths=(
        "$HOME/clawd"
        "$HOME/clawdbot"
        "/root/clawd"
        "$(pwd)"
    )

    for path in "${possible_paths[@]}"; do
        if [[ -f "$path/package.json" ]] || [[ -d "$path/skills" ]]; then
            echo "$path"
            return 0
        fi
    done

    return 1
}

# 交互式询问
ask() {
    local prompt="$1"
    local default="$2"

    if [[ -n "$default" ]]; then
        prompt="$prompt [$default]"
    fi

    read -p "$prompt: " response
    echo "${response:-$default}"
}

# 询问是否确认
ask_yes_no() {
    local prompt="$1"
    local default="${2:-n}"

    if [[ "$default" == "y" ]]; then
        prompt="$prompt [Y/n]"
    else
        prompt="$prompt [y/N]"
    fi

    while true; do
        read -p "$prompt: " response
        response="${response:-$default}"

        case "$response" in
            [Yy]|[Yy][Ee][Ss]) return 0 ;;
            [Nn]|[Nn][Oo]) return 1 ;;
            *) echo "Please answer yes or no." ;;
        esac
    done
}

################################################################################
# 主安装流程
################################################################################

main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║        🏥 Self-Health-Check Skill Installer               ║"
    echo "║                                                            ║"
    echo "║    定期检查 Clawdbot 代码、配置健康状态                   ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""

    # ============================================================
    # 步骤 1: 检查环境
    # ============================================================
    print_step "Step 1/7: Checking environment..."

    # 检查 Node.js
    if ! command_exists node; then
        print_error "Node.js is not installed!"
        print_info "Please install Node.js first: https://nodejs.org/"
        exit 1
    fi
    local node_version=$(node --version)
    print_success "Node.js found: $node_version"

    # 检查 npm
    if ! command_exists npm; then
        print_error "npm is not installed!"
        exit 1
    fi
    print_success "npm found: $(npm --version)"

    echo ""

    # ============================================================
    # 步骤 2: 查找/创建 Clawdbot 目录
    # ============================================================
    print_step "Step 2/7: Locating Clawdbot directory..."

    CLAWD_ROOT=$(find_clawd_root)

    if [[ -z "$CLAWD_ROOT" ]]; then
        print_warning "Could not find Clawdbot directory."
        CLAWD_ROOT=$(ask "Enter Clawdbot root directory" "$HOME/clawd")

        if [[ ! -d "$CLAWD_ROOT" ]]; then
            if ask_yes_no "Create directory $CLAWD_ROOT?" "y"; then
                mkdir -p "$CLAWD_ROOT"
                print_success "Created directory: $CLAWD_ROOT"
            else
                print_error "Installation cancelled."
                exit 1
            fi
        fi
    fi

    print_success "Clawdbot root: $CLAWD_ROOT"
    echo ""

    # ============================================================
    # 步骤 3: 复制 Skill 文件
    # ============================================================
    print_step "Step 3/7: Installing self-health-check skill..."

    SKILL_DIR="$CLAWD_ROOT/skills/self-health-check"

    if [[ -d "$SKILL_DIR" ]]; then
        if ask_yes_no "Skill directory already exists. Overwrite?" "n"; then
            rm -rf "$SKILL_DIR"
        else
            print_info "Keeping existing installation."
        fi
    fi

    mkdir -p "$SKILL_DIR"

    # 获取脚本所在目录
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # 复制文件
    if [[ -d "$SCRIPT_DIR/scripts" ]]; then
        cp -r "$SCRIPT_DIR/"* "$SKILL_DIR/"
        print_success "Files copied to $SKILL_DIR"
    else
        print_error "Could not find skill files. Please run this script from the skill directory."
        exit 1
    fi

    echo ""

    # ============================================================
    # 步骤 4: 安装依赖
    # ============================================================
    print_step "Step 4/7: Installing dependencies..."

    cd "$SKILL_DIR"
    npm install --silent

    print_success "Dependencies installed"
    echo ""

    # ============================================================
    # 步骤 5: 配置向导
    # ============================================================
    print_step "Step 5/7: Configuration wizard..."
    echo ""

    # 读取现有 .env（如果存在）
    ENV_FILE="$CLAWD_ROOT/.env"
    if [[ -f "$ENV_FILE" ]]; then
        print_info "Found existing .env file"
    fi

    # 配置选项
    echo -e "${BLUE}Configuration Options:${NC}"
    echo ""

    # 检查间隔
    INTERVAL=$(ask "Health check interval (minutes)" "30")

    # Telegram 群组
    echo ""
    echo "Telegram target group options:"
    echo "  - discussion  : 讨论群"
    echo "  - general     : 通用群"
    echo "  - daily_report: 日报群"
    TELEGRAM_GROUP=$(ask "Telegram target group" "discussion")

    # 仅警报模式
    ALERT_ONLY="true"
    if ask_yes_no "Only send notifications on issues?" "y"; then
        ALERT_ONLY="true"
    else
        ALERT_ONLY="false"
    fi

    # 写入配置到 .env
    echo ""
    print_info "Adding configuration to .env..."

    {
        echo ""
        echo "# Self-Health-Check Configuration"
        echo "HEALTH_CHECK_INTERVAL=$INTERVAL"
        echo "HEALTH_CHECK_LOG_FILE=/tmp/clawdbot/health-check.log"
        echo "HEALTH_CHECK_TELEGRAM_GROUP=$TELEGRAM_GROUP"
        echo "HEALTH_CHECK_ALERT_ONLY=$ALERT_ONLY"
    } >> "$ENV_FILE"

    print_success "Configuration saved to $ENV_FILE"
    echo ""

    # ============================================================
    # 步骤 6: 运行首次检查
    # ============================================================
    print_step "Step 6/7: Running initial health check..."
    echo ""

    node "$SKILL_DIR/scripts/health-check.js" || {
        print_warning "Initial check had issues. This is normal on first run."
    }

    echo ""
    print_success "Initial check completed"
    echo ""

    # ============================================================
    # 步骤 7: 配置自动运行
    # ============================================================
    print_step "Step 7/7: Setting up automation..."
    echo ""

    echo "Choose automation method:"
    echo "  1) Cron (recommended for servers)"
    echo "  2) Skip (manual setup later)"
    echo ""

    AUTO_METHOD=$(ask "Choice" "1")

    case "$AUTO_METHOD" in
        1|cron)
            # 设置 cron
            print_info "Setting up cron job..."

            CRON_LINE="*/${INTERVAL} * * * * cd $SKILL_DIR && node scripts/health-check.js >> /tmp/clawdbot/health-cron.log 2>&1"

            # 添加到 crontab
            (crontab -l 2>/dev/null | grep -v "health-check"; echo "$CRON_LINE") | crontab -

            print_success "Cron job installed"
            print_info "Check with: crontab -l"
            ;;
        2|skip)
            print_info "Skipping automation. You can set it up later."
            ;;
    esac

    echo ""

    # ============================================================
    # 完成
    # ============================================================
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                  ✓ Installation Complete!                 ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""

    echo "📋 Quick Start:"
    echo ""
    echo "  Run quick check:"
    echo "    cd $SKILL_DIR && node scripts/health-check.js"
    echo ""
    echo "  Run full check with notifications:"
    echo "    node scripts/health-check.js --full --notify"
    echo ""
    echo "  View logs:"
    echo "    cat /tmp/clawdbot/health-check.log"
    echo ""
    echo "  Edit configuration:"
    echo "    nano $ENV_FILE"
    echo ""

    echo "📚 Documentation:"
    echo "  $SKILL_DIR/README.md"
    echo ""

    # 提示查看首次检查结果
    if ask_yes_no "View initial health check report now?" "n"; then
        echo ""
        cat /tmp/clawdbot/health-check.log 2>/dev/null || print_warning "No log file yet."
    fi
}

# 运行安装
main "$@"
