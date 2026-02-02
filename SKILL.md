---
name: self-health-check
version: 1.0.0
description: |
  🏥 Self-Health-Check Skill - 定期检查 Clawdbot 代码、配置健康状态

  通过 heartbeat 机制定期执行以下检查：
  - 配置文件完整性（必需的环境变量）
  - JavaScript 语法验证
  - 依赖模块完整性
  - 日志错误分析
  - Git 状态（secrets 检测、未提交更改）

  检查结果可发送到 Telegram 或 Notion。

author: clawdbot
tags: health,monitoring,self-check,heartbeat
license: MIT

# 命令定义
commands:
  - name: health-check
    description: 执行完整的健康检查
    usage: health-check [--full] [--notify]
    options:
      - name: --full
        description: 执行完整检查（包括所有 skills）
      - name: --notify
        description: 发送结果到 Telegram/Notion
    example: health-check --full --notify

  - name: health-quick
    description: 快速健康检查（仅核心组件）
    usage: health-quick
    example: health-quick

# 环境变量
environment:
  - name: HEALTH_CHECK_INTERVAL
    description: 健康检查间隔（分钟）
    default: "30"
    required: false

  - name: HEALTH_CHECK_LOG_FILE
    description: 健康检查日志文件路径
    default: "/tmp/clawdbot/health-check.log"
    required: false

  - name: HEALTH_CHECK_NOTION_DB_ID
    description: 记录检查结果的 Notion 数据库 ID
    required: false

  - name: HEALTH_CHECK_TELEGRAM_GROUP
    description: 接收健康检查通知的 Telegram 群组 (discussion/general/daily_report)
    default: "discussion"
    required: false

  - name: HEALTH_CHECK_ALERT_ONLY
    description: 仅在发现问题时发送通知
    default: "true"
    required: false

# Heartbeat 配置
heartbeat:
  enabled: true
  interval: 30  # 分钟
  command: health-quick
  on_failure: health-check --full --notify

# 依赖的 skills
dependencies:
  - telegram-notification
  - notion-persistence-universal

# 安装说明
install: |
  1. 确保 .env 配置了必要的环境变量
  2. npm install
  3. 手动运行一次: node scripts/health-check.js

# 更新日志
changelog: |
  ## 1.0.0
  - 初始版本
  - 配置、语法、依赖、日志、Git 检查
  - Heartbeat 定时机制
