# Lobby 反馈弹窗移动端 E2E 证据

## 审计范围

- 目标：验证移动端反馈弹窗会盖住悬浮球展开 UI，且输入区在移动端可见、可编辑。
- 入口：大厅页悬浮球 `settings -> feedback`。

## 验证命令

```bash
npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "移动端反馈弹窗应覆盖悬浮球面板，且输入区使用可编辑字号"
```

## 证据截图

![移动端反馈弹窗截图](../test-results/evidence-screenshots/lobby-feedback-modal-mobile.png)

截图路径：
- `test-results/evidence-screenshots/lobby-feedback-modal-mobile.png`

## 肉眼观察结论

- 反馈弹窗位于页面最上层，背景大厅内容和悬浮球都被模糊压暗，没有出现“弹窗被展开面板挡住”的现象。
- 描述输入框内能直接看到“移动端反馈输入可见性校验”这行文本，说明输入内容在移动端不是不可见态。
- 联系方式输入框和底部“提交反馈”按钮都完整留在弹窗内，没有被底部遮挡或裁掉。

## 自动断言结论

- 弹窗根节点 `z-index` 高于当前 FAB 展开层。
- 移动端 `textarea` 计算字号 `>= 16px`。
- `textarea` 填写后值成功回写，输入流程可用。

## 风险与未覆盖项

- 本次 E2E 在大厅页验证了反馈弹窗组件本身；游戏内 `GameHUD` 复用的是同一个 `FeedbackModal` 组件和同一套 portal 逻辑，但本轮没有单独补一个游戏页 E2E。
