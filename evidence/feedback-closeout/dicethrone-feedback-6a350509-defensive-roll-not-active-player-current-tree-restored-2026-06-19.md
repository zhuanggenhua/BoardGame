# Dice Throne 线上反馈 6a3505095ed87cdca4f72003 收口证据

## 时间与口径

- 处理时间：`2026-06-19 20:44 +08:00`
- 反馈来源：线上真实反馈接口 `https://api.easyboardgame.top/admin/feedback`
- 反馈 ID：`6a3505095ed87cdca4f72003`
- 游戏：Dice Throne

## 原始症状

- 系统自动反馈记录的是：在线 AI watchdog 在防御掷骰阶段尝试补最后一步阶段推进时，被服务端拒绝为“当前玩家不是允许推进的人”（`ADVANCE_PHASE:not_active_player`）。
- 反馈自带的真实状态快照显示：
  - 当前阶段是防御掷骰（`defensiveRoll`）
  - 当前处理座位是 `1`
  - 当前玩家 ID 也是 `1`
  - 当时 AI 可见合法动作是 `0` 个，因此 watchdog 才进入补推进链路

## 真实含义

- 这类反馈不是普通“AI 不会出牌”，而是**防御方推进防御阶段**时，被通用“当前玩家”守卫误拦。
- 关键点在于 Dice Throne 的 `defensiveRoll` 阶段，允许推进的人可能是防御方，而不一定是攻击方或通用 `currentPlayerIndex` 所代表的人。

## 当前树核对结果

- 当前代码树里已经有两层针对性回归，且本次都通过：
  1. 服务端回归：`defensiveRoll` 阶段允许防御方执行 `ADVANCE_PHASE`
  2. watchdog 回归：当 AI 实际是防御方、且 legal-only fallback 只能补 `ADVANCE_PHASE` 时，不再被误拒成 `not_active_player`

- 因此，这条反馈在当前树上的结论不是“本轮再次复现并新修复”，而是**当前树已恢复**。

## 验证

已通过定向回归：

```powershell
pnpm vitest run src/engine/transport/__tests__/server.test.ts --configLoader native -t "Dice Throne 服务端在 defensiveRoll 应允许防御方执行 ADVANCE_PHASE|Dice Throne watchdog 在 defensiveRoll 实际操作者是 AI 防御方时，legal-only fallback 的 ADVANCE_PHASE 不应再被通用 current player guard 误拦|online AI watchdog 在 defensiveRoll 实际由 human 防御方行动时，不应误对 AI 攻击方执行 force-end-turn|active-turn:follow-up-advance:command_failed:ADVANCE_PHASE:not_active_player"
```

验证结果：

- 服务端允许 `1` 号位防御方在 `defensiveRoll` 执行 `ADVANCE_PHASE`
- watchdog 在 AI 防御方场景里能成功补推进，并上报成功收口，而不是继续报 `not_active_player`
- 人类防御方场景下也不会误对 AI 攻击方发起 watchdog 强推

## 结论

- 该反馈属于**已用真实反馈状态快照锁定链路，但当前树下验证为已恢复**。
- 本轮没有新增 Dice Throne 代码修改；结论是“当前代码已覆盖这条反馈的真实位点”，不再把它当成现存未修 bug 继续推进。
- 本证据只证明“当前树已恢复 + 本地回归成立”，不代表远端反馈状态已成功回写。
