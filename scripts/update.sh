#!/bin/bash

################################################################################
# 🏥 Self-Health-Check - 更新脚本
#
# 用法: bash scripts/update.sh
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

ask() {
    local prompt="$1"
    local default="${2:-y}"
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

# 查找安装目录
find_install_dir() {
    local possible_paths=(
        "$HOME/clawd/skills/self-health-check"
        "$HOME/clawdbot/skills/self-health-check"
        "/root/clawd/skills/self-health-check"
        "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    )

    for path in "${possible_paths[@]}"; do
        if [[ -d "$path" ]] && [[ -f "$path/package.json" ]]; then
            echo "$path"
            return 0
        fi
    done

    return 1
}

# 获取当前版本
get_current_version() {
    if [[ -f "$INSTALL_DIR/package.json" ]]; then
        grep '"version"' "$INSTALL_DIR/package.json" | head -1 | sed 's/.*: "\(.*\)".*/\1/'
    fi
}

# 备份配置
backup_config() {
    print_info "Backing up configuration..."

    local clawd_root
    clawd_root=$(cd "$INSTALL_DIR/../.." && pwd)
    local env_file="$clawd_root/.env"
    local backup_dir="/tmp/health-check-backup-$(date +%Y%m%d_%H%M%S)"

    mkdir -p "$backup_dir"

    # 备份环境变量
    if [[ -f "$env_file" ]]; then
        grep "^HEALTH_CHECK_" "$env_file" > "$backup_dir/env-config.txt" 2>/dev/null || true
    fi

    # 备份日志
    if [[ -f "/tmp/clawdbot/health-check.log" ]]; then
        cp /tmp/clawdbot/health-check.log "$backup_dir/" 2>/dev/null || true
    fi

    print_success "Backup saved to: $backup_dir"
    BACKUP_DIR="$backup_dir"
}

# 从 Git 更新
update_from_git() {
    print_info "Updating from Git repository..."

    if [[ ! -d "$INSTALL_DIR/.git" ]]; then
        print_error "Not a Git repository. Cannot update automatically."
        print_info "Please download the latest version manually"
        return 1
    fi

    cd "$INSTALL_DIR"

    # 获取当前分支
    local current_branch
    current_branch=$(git branch --show-current)

    print_info "Current branch: $current_branch"

    # 检查是否有未提交的更改
    if ! git diff-index --quiet HEAD --; then
        print_warning "You have uncommitted changes"

        if ! ask "Stash changes and continue?" "y"; then
            print_info "Update cancelled"
            return 1
        fi

        git stash push -m "Auto-stash before update"
    fi

    # 拉取更新
    print_info "Pulling latest changes..."
    if git pull origin "$current_branch"; then
        print_success "Repository updated"
    else
        print_error "Failed to pull updates"
        return 1
    fi

    # 安装依赖
    print_info "Installing dependencies..."
    if npm install --silent; then
        print_success "Dependencies updated"
    else
        print_error "Failed to install dependencies"
        return 1
    fi

    return 0
}

# 手动更新（需要用户下载）
update_manual() {
    print_info "Manual update required"
    echo ""
    print_info "To update manually:"
    echo "  1. Download the latest version from:"
    echo "     https://github.com/your-username/clawd-skells"
    echo "  2. Extract to a temporary location"
    echo "  3. Copy files to: $INSTALL_DIR"
    echo "  4. Run: npm install"
    echo ""

    if ask "Open download page in browser?" "n"; then
        if command -v xdg-open &> /dev/null; then
            xdg-open "https://github.com/your-username/clawd-skells/tree/main/self-health-check"
        elif command -v open &> /dev/null; then
            open "https://github.com/your-username/clawd-skells/tree/main/self-health-check"
        fi
    fi
}

# 恢复配置
restore_config() {
    if [[ -n "$BACKUP_DIR" ]] && [[ -d "$BACKUP_DIR" ]]; then
        print_info "Configuration was backed up to: $BACKUP_DIR"
        print_info "You can restore it manually if needed"
    fi
}

# 运行健康检查验证
verify_update() {
    echo ""
    print_header
    print_title "🧪 Verifying Update"
    print_header
    echo ""

    print_info "Running health check..."

    if node "$INSTALL_DIR/scripts/health-check.js"; then
        print_success "Health check passed"
        return 0
    else
        print_warning "Health check had issues"
        return 1
    fi
}

# 显示更新摘要
show_summary() {
    print_header
    print_title "✅ Update Complete"
    print_header
    echo ""

    local new_version
    new_version=$(get_current_version)

    print_info "Updated from $CURRENT_VERSION to $new_version"
    echo ""

    if [[ "$UPDATE_METHOD" == "git" ]]; then
        print_info "Update method: Git pull"
    else
        print_info "Update method: Manual"
    fi
    echo ""

    print_info "What's next:"
    echo "  • Review changelog: Check the project repository"
    echo "  • Run full check: node $INSTALL_DIR/scripts/health-check.js --full"
    echo "  • Reconfigure: bash $INSTALL_DIR/scripts/configure.sh"
    echo ""
}

################################################################################
# 主流程
################################################################################

main() {
    clear

    print_header
    print_title "🏥 Self-Health-Check Updater")
    print_header
    echo ""

    # 查找安装目录
    INSTALL_DIR=$(find_install_dir)

    if [[ -z "$INSTALL_DIR" ]]; then
        print_error "Could not find Self-Health-Check installation"
        exit 1
    fi

    # 获取当前版本
    CURRENT_VERSION=$(get_current_version)
    print_info "Found installation: $INSTALL_DIR"
    print_info "Current version: $CURRENT_VERSION"
    echo ""

    # 确认更新
    if ! ask "Update Self-Health-Check?" "y"; then
        print_info "Update cancelled"
        exit 0
    fi

    # 备份配置
    backup_config

    # 选择更新方式
    echo ""
    print_info "Select update method:"
    echo "  1) Git pull (automatic, if installed from git)"
    echo "  2) Manual (download and copy files)"
    echo ""

    read -p "Choice [1-2]: " update_choice

    case "$update_choice" in
        1)
            UPDATE_METHOD="git"
            if ! update_from_git; then
                print_error "Automatic update failed"
                restore_config
                exit 1
            fi
            ;;
        2)
            UPDATE_METHOD="manual"
            update_manual
            # 手动更新后等待用户确认
            echo ""
            read -p "Press Enter after manual update is complete..."
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac

    # 验证更新
    verify_update

    # 恢复配置提示
    restore_config

    # 显示摘要
    show_summary
}

main "$@"
