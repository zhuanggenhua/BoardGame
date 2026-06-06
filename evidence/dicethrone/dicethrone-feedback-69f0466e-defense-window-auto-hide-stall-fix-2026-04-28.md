# Dice Throne 反馈 69f0466e 修复证据（2026-04-28）

> 2026-06-06 当前有效口径：本文只对应反馈 `69f0466e...` 这一条“防御窗口一闪而过后卡住”的历史专项修复证据，不是当前 DiceThrone 所有 defense window / auto-response / defensive stall 问题都已收口的证明，也不是新英雄补审出口。阅读时只能把它当作单条反馈修复记录。

## 反馈来源
- 线上反馈源。
- 通过 `ssh admin@8.148.71.102` 进入生产机，再执行 `docker exec -i boardgame-mongodb mongosh --quiet boardgame` 查询 `feedbacks` 集合确认。
- 线上原始内容：`自己的防御窗口弹出后没来及点就消失了，然后就一直卡住`。

## 根因
- `Dice Throne` 领域层在决定是否创建响应窗口时，错误读取了前端本地 `autoResponse` 开关。
- 这导致权威状态和前端渲染口径混在一起：
  - 服务端/领域层有时根本不创建可操作的响应窗口。
  - 前端又会把“马上自动 pass 的自响应提示”当成真实窗口渲染出来。
- 结果就是玩家看到防御窗口一闪而过，随后状态卡住。

## 修复
- 在 [execute.ts](D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\execute.ts)、[executeCards.ts](D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\executeCards.ts)、[flowHooks.ts](D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\flowHooks.ts) 中移除领域层对前端本地 `autoResponse` 的读取。
- 在 [Board.tsx](D:\gongzuo\webgame\BoardGame\src\games\dicethrone\Board.tsx) 中把“可手动操作的自响应窗口”与“仅用于自动跳过的提示态”拆开，避免把自动 pass 提示渲染成可操作窗口。

## 验证
- `npx vitest run src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts src/games/dicethrone/__tests__/flick-defensive-phase.test.ts src/engine/transport/__tests__/server.test.ts`
- `npm run typecheck`

## 结果
- 响应窗口是否创建重新回到权威游戏逻辑决定，不再受 `localStorage` 影响。
- 自动跳过模式只影响前端提示，不再制造“窗口一闪而过后卡住”的假窗口链路。

## 风险
- 本次没有补 E2E 截图，只做了定向单测/集成回归。
- 但已覆盖防御阶段、响应窗口锁、服务端传输三条相关链路。

---

**当前阅读说明**：本文只能证明“防御窗口自动隐藏后卡住”这条专项问题曾被修复，不能外推为当前所有 defense window、所有 auto-response 交互或 DiceThrone 当前整体审计都已收口。
