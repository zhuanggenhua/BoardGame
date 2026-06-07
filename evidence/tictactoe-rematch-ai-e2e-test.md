# 井字棋 AI 重赛自动同意 E2E 证据

## 范围

- 场景：在线井字棋人机房，玩家 0 对 AI 座位 1。
- 目标：人类玩家只点击一次“再来一局”，AI 座位自动同意重赛，页面进入新房间，并保留上一局 AI 配置。

## 验证命令

- `npm run typecheck`
- `npx vitest run src/hooks/__tests__/useLobbyMatchPresence.test.ts src/components/game/framework/widgets/__tests__/RematchActions.test.tsx`
- `npx eslint server.ts src/services/matchSocket.ts src/contexts/RematchContext.tsx src/pages/MatchRoom.tsx src/services/matchApi.ts`
- `npx eslint e2e/tictactoe-rematch-ai.e2e.ts`
- `npm run test:e2e:ci:file -- e2e/tictactoe-rematch-ai.e2e.ts`

## 截图核对

### 触发前

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\tictactoe-rematch-ai\01-ai-rematch-before-click.png`
- 我实际看到：页面停在井字棋结束态，棋盘上已有胜负结果，胜利浮层展示“恭喜获胜”，下方能看到“再来一局”和“返回大厅”按钮。
- 是否达到验收标准：达到触发前验收标准；截图能证明这是在线对局结束后的真实“再来一局”入口，不是大厅或独立预览页。

### 自动同意后进入新房

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\tictactoe-rematch-ai\02-ai-rematch-new-room.png`
- 我实际看到：点击一次“再来一局”后，URL 已切换到新的井字棋 match，棋盘回到空白新局状态；玩家栏仍显示人类玩家与 AI 座位，说明新房保留了人机配置。
- 是否达到验收标准：达到本轮验收标准；截图和接口断言共同证明 AI 座位已自动同意重赛，新房 `setupData.enableAi` 为 `true`，`seatControllers['1'].type` 为 `local-ai`。

## 结论

- 旧问题成立：AI 座位原本不会在在线重赛投票里自动同意，因此人机房会等待第二票。
- 本轮已改为：客户端把 AI 座位列表传入重赛 channel，服务端只对当前 match 中真实 AI seat 自动投同意票；真人房仍保持双方投票。
- 新房创建时会复用上一局 AI 配置，并通过当前 token 或 guestId 重建 owner 信息。
