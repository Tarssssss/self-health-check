# Contributing to Self-Health-Check

感谢你有兴趣贡献！以下是贡献指南。

## 如何贡献

### 报告问题

在创建 issue 前，请先搜索已有 issues。

创建 issue 时请包含：
- 详细的问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（OS、Node.js 版本等）

### 提交代码

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范

- 代码风格遵循现有代码
- 添加必要的注释
- 更新相关文档
- 确保所有测试通过

### 添加新的检查模块

在 `scripts/checks/` 下创建新文件：

```javascript
async function run(clawdRoot, options = {}) {
  const details = [];
  const fixes = [];

  // 你的检查逻辑
  const isOk = await yourCheckFunction();

  details.push({
    status: isOk ? 'pass' : 'fail',
    message: `Custom check: ${isOk ? 'OK' : 'Failed'}`
  });

  if (!isOk) {
    fixes.push('Suggested fix for this issue');
  }

  return {
    status: isOk ? 'pass' : 'fail',
    message: 'Custom check completed',
    details,
    fix: fixes
  };
}

module.exports = { run };
```

然后在 `health-check.js` 中引入并使用。

## 许可

贡献的代码将采用 MIT 许可证。
