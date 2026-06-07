# Dice Throne 反馈 69f2a81c 本地验收收口说明（2026-05-04）

> 2026-06-06 当前有效口径：本文只对应反馈 `69f2a81c5cacc4e6b5cdb4e5` 这一条本地 closeout 记录，不是当前 DiceThrone 所有 token modal / hidden interaction / pendingInteractionId 问题都已彻底收口的证明，也不是新英雄补审出口。阅读时必须把它理解成单条反馈的历史验收记录。

## 反馈原文

- `弹窗选择目标，然后弹token弹窗，token弹窗要点两次，选择目标没恢复`

线上反馈对应：

- feedbackId：`69f2a81c5cacc4e6b5cdb4e5`
- gameId：`dicethrone`
- route：`/play/dicethrone/match/f3UvWvktP5v?playerID=0`
- appVersion：`production`

## 线上现场

生产快照不是卡死终态，而是已经正常收口后的状态：

- `sys.phase = main2`
- `sys.flowHalted = false`
- `sys.interaction.isBlocked = false`
- `sys.interaction.queue.length = 0`
- `core.pendingAttack = null`

末尾事件顺序为：

1. `ROLL_CONFIRMED`
2. `RESPONSE_WINDOW_OPENED`
3. `RESPONSE_WINDOW_CLOSED`
4. `TOKEN_GRANTED`
5. `DAMAGE_DEALT`
6. `ATTACK_DEFENSE_RESOLVED`
7. `TOKEN_RESPONSE_REQUESTED`
8. `TOKEN_USED`
9. `TOKEN_RESPONSE_CLOSED`
10. `DAMAGE_DEALT`
11. `ATTACK_RESOLVED`
12. `SYS_PHASE_CHANGED(defensiveRoll -> main2)`

这说明现场已经证明“目标选择 -> token 响应 -> 伤害结算 -> 回到 main2”这条链是能完整收口的。

## 与已修问题的关系

- 用户描述的“token 弹窗要点两次、选择目标没恢复”对应的就是 DiceThrone `pendingInteractionId / hidden response / token response` 一组老问题。
- 当前工作区已经补过：
  - hidden interaction 优先收口；
  - `pendingInteractionId` 锁场景不再错误退成 `RESPONSE_PASS`；
  - `displayOnly / pendingBonusDiceSettlement` 与响应窗口并存时 watchdog 持续收口。
- 本条快照最终态与上述修复后的预期完全一致，因此按“已修未回写”处理。

## 本地验证

- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "DiceThrone afterCardPlayed 存在 pendingInteractionId 锁时，应优先检查 hidden interaction 而不是退成 RESPONSE_PASS|online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口|dicethrone: displayOnly pendingBonusDiceSettlement 遇到响应窗口 + 交互链时，watchdog 应持续收口且不误打 bonus-die 命令"`

结果：

- `server.test.ts`：聚焦回归通过

## 收口结论

- 按当前任务口径，`resolved` 表示“本地已经修好并完成本地验收”，不代表已上传/已上线。
- 本条反馈与现有修复簇一致，且生产快照已经显示链路正常收口到 `main2`，因此可按本地验收转 `resolved`。

---

**当前阅读说明**：本文只能证明这条 `token modal / target restore` 反馈曾按本地验收收口，不能外推为当前所有 token 响应链、所有 hidden interaction 场景或 DiceThrone 当前整体审计都已收口。
