# 后台反馈一键复制包含状态 JSON 的 E2E 证据

## 测试目标

验证后台反馈页点击“一键复制”后，复制内容除了现有分诊 payload 外，还会显式携带原始状态 JSON 字符串字段 `stateSnapshotJson`。

## 执行命令

```bash
npm run test:e2e:ci:file -- admin-feedback.e2e.ts "反馈页可展示分诊上下文并复制完整分诊包"
```

## 断言结果

- 用例通过，页面成功展开反馈详情、操作日志入口、状态快照入口和 AI Payload 预览区。
- `feedback-ai-payload-viewer` 中的 JSON 已包含 `stateSnapshotJson` 字段。
- 剪贴板实际写入内容已被测试读取并校验，`stateSnapshotJson` 与反馈记录中的原始 `stateSnapshot` 完全一致。
- 旧的结构化 `stateSnapshot` 仍保留，兼容原有使用方。

## 截图证据

绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\admin-feedback-ai-payload.png`

![后台反馈一键复制包含状态 JSON](../test-results/_shared/admin-feedback-ai-payload.png)

## 截图分析

- 右侧详情面板顶部的“一键复制”按钮已经进入“已复制”状态，说明复制动作已触发。
- 详情面板底部出现 `AI PAYLOAD` 预览区，表示复制时生成的 payload 文本已经同步回填到页面。
- 反馈项同时保留 `JSON` 独立按钮，说明原有单独复制状态快照的入口未被破坏。
