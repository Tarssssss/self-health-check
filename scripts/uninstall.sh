#!/bin/bash

################################################################################
# 🏥 Self-Health-Check - 卸载脚本
#
# 用法: bash scripts/uninstall.sh
################################################################################

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() { echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
print_title() { echo -e "${BLUE}  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

ask() {
    local prompt="$1"
    local default="${2:-n}"
    local response

    if [[ "$default" == "y" ]]; then
        prompt="$prompt ${BLUE}[Y/n]${NC}"
    else
        prompt="$prompt ${BLUE}[y/N]${NC}"
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

# 查找安装目录
find_install_dir() {
    local possible_paths=(
        "$HOME/clawd/skills/self-health-check"
        "$HOME/clawdbot/skills/self-health-check"
        "/root/clawd/skills/self-health-check"
    )

    for path in "${possible_paths[@]}"; do
        if [[ -d "$path" ]]; then
            echo "$path"
            return 0
        fi
    done

    return 1
}

# 移除 cron 任务
remove_cron() {
    print_info "Checking for cron jobs..."

    local current_crontab
    current_crontab=$(crontab -l 2>/dev/null || echo "")

    if echo "$current_crontab" | grep -q "health-check"; then
        print_info "Found health-check cron job"

        if ask "Remove cron job?" "y"; then
            local new_crontab
            new_crontab=$(echo "$current_crontab" | grep -v "health-check")
            echo "$new_crontab" | crontab - 2>/dev/null || crontab -r 2>/dev/null || true
            print_success "Cron job removed"
        fi
    else
        print_info "No cron jobs found"
    fi
}

# 移除 systemd 服务
remove_systemd() {
    print_info "Checking for systemd services..."

    if command -v systemctl &> /dev/null; then
        if systemctl list-unit-files | grep -q "clawd-health-check"; then
            print_info "Found systemd service: clawd-health-check"

            if ask "Remove systemd service?" "y"; then
                sudo systemctl stop clawd-health-check.timer 2>/dev/null || true
                sudo systemctl disable clawd-health-check.timer 2>/dev/null || true
                sudo rm -f /etc/systemd/system/clawd-health-check.{service,timer}
                sudo systemctl daemon-reload
                print_success "Systemd service removed"
            fi
        else
            print_info "No systemd services found"
        fi
    fi
}

# 移除环境变量配置
remove_env_config() {
    print_info "Checking environment configuration..."

    local clawd_root
    clawd_root=$(cd "$INSTALL_DIR/../.." && pwd)
    local env_file="$clawd_root/.env"

    if [[ -f "$env_file" ]]; then
        if grep -q "HEALTH_CHECK_" "$env_file"; then
            print_info "Found health-check configuration in $env_file"

            if ask "Remove environment variables?" "y"; then
                local temp_env
                temp_env=$(grep -v "^HEALTH_CHECK_" "$env_file")
                echo "$temp_env" > "$env_file.tmp"
                mv "$env_file.tmp" "$env_file"
                print_success "Environment variables removed"
            fi
        else
            print_info "No environment variables found"
        fi
    fi
}

# 询问是否保留日志
ask_keep_logs() {
    print_info "Log files location:"
    echo "  - /tmp/clawdbot/health-check.log"
    echo "  - /tmp/clawdbot/health-cron.log"
    echo ""

    if ask "Keep log files?" "y"; then
        print_info "Logs will be preserved"
        return 0
    else
        print_info "Removing log files..."
        rm -f /tmp/clawdbot/health-check.log
        rm -f /tmp/clawdbot/health-cron.log
        print_success "Log files removed"
        return 1
    fi
}

# 显示摘要
show_summary() {
    print_header
    print_title "✅ Uninstallation Complete"
    print_header
    echo ""

    print_info "Self-Health-Check skill has been removed from:"
    echo "  $INSTALL_DIR"
    echo ""

    print_info "If you want to reinstall:"
    echo "  1. Navigate to the skill directory"
    echo "  2. Run: bash install.sh"
    echo ""
}

################################################################################
# 主流程
################################################################################

main() {
    clear

    print_header
    print_title "🏥 Self-Health-Check Uninstaller"
    print_header
    echo ""

    # 查找安装目录
    INSTALL_DIR=$(find_install_dir)

    if [[ -z "$INSTALL_DIR" ]]; then
        print_error "Could not find installed Self-Health-Check skill"
        print_info "If you installed it in a custom location, please manually remove it"
        exit 1
    fi

    print_info "Found installation at: $INSTALL_DIR"
    echo ""

    # 确认卸载
    if ! ask "Are you sure you want to uninstall Self-Health-Check?" "n"; then
        print_info "Uninstallation cancelled"
        exit 0
    fi

    echo ""

    # 移除自动化配置
    remove_cron
    remove_systemd
    remove_env_config

    echo ""

    # 询问是否保留日志
    ask_keep_logs

    echo ""

    # 移除 skill 目录
    print_info "Removing skill directory..."
    rm -rf "$INSTALL_DIR"
    print_success "Skill directory removed"

    # 显示摘要
    show_summary
}

main "$@"
