# Dice Throne watchdog 收口（ADVANCE_PHASE:not_active_player）

## 范围

- 游戏：`dicethrone`
- 反馈对象：
  - `6a2fee6ec1f9d45aea62b9e6`
  - `6a2fea9ac1f9d45aea62b9cb`
  - `6a2fea98c1f9d45aea62b9c3`
  - `6a2fd8adc1f9d45aea62b92a`
  - `6a2fd8a9c1f9d45aea62b922`
  - `6a2fd4d9c1f9d45aea62b91a`
  - `6a2fd4d6c1f9d45aea62b912`
  - `6a2fd3d3c1f9d45aea62b909`
  - `6a2f9d03c1f9d45aea62b7fb`
  - `6a2f9cfec1f9d45aea62b7f3`
  - `6a2f9b57c1f9d45aea62b7eb`
  - `6a2f9b51c1f9d45aea62b7e3`
- 反馈原文一致：
  - `[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed:ADVANCE_PHASE:not_active_player`

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet boardgame` -> `boardgame.feedbacks`
- 回写前状态快照：
  - `temp/feedback-closeout/query-feedback-dicethrone-watchdog-advance-phase-before-writeback-20260615.raw.txt`
  - `temp/feedback-closeout/query-feedback-6a2fee6e-before-writeback-20260615.raw.txt`
- 回写结果：
  - `temp/feedback-closeout/update-feedback-status-20260615-dicethrone-watchdog-advance-phase-to-resolved.raw.txt`
  - `temp/feedback-closeout/update-feedback-status-20260615-6a2fee6e-to-resolved.raw.txt`
- 回写后状态快照：
  - `temp/feedback-closeout/query-feedback-dicethrone-watchdog-advance-phase-after-writeback-20260615.raw.txt`
  - `temp/feedback-closeout/query-feedback-6a2fee6e-after-writeback-20260615.raw.txt`
- 最终 open/in_progress 复核：
  - `temp/feedback-closeout/query-feedback-qidahen-dicethrone-open-final-20260615.raw.txt`

## 反馈真相

- 这批反馈都来自线上 watchdog 对真实对局失败的自动上报，不是人工猜测。
- 回写前快照表明，同症状在多个对局重复出现：
  - `matchId: Ef2KHKEtPaZ`
  - `matchId: pETNRXNSqrn`
  - `matchId: ynzZGlUv1iN`
  - `matchId: kVPL7Fy_TLH`
  - `matchId: 4rw45QP18MN`
- 共同表现是：Dice Throne 在防御结算链路里，推进阶段命令 `ADVANCE_PHASE` 被服务端按“不是当前行动玩家”拒绝。
- 这说明它是**真实发生过的业务问题**，不是误报；只是当前仓库代码已经把问题覆盖掉了，而生产反馈状态此前没有回写。

## 当前实现与验证

- 本轮已补回归测试：
  - `src/engine/transport/__tests__/server.test.ts`
  - 用真实 `dicethrone` engine + `executeCommandInternal` 验证：
    - `defensiveRoll` 阶段应允许防御方执行 `ADVANCE_PHASE`
- 定向测试：
  - `npx vitest run src/engine/transport/__tests__/server.test.ts -t "Dice Throne 服务端在 defensiveRoll 应允许防御方执行 ADVANCE_PHASE"`
- 结果：
  - `1 passed`
- 当前含义：
  - 说明**当前仓库实现**已经覆盖这类拒绝问题。
  - 但本轮没有部署证据，所以不能把它说成“线上现运行版本已验证无此问题”。

## 生产反馈状态

### 1. 回写前

- 首批同症状 open 单共 `11` 条。
- 最终复核时又发现同症状新增/遗漏 `1` 条：`6a2fee6ec1f9d45aea62b9e6`。
- 因此本轮实际收口总数为 `12` 条。

### 2. 回写执行

- 目标状态：`resolved`
- 第一批回写结果：
  - `matchedCount=11`
  - `modifiedCount=11`
  - `updatedAt=2026-06-15T13:06:00.000Z`
- 复核补回写结果：
  - `matchedCount=1`
  - `modifiedCount=1`
  - `updatedAt=2026-06-15T13:12:00.000Z`

### 3. 回写后

- `query-feedback-dicethrone-watchdog-advance-phase-after-writeback-20260615.raw.txt` 已显示这 `12` 条全部为 `status: resolved`。
- `query-feedback-qidahen-dicethrone-open-final-20260615.raw.txt` 复核结果为 `[]`，说明本轮目标范围内已无 `open / in_progress` 残留。

## 收口结论

- 上述 `12` 条 Dice Throne watchdog：`resolved`
- 理由：
  - 它们对应的是线上真实发生过的业务失败，不应写成 `closed`。
  - 当前已经具备 `生产真源命中 + 当前实现回归通过 + 生产真源回写 + 最终 open 清空复核`。
  - 这批单子的现实含义是“历史 bug 已被当前代码覆盖，但反馈状态未同步”，所以合适的收口状态是 `resolved`。
- 当前边界：
  - 本轮没有部署证据，不能把结论表述成“当前线上运行包已完成同链路复测”。
