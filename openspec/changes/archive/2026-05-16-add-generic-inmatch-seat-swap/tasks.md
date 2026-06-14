## 1. Implementation
- [x] 1.1 `MatchRoom` 增加通用换位入口模式映射：`dicethrone=request`，`smashup/summonerwars=instant`。
- [x] 1.2 通用座位顺序推导统一为 `seatingOrder -> turnOrder -> startingPlayerId + players -> players keys`。
- [x] 1.3 HUD 新增换位悬浮球入口，视觉顺序固定在“操作日志”和“强制结束 AI 当前阶段”之间。
- [x] 1.4 App 运行时隐藏 HUD 全屏悬浮球入口。
- [x] 1.5 `smashup` 校验链路收口：去除重复 `SWAP_SEAT` 分支并保留目标合法性验证。
- [x] 1.6 `summonerwars` 增加 `sw:swap_seat` 完整链路（types/validate/execute/reduce/events/game.ts 命令白名单），即时换位后更新 `startingPlayerId/currentPlayer`。
- [x] 1.7 `instant` 模式显示门禁收口：仅未开局且存在阵营选择上下文时显示，开局后隐藏。
- [x] 1.8 保持 `dicethrone` 四人旧换位入口不变，HUD 入口不替代旧入口。

## 2. Tests
- [x] 2.1 `summonerwars` 在线 AI E2E：验证 HUD 换位入口可见、可与 AI 即时换位。
- [x] 2.2 `dicethrone` 四人旧换位 E2E 回归：验证旧入口点击 AI 头像仍可即时换位。

## 3. Validation
- [x] 3.1 `openspec validate add-generic-inmatch-seat-swap --strict --no-interactive`
- [x] 3.2 `npm run typecheck`
- [x] 3.3 `npm run test:e2e:ci:file -- summonerwars/summonerwars.e2e.ts "在线 AI 阵营选择 HUD 换位：应显示入口并可与 AI 交换先手"`
- [x] 3.4 `npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player seating panel: clicking an AI portrait swaps seats immediately"`
