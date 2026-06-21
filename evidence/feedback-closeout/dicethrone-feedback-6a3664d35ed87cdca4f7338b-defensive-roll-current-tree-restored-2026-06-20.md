# Dice Throne 线上反馈 6a3664d35ed87cdca4f7338b 当前树核对

- 时间：2026-06-20
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-20T10-02-27-163Z/6a3664d35ed87cdca4f7338b.md`
- 反馈含义：watchdog 在防御掷骰阶段尝试补 `ADVANCE_PHASE` 时，被服务端拒绝为 `not_active_player`。

## 本轮结论

- 归类：当前树已恢复
- 现实含义：当前 transport/server 链已经允许防御方在 `defensiveRoll` 推进阶段，也不会让 watchdog 在这个位点继续误报。

## 证据

- 历史收口文档：
  - `evidence/feedback-closeout/dicethrone-feedback-6a350509-defensive-roll-not-active-player-current-tree-restored-2026-06-19.md`
- 本轮复核命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 -t "Dice Throne 服务端在 defensiveRoll 应允许防御方执行 ADVANCE_PHASE|active-turn:follow-up-advance:command_failed:ADVANCE_PHASE:not_active_player"`
- 结果：
  - 通过
  - 说明当前树已覆盖这条 watchdog 反馈的真实位点

## 说明

- 本轮未新增 Dice Throne 代码修改。
- 结论是：这条代表项是当前树已恢复的系统反馈，不再把它当成现存未修 bug 推进。
