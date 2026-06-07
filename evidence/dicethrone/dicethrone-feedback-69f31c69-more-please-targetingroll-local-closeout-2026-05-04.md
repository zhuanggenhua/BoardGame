# Dice Throne 反馈 69f31c69 本地验收收口说明（2026-05-04）

> 2026-06-06 当前有效口径：本文只对应反馈 `69f31c695cacc4e6b5cdb992` 这一条 `More Please` / `targetingRoll` 的本地 closeout 记录，不是当前 DiceThrone 所有攻击修正卡、所有自动目标窗口问题都已彻底收口的证明，也不是新英雄补审出口。阅读时只能把它当作单条反馈的历史验收记录。

## 反馈原文

- `再来点这张卡自己整个回合都用不了`

线上反馈对应：

- feedbackId：`69f31c695cacc4e6b5cdb992`
- gameId：`dicethrone`
- route：`/play/dicethrone/match/DtXXFW7CXwJ?playerID=0`
- appVersion：`android`

## 已有权威审计

- `evidence/dicethrone-4p-attack-modifier-targeting-roll-audit-2026-04-30.md`

该审计文档已经直接点名：

- 线上真实反馈时间：`2026-04-30T09:10:01.709Z`
- 线上真实反馈原文：`再来点这张卡自己整个回合都用不了`

## 根因

- 这是 4 人 `targetingRoll` 自动目标窗口里的旧门禁缺口，不是“整回合都不能用”。
- 旧实现把攻击修正卡能否使用死绑在 `pendingAttack.defenderId` 是否已写回。
- 但 `1/2/3/4` 自动目标分支里，目标其实已经由方向规则确定，只是 `defenderId` 要到退出 `targetingRoll` 时才持久化。
- 结果就是像 `barbarian / card-more-please` 这类攻击修正卡，会在这个短窗口被误判为“还没选目标，不能打”。

## 当前现场

生产快照末尾已经回到当前用户自己的 `main1`：

- `sys.phase = main1`
- `sys.flowHalted = false`
- `interaction.queue = []`
- `pendingAttack = null`

说明现场不是仍在卡死，而是反馈记录保留了用户曾遭遇的旧行为；当前代码基线下该链已经闭合。

## 本地验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts --configLoader native --maxWorkers 1 --testNamePattern "攻击修正卡可在 defenderId 写回前直接结算到自动目标|4 人模式 targetingRoll 自动目标后，Loaded token 的奖励骰特写应命中自动目标"`

结果：

- `flow.test.ts`：`1 file passed / 2 tests passed`

## 收口结论

- 按当前任务口径，`resolved` 表示“本地已经修好并完成本地验收”，不代表已上传/已上线。
- 本条已有专项审计直接对位同一反馈原文，且当前代码基线下相关聚焦回归复跑通过，因此可按本地验收转 `resolved`。

---

**当前阅读说明**：本文只能证明 `card-more-please` 在 `targetingRoll` 自动目标窗口里被误禁用这条专项问题曾按本地验收收口，不能外推为当前所有攻击修正卡、所有自动目标分支或 DiceThrone 当前整体审计都已收口。
