# Dice Throne 反馈 69f21b05 历史本地验收收口说明（2026-05-04）

> 2026-06-06 当前有效口径：本文只保留 `69f21b05ab54eadcc2bb2b9e` 这条 `targetingRoll + Loaded + bonus die` 卡死反馈的历史本地收口证据，不代表 DiceThrone 全体 targetingRoll / watchdog / bonus die 链、任一单英雄，或四位新英雄整批当前已经审计完成。它现在只能证明当时这条同根因簇反馈在本地被对位验证过，不能外推成 DiceThrone 当前总体收口。

## 反馈原文

- `ai卡死且无法强制结束`

线上反馈对应：

- feedbackId：`69f21b05ab54eadcc2bb2b9e`
- gameId：`dicethrone`
- route：`/play/dicethrone/match/WJK2erZuw3D?playerID=0`
- appVersion：`android`

## 线上现场能确认到什么

- 前端错误噪音仍然存在：`"AppUpdate" plugin is not implemented on android`
- `sys.phase = targetingRoll`
- `sys.flowHalted = true`
- `sys.interaction.isBlocked = true`
- `sys.interaction.queue.length = 0`
- `core.pendingAttack` 现场停在枪手 `revolver-5`：
  - `attackerId = 3`
  - `defenderId = 0`
  - `targetingSelectionPending = false`
  - `targetingSelectionResolved = true`
  - `offensiveRollEndTokenResolved = true`

## 末尾事件链

生产快照末尾事件直接显示这不是泛化“AI 发呆”，而是 `targetingRoll` 选目标后叠加 `Loaded` / bonus die 的收口链：

1. `CHOICE_REQUESTED`：`targeting-roll`
2. `SYS_INTERACTION_RESOLVED`
3. `CHOICE_RESOLVED`
4. `ATTACK_PRE_DEFENSE_RESOLVED`
5. `CHOICE_REQUESTED`：`offensiveRollEndToken.title`
6. `SYS_INTERACTION_RESOLVED`
7. `CHOICE_RESOLVED`
8. `BONUS_DIE_ROLLED`
9. `BONUS_DICE_REROLL_REQUESTED`
10. 再次出现 `CHOICE_REQUESTED`，随后现场落成 `targetingRoll + flowHalted + blocked + empty queue`

这说明问题点不是普通 UI 卡住，而是枪手 `Loaded` / bonus die 结算与 `targetingRoll` 推进链叠在一起后，交互可见性和 watchdog 收口链发生了脱节。

## 与已收口问题的关系

- 与 `69f5be8c9ec13b96d710baa4` 属于同一类 DiceThrone `displayOnly / pendingBonusDiceSettlement / hidden response` 收口链问题。
- 与 `69f042109b68d90ee98368fa` 同样共享 `targetingRoll` 推进缺口与 Android `AppUpdatePlugin` 噪音。
- 因此本条不是新的独立根因簇，而是已完成本地修复的重复现场。

## 本地验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts --configLoader native --maxWorkers 1 --testNamePattern "4 人模式 targetingRoll 选目标交互意外丢失后，再次推进应重建交互而不是静默卡住|4 人模式 targetingRoll 掷出 5 时由防守队选择目标|4 人模式 targetingRoll 掷出 6 时由进攻方选择目标|targetingRoll 无可选目标时 emergency skip 会清理 pendingAttack 并推进到 main2"`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留|dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口|DiceThrone afterCardPlayed 存在 pendingInteractionId 锁时，应优先检查 hidden interaction 而不是退成 RESPONSE_PASS|online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口|dicethrone: displayOnly pendingBonusDiceSettlement 遇到响应窗口 + 交互链时，watchdog 应持续收口且不误打 bonus-die 命令"`

结果：

- `flow.test.ts`：`1 file passed / 4 tests passed`
- `server.test.ts`：`1 file passed / 5 tests passed`

## 收口结论

- 按当前任务口径，`resolved` 表示“本地已经修好并完成本地验收”，不代表已上传/已上线。
- 本条具备：
  - 生产现场快照；
  - 与已收口同根因簇的明确对位；
  - 当前代码基线下的本地聚焦回归通过。
- 因此本条可以按本地验收转 `resolved`。

## 当前阅读说明

- 本文只覆盖一条历史 targetingRoll / Loaded / bonus die 反馈链，不覆盖更广范围 DiceThrone 在线对局或新英雄整批完成态。
- 文中的 `resolved` 只代表当轮本地验收收口，不是当前 DiceThrone 总审计出口。
