# Smash Up 本地反馈收口：破胸者天赋

- 反馈 ID：`6a88f028aacaa8f27ab581a1`
- 本轮口径：本地数据库反馈，来源 `mongodb://127.0.0.1:27017/boardgame.feedbacks`
- 反馈原文：`破胸者不对啊，第一是语义实现不全，是回合开始时就在有基地的地方才能用效果，第二是效果实现不全，没有进牌库底`
- 目标对象：Smash Up / 异形变体 / 破胸者（`extramorphs_chestbreaker`）

## 原始症状保真

玩家指出两条规则实现缺口：

1. 破胸者的天赋不是随时能用，必须是该随从在本回合开始时已经位于基地上。
2. 发动效果时，破胸者自身必须进入拥有者牌库底。

本轮没有把“回合开始时已在基地上”改写为自动回合开始触发；牌文仍是出牌阶段主动天赋，只是发动条件包含回合开始时已在场。

## 规则合同

本地规则录入证据位于 `evidence/smashup/2026-07-25-excellent-movies-teens-intake-contract-draft.md`：

> Chestbreaker: Talent: If this minion was on a base at the start of the turn, place it on the bottom of your deck to choose power 3 or 4 and play an extra minion of that power off the top of your deck here.

拆成实现断言：

- 使用窗口：出牌阶段主动天赋。
- 发动条件：该破胸者在本回合开始时已经在某个基地上；同回合刚打出的破胸者不能发动。
- 成本 / 效果：破胸者自身放到拥有者牌库底。
- 后续效果：选择 3 或 4 力，并把该力量的一个额外随从从牌库顶打出到此基地。

## 实现问题

当前实现 `src/games/smashup/abilities/excellent_movies_teens.ts` 只做了牌库顶额外随从机会：

- 会按牌库中 3 或 4 力随从授予额外从牌库顶打出机会。
- 没有在命令校验层拒绝“本回合刚打出的破胸者”。
- 没有生成 `CARD_TO_DECK_BOTTOM` 事件把破胸者自身放到牌库底。

这能直接解释反馈形状：玩家可以在不满足“回合开始时已在基地”的情况下使用；使用后破胸者仍留在基地上。

## 修复

修改 `src/games/smashup/abilities/excellent_movies_teens.ts`：

- 为 `extramorphs_chestbreaker` 的 `talent` 增加 `validateUse`：当场上实例带有 `playedThisTurn === true` 时，命令层直接拒绝，玩家提示为“破胸者必须在本回合开始时已经位于基地上才能使用”。
- 发动成功时继续授予限定额外随从机会，同时使用 `buildValidatedCardToDeckBottomEvents(... expectedLocation: 'bases')` 生成牌库底移动事件。
- 事件顺序保留当前牌库重排机制：先授予/置顶可打出的牌库顶随从机会，再把破胸者放到牌库底，避免 `DECK_REORDERED` 使用发动前牌库快照时覆盖新进入牌库底的破胸者。

修改 `src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts`：

- 新增“同回合刚打出时不能使用天赋”负向断言。
- 扩展合法发动路径：断言 `CARD_TO_DECK_BOTTOM` 出现、破胸者离开基地并位于牌库底，随后指定额外随从仍可从牌库顶打出到原基地。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts --configLoader native`
  - 结果：1 file passed，60 tests passed。
  - stderr 中的 `su:use_talent` 验证失败是新增负向测试的预期拒绝，不是测试失败。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts --configLoader native`
  - 结果：1 file passed，14 tests passed。

## 收口结论

这是实现消费规则合同不完整导致的真实规则 bug。当前代码已补上发动条件和牌库底移动，测试覆盖反馈两条原始断言；本地反馈记录可回写为已关闭，并说明玩家无需额外操作。
