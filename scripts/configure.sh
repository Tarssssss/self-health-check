#!/bin/bash

################################################################################
# 🏥 Self-Health-Check - 交互式配置向导
#
# 用法: bash scripts/configure.sh
################################################################################

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() { echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
print_title() { echo -e "${CYAN}  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_option() { echo -e "${CYAN}▸${NC} $1"; }

ask() {
    local prompt="$1"
    local default="$2"
    local response

    if [[ -n "$default" ]]; then
        prompt="$prompt ${CYAN}[$default]${NC}"
    fi

    read -p "$prompt: " response
    echo "${response:-$default}"
}

ask_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    local response

    if [[ "$default" == "y" ]]; then
        prompt="$prompt ${CYAN}[Y/n]${NC}"
    else
        prompt="$prompt ${CYAN}[y/N]${NC}"
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

ask_choice() {
    local prompt="$1"
    shift
    local options=("$@")
    local default="${options[0]}"

    echo "$prompt"
    local i=1
    for opt in "${options[@]}"; do
        echo "  $i) $opt"
        ((i++))
    done

    while true; do
        local choice
        read -p "Choose [1-${#options[@]}]: " choice

        if [[ -z "$choice" ]]; then
            echo "$default"
            return 0
        fi

        if [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le "${#options[@]}" ]]; then
            echo "${options[$((choice-1))]}"
            return 0
        fi

        echo "Invalid choice. Please enter a number between 1 and ${#options[@]}"
    done
}

# 查找 Clawdbot 根目录
find_clawd_root() {
    local possible_paths=(
        "$HOME/clawd"
        "$HOME/clawdbot"
        "/root/clawd"
        "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
    )

    for path in "${possible_paths[@]}"; do
        if [[ -f "$path/.env" ]] || [[ -d "$path/skills" ]]; then
            echo "$path"
            return 0
        fi
    done

    return 1
}

# 读取现有配置
load_config() {
    ENV_FILE="$CLAWD_ROOT/.env"

    if [[ -f "$ENV_FILE" ]]; then
        # 读取现有配置
        HEALTH_CHECK_INTERVAL=$(grep "^HEALTH_CHECK_INTERVAL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
        HEALTH_CHECK_TELEGRAM_GROUP=$(grep "^HEALTH_CHECK_TELEGRAM_GROUP=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
        HEALTH_CHECK_ALERT_ONLY=$(grep "^HEALTH_CHECK_ALERT_ONLY=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
        HEALTH_CHECK_NOTION_DB_ID=$(grep "^HEALTH_CHECK_NOTION_DB_ID=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
    fi

    # 设置默认值
    HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-30}
    HEALTH_CHECK_TELEGRAM_GROUP=${HEALTH_CHECK_TELEGRAM_GROUP:-discussion}
    HEALTH_CHECK_ALERT_ONLY=${HEALTH_CHECK_ALERT_ONLY:-true}
}

# 显示当前配置
show_current_config() {
    print_header
    print_title "🏥 Self-Health-Check Configuration"
    print_header
    echo ""

    echo -e "${CYAN}Current Configuration:${NC}"
    echo ""
    echo "  Clawdbot Root:     $CLAWD_ROOT"
    echo "  Check Interval:    ${HEALTH_CHECK_INTERVAL} minutes"
    echo "  Telegram Group:    ${HEALTH_CHECK_TELEGRAM_GROUP}"
    echo "  Alert Only:        ${HEALTH_CHECK_ALERT_ONLY}"
    echo "  Notion DB ID:      ${HEALTH_CHECK_NOTION_DB_ID:-Not configured}"
    echo ""

    if [[ -f "$ENV_FILE" ]]; then
        print_success "Configuration file: $ENV_FILE"
    else
        print_warning "Configuration file not found: $ENV_FILE"
    fi
    echo ""
}

# 配置检查间隔
configure_interval() {
    echo ""
    print_title "⏱️  Check Interval Configuration"
    echo ""
    print_info "How often should health checks run?"
    echo ""

    local preset
    preset=$(ask_choice "Choose a preset:" "30 minutes" "1 hour" "2 hours" "6 hours" "12 hours" "custom")

    case "$preset" in
        "30 minutes")  HEALTH_CHECK_INTERVAL=30 ;;
        "1 hour")      HEALTH_CHECK_INTERVAL=60 ;;
        "2 hours")     HEALTH_CHECK_INTERVAL=120 ;;
        "6 hours")     HEALTH_CHECK_INTERVAL=360 ;;
        "12 hours")    HEALTH_CHECK_INTERVAL=720 ;;
        "custom")
            HEALTH_CHECK_INTERVAL=$(ask "Enter interval in minutes" "30")
            while ! [[ "$HEALTH_CHECK_INTERVAL" =~ ^[0-9]+$ ]] || [[ "$HEALTH_CHECK_INTERVAL" -lt 5 ]]; do
                print_error "Invalid interval. Must be a number >= 5"
                HEALTH_CHECK_INTERVAL=$(ask "Enter interval in minutes" "30")
            done
            ;;
    esac

    print_success "Interval set to ${HEALTH_CHECK_INTERVAL} minutes"
}

