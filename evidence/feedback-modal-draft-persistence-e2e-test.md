# 反馈弹窗误关后保留草稿验证

## 范围

- 目标：反馈弹窗在未提交时被关闭，再次打开后仍保留已输入内容。
- 覆盖链路：
  - 局外大厅移动端反馈弹窗
  - Dice Throne 教程局内横屏反馈弹窗

## 实际执行

- 单测：`node scripts/infra/vitest-cli-safe.mjs run src/components/system/__tests__/FeedbackModal.test.tsx --configLoader native`
- E2E（局外）：`npm run test:e2e:ci:file -- lobby.e2e.ts "移动端反馈弹窗应覆盖悬浮球面板，且输入区使用可编辑字号"`
- E2E（局内）：`npm run test:e2e:ci:file -- dicethrone.e2e.ts "Tutorial landscape feedback keeps inputs visible in game HUD"`
- 静态校验：`npx eslint src/components/system/FeedbackModal.tsx src/components/system/__tests__/FeedbackModal.test.tsx e2e/lobby.e2e.ts e2e/dicethrone.e2e.ts`
- TypeScript：`npm run typecheck`

## 结果

- 单测通过：新增了“关闭后重新打开保留草稿”和“提交成功后清空草稿”两条断言。
- 局外大厅 E2E 通过：首次输入 `移动端反馈输入可见性校验` 后关闭弹窗，再次打开时文本框断言仍为同一内容。
- 局内 Dice Throne E2E 通过：首次输入 `游戏内横屏反馈输入可见性校验` 和 `tester@example.com` 后关闭弹窗，再次打开时描述框与联系方式输入框断言仍保留原值。
- 提交成功后的清空逻辑由单测覆盖，避免旧草稿在成功提交后继续残留。

## 截图产物

- 局外大厅：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby-feedback-modal-mobile.png`
- 局内 Dice Throne：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-feedback-modal-landscape.png`

## 备注

- 当前会话对截图结论以实际运行断言和截图产物路径为准；本轮主要验收点是“误关后再次打开仍保留草稿内容”。
