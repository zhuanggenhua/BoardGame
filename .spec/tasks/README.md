# AI 执行任务卡

本目录承载 AI 执行期任务卡；不放产品需求、OpenSpec 任务或长期计划。

## 规则

- 任务卡文件名：`<slug>.md`，slug 用 kebab-case。
- 只允许根级任务卡和 `README.md`。
- 完成后删除任务卡，历史由 Git 记录。

## Frontmatter

```yaml
---
status: pending
---
```

`status` 只能是 `pending`、`in_progress` 或 `completed`。

## 正文顺序

1. `# <目标>`
2. `## 涉及范围`
3. `## 验收标准`
4. `## 依赖`