# 配置 Telegram 通知
configure_telegram() {
    echo ""
    print_title "📱 Telegram Notification Configuration"
    echo ""

    # 选择目标群组
    print_info "Select which Telegram group to send notifications to:"
    echo ""
    HEALTH_CHECK_TELEGRAM_GROUP=$(ask_choice "Telegram Group:" \
        "discussion" \
        "general" \
        "daily_report" \
        "none (disable Telegram notifications)")

    print_success "Telegram group: ${HEALTH_CHECK_TELEGRAM_GROUP}"

    # 配置警报模式
    echo ""
    if ask_yes_no "Only send notifications when issues are found?" "y"; then
        HEALTH_CHECK_ALERT_ONLY=true
        print_success "Alert-only mode enabled"
    else
        HEALTH_CHECK_ALERT_ONLY=false
        print_info "All check results will be sent"
    fi
}

# 配置 Notion 集成
configure_notion() {
    echo ""
    print_title "📊 Notion Integration Configuration"
    echo ""

    if [[ -n "$HEALTH_CHECK_NOTION_DB_ID" ]]; then
        print_info "Current Notion DB: $HEALTH_CHECK_NOTION_DB_ID"
        echo ""

        if ! ask_yes_no "Change Notion database?" "n"; then
            return
        fi
    fi

    if ask_yes_no "Save health check results to Notion?" "n"; then
        HEALTH_CHECK_NOTION_DB_ID=$(ask "Enter Notion Database ID" "")

        if [[ -z "$HEALTH_CHECK_NOTION_DB_ID" ]]; then
            print_warning "Notion integration disabled"
            HEALTH_CHECK_NOTION_DB_ID=""
        else
            print_success "Notion DB ID: $HEALTH_CHECK_NOTION_DB_ID"
        fi
    else
        HEALTH_CHECK_NOTION_DB_ID=""
        print_info "Notion integration disabled"
    fi
}

# 配置自动运行
configure_automation() {
    echo ""
    print_title "⚙️  Automation Configuration"
    echo ""

    print_info "Choose automation method:"
    echo ""

    local method
    method=$(ask_choice "Automation:" \
        "Cron (recommended)" \
        "Systemd timer" \
        "Manual (no automation)" \
        "Skip (keep current)")

    case "$method" in
        "Cron (recommended)")
            configure_cron
            ;;
        "Systemd timer")
            configure_systemd
            ;;
        "Manual (no automation)")
            remove_automation
            print_info "Automation disabled. Run manually with: health-check"
            ;;
        "Skip (keep current)")
            print_info "Keeping current automation settings"
            ;;
    esac
}

# 配置 Cron
configure_cron() {
    local cron_cmd="cd $CLAWD_ROOT/skills/self-health-check && node scripts/health-check.js"
    local cron_line="*/${HEALTH_CHECK_INTERVAL} * * * * $cron_cmd >> /tmp/clawdbot/health-cron.log 2>&1"

    # 移除旧的 health-check cron 项
    local current_crontab
    current_crontab=$(crontab -l 2>/dev/null || echo "")
    local new_crontab
    new_crontab=$(echo "$current_crontab" | grep -v "health-check")

    # 添加新的 cron 项
    new_crontab=$(echo "$new_crontab"; echo "$cron_line")

    # 写入 crontab
    echo "$new_crontab" | crontab -

    print_success "Cron job installed"
    print_info "Check with: crontab -l"
}

# 配置 Systemd
configure_systemd() {
    local service_file="/etc/systemd/system/clawd-health-check.service"
    local timer_file="/etc/systemd/system/clawd-health-check.timer"

    print_info "Systemd service requires root privileges"
    echo ""

    if ! command -v systemctl &> /dev/null; then
        print_error "systemctl not found. Systemd not available?"
        return
    fi

    # 创建 service 文件
    print_info "Creating service file..."
    sudo tee "$service_file" > /dev/null << EOF
[Unit]
Description=Clawdbot Self-Health-Check
After=network.target

[Service]
Type=oneshot
User=$USER
WorkingDirectory=$CLAWD_ROOT/skills/self-health-check
ExecStart=/usr/bin/node scripts/health-check.js --notify
Environment="NODE_ENV=production"
EnvironmentFile=$CLAWD_ROOT/.env

[Install]
WantedBy=multi-user.target
EOF

    # 创建 timer 文件
    print_info "Creating timer file..."
    sudo tee "$timer_file" > /dev/null << EOF
[Unit]
Description=Clawdbot Self-Health-Check Timer
Requires=clawd-health-check.service

[Timer]
OnUnitActiveSec=${HEALTH_CHECK_INTERVAL}min
OnBootSec=1min
Persistent=true

[Install]
WantedBy=timers.target
EOF

    # 重新加载并启用
    sudo systemctl daemon-reload
    sudo systemctl enable clawd-health-check.timer
    sudo systemctl start clawd-health-check.timer

    print_success "Systemd timer installed and started"
    print_info "Check with: systemctl status clawd-health-check.timer"
}

