# 后台反馈一键复制改为 AI 摘要的 E2E 证据

## 验证目标

验证后台反馈页点击“一键复制”后：

- 复制内容改为给 AI 使用的单行摘要，不再是 JSON 大括号结构
- 预览框关闭软换行，避免视觉上被折断
- 原始状态快照仍可通过旁边 `JSON` 按钮单独复制

## 执行命令

```bash
npm run test:e2e:ci:file -- admin-feedback.e2e.ts "反馈页可展示分诊上下文并复制压缩 AI 摘要"
```

## 结果

- 结果：通过
- 断言覆盖：
  - 复制文本与剪贴板内容一致
  - 文本不以 `{` 开头
  - 文本不包含换行
  - 文本包含反馈 ID、游戏、内容、客户端、错误、操作、状态摘要等关键字段
  - 预览框 `textarea` 带 `wrap="off"`

## 截图证据

- 绝对路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\admin-feedback-ai-summary-copy.png`

![后台反馈 AI 摘要复制截图](../test-results/evidence-screenshots/admin-feedback-ai-summary-copy.png)

## 结论

当前“一键复制”已从多行 JSON 改为面向 AI 的压缩摘要，右侧预览同步显示该摘要，粘贴成本更低；需要原始状态 JSON 时仍可使用独立 `JSON` 按钮。
