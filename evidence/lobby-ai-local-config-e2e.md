# Lobby AI 入口 E2E 证据

## 测试目标
- 验证大厅游戏详情弹窗会展示新的模式入口：`教程模式`、`单机模式`、`对战AI`。
- 验证点击 `对战AI` 后会直接进入本地逻辑 AI 对局，而不是再经过本地配置弹窗。
- 验证点击 `单机模式` 后不会把第二个座位默认交给 AI。
- 验证进入本地房间后，调试面板会显示当前 AI 支持状态以及 `P1 -> Local AI` 的 seat controller 结果。

## 执行命令
```bash
npm run test:e2e:ci:file -- lobby.e2e.ts "Game details modal opens and shows actions"
npm run test:e2e:ci:file -- lobby.e2e.ts "Tic-Tac-Toe 对战AI入口会直接进入本地逻辑 AI 对局"
npm run test:e2e:ci:file -- lobby.e2e.ts "Tic-Tac-Toe 单机模式入口不会把第二个座位交给 AI"
```

## 结果
- 结果：通过
- 用例文件：`D:\gongzuo\webgame\BoardGame\e2e\lobby.e2e.ts`
- 证据截图（对战AI）：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby.e2e\Tic-Tac-Toe-对战AI入口会直接进入本地逻辑-AI-对局\lobby-tictactoe-local-ai-config-debug.png`
- 证据截图（单机模式）：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby.e2e\Tic-Tac-Toe-单机模式入口不会把第二个座位交给-AI\lobby-tictactoe-single-device-human-seat-debug.png`

## 截图分析
- `对战AI` 截图显示页面已经从大厅详情页直接进入 `Tic-Tac-Toe` 的本地房间 URL，说明 `对战AI` 入口链路已经改成直达模式。
- 同一张 `对战AI` 截图里右侧调试面板已展开到控制页签，`Seat Controllers` 中第二个座位为 `Local AI`，说明默认的本地逻辑 AI 分配已生效。
- `单机模式` 截图中，调试面板里的第二个座位显示为 `Human`，说明这条入口会显式覆盖默认 AI seat controller，不会再把本地真人局误导成 AI 对局。
- 两张截图共同证明新的产品入口语义已经和运行时配置对齐：`单机模式` 是显式人类对战，`对战AI` 是直达本地逻辑 AI。

## 关联改动
- 大厅游戏详情弹窗入口从泛化的 `Local` 调整为 `教程模式`、`单机模式`、`对战AI`。
- `单机模式` 显式覆盖 `seat1=human`，避免支持 local AI 的游戏被默认推成 AI 对局。
- `对战AI` 直接复用当前本地逻辑 AI 默认配置，不依赖联网。
- `LocalMatchRoom` / `GameHUD` 也消费同一份 seat controller 结果，避免进局后再退回“本地同屏”口径。