# 移除自动运行
remove_automation() {
    echo ""
    print_info "Removing existing automation..."

    # 移除 cron
    local current_crontab
    current_crontab=$(crontab -l 2>/dev/null || echo "")
    local new_crontab
    new_crontab=$(echo "$current_crontab" | grep -v "health-check")
    echo "$new_crontab" | crontab - 2>/dev/null || true

    # 停止 systemd timer
    if systemctl is-active --quiet clawd-health-check.timer 2>/dev/null; then
        sudo systemctl stop clawd-health-check.timer
        sudo systemctl disable clawd-health-check.timer
    fi

    print_success "Automation removed"
}

# 保存配置
save_config() {
    print_header
    print_title "💾 Saving Configuration"
    print_header
    echo ""

    local env_file="$CLAWD_ROOT/.env"

    # 移除旧的 health-check 配置
    if [[ -f "$env_file" ]]; then
        local temp_env
        temp_env=$(grep -v "^HEALTH_CHECK_" "$env_file" 2>/dev/null || echo "")
        echo "$temp_env" > "$env_file.tmp"
        mv "$env_file.tmp" "$env_file"
    fi

    # 添加新配置
    {
        echo ""
        echo "# Self-Health-Check Configuration"
        echo "# Last updated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
        echo "HEALTH_CHECK_INTERVAL=$HEALTH_CHECK_INTERVAL"
        echo "HEALTH_CHECK_LOG_FILE=/tmp/clawdbot/health-check.log"
        echo "HEALTH_CHECK_TELEGRAM_GROUP=$HEALTH_CHECK_TELEGRAM_GROUP"
        echo "HEALTH_CHECK_ALERT_ONLY=$HEALTH_CHECK_ALERT_ONLY"
        if [[ -n "$HEALTH_CHECK_NOTION_DB_ID" ]]; then
            echo "HEALTH_CHECK_NOTION_DB_ID=$HEALTH_CHECK_NOTION_DB_ID"
        fi
    } >> "$env_file"

    print_success "Configuration saved to $env_file"
}

# 运行测试
run_test() {
    echo ""
    print_header
    print_title "🧪 Running Test"
    print_header
    echo ""

    print_info "Running health check with new configuration..."
    echo ""

    cd "$CLAWD_ROOT/skills/self-health-check"

    if node scripts/health-check.js --notify; then
        echo ""
        print_success "Test passed! Health check is working correctly."
    else
        echo ""
        print_warning "Test had issues. Check the output above for details."
    fi
}

# 显示配置摘要
show_summary() {
    echo ""
    print_header
    print_title "✅ Configuration Complete"
    print_header
    echo ""

    echo -e "${CYAN}Summary:${NC}"
    echo ""
    echo "  Check Interval:    ${HEALTH_CHECK_INTERVAL} minutes"
    echo "  Telegram Group:    ${HEALTH_CHECK_TELEGRAM_GROUP}"
    echo "  Alert Only:        ${HEALTH_CHECK_ALERT_ONLY}"
    echo "  Notion DB:         ${HEALTH_CHECK_NOTION_DB_ID:-Not configured}"
    echo ""

    echo -e "${CYAN}Next Steps:${NC}"
    echo ""
    echo "  • View logs:      cat /tmp/clawdbot/health-check.log"
    echo "  • Manual check:   cd $CLAWD_ROOT/skills/self-health-check && node scripts/health-check.js"
    echo "  • Full check:     node scripts/health-check.js --full --notify"
    echo "  • Reconfigure:    bash scripts/configure.sh"
    echo ""
}

################################################################################
# 主流程
################################################################################

main() {
    clear

    # 查找 Clawdbot 目录
    CLAWD_ROOT=$(find_clawd_root)
    if [[ -z "$CLAWD_ROOT" ]]; then
        print_error "Could not find Clawdbot directory"
        CLAWD_ROOT=$(ask "Enter Clawdbot root directory" "$HOME/clawd")
    fi

    # 加载现有配置
    load_config

    # 显示当前配置
    show_current_config

    # 询问是否修改
    if ! ask_yes_no "Do you want to change the configuration?" "y"; then
        print_info "Configuration unchanged. Exiting."
        exit 0
    fi

    # 配置向导
    configure_interval
    configure_telegram
    configure_notion
    configure_automation

    # 保存配置
    save_config

    # 运行测试
    if ask_yes_no "Run a test health check now?" "y"; then
        run_test
    fi

    # 显示摘要
    show_summary
}

main "$@"
