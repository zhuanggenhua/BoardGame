# Dice Throne 线上反馈 6a36ee8d0bd730b192833e48 当前树核对

- 时间：2026-06-21
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-20T23-48-02-475Z/6a36ee8d0bd730b192833e48.md`
- 反馈含义：watchdog 在防御掷骰阶段尝试补 `ADVANCE_PHASE` 时，被服务端拒绝为 `not_active_player`。

## 本轮结论

- 归类：当前树已恢复
- 现实含义：这条代表项与先前已经核对过的 `6a3664d35ed87cdca4f7338b`、`6a3505095ed87cdca4f72003` 属于同一类防御阶段推进被误拒问题；当前 transport/server 链已经允许防御方在 `defensiveRoll` 推进阶段，不再把这组 watchdog 当成现存未修 bug。

## 证据

- 历史同根因文档：
  - `evidence/feedback-closeout/dicethrone-feedback-6a3664d35ed87cdca4f7338b-defensive-roll-current-tree-restored-2026-06-20.md`
  - `evidence/feedback-closeout/dicethrone-feedback-6a350509-defensive-roll-not-active-player-current-tree-restored-2026-06-19.md`
- 本轮复核命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 -t "Dice Throne 服务端在 defensiveRoll 应允许防御方执行 ADVANCE_PHASE|active-turn:follow-up-advance:command_failed:ADVANCE_PHASE:not_active_player"`
- 结果：
  - 通过

## 收口说明

- 本轮未新增 Dice Throne 代码修改。
- 这条反馈的处理动作是补当前代表项的核对证据与状态回写，不是再次修改业务逻辑。
