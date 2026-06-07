# SmashUp 四人 AI 进房稳定性 E2E 证据

- 范围：`e2e/smashup/smashup-four-player-ai-entry-stable.e2e.ts`
- 结论：通过
- 关键截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-four-player-ai-entry-ui-loop\smashup-four-player-ai-entry-ui-loop.png`
- 命令：
  - `npm run test:e2e:ci:file -- smashup-four-player-ai-entry-stable.e2e.ts`
  - `npm run test:e2e:ci:file -- smashup-four-player-ai-entry-stable.e2e.ts "大厅 UI 创建 4 人 3 AI 房间后不应自动退出并反复重进"`（连续跑 2 次）

观察：

- 画面停留在“选择你的派系”的对局界面，没有退回大厅。
- 底部座位条显示 `P1` 房主以及 `P2/P3/P4` 三个 AI 占位，和 1 真人 + 3 AI 预期一致。
- 画面中没有看到回大厅遮罩、连接错误页或异常重进迹象。
- API 直建路径与大厅 UI 建房路径都通过；大厅 UI 用例额外连续通过 2 次，当前工作区未复现“自动退出并自动重进”的循环现象。
