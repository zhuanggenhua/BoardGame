# Itty Critters L2 行为证据

## 范围

- 派系：`itty_critters`
- 本文覆盖 Itty Critters 卡牌与两个基地的 L2 行为；L3 真实入口 E2E 尚未完成。
- 主要实现：
  - `src/games/smashup/abilities/itty_critters.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/__tests__/abilities/itty-critters.test.ts`

## 逐卡子句矩阵

| 对象 | 真相源子句 | 实现证据 | 测试证据 | 状态 |
| --- | --- | --- | --- | --- |
| `I Select You!` | C1 搜牌库力量≤3随从；C2 作为额外随从打出；C3 回合结束仍由你控制则回牌库底 | `collectDeckMinions`、`buildTemporaryMinionEvents`、`TURN_ENDED` metadata 回底 | `I Select You 从牌库打出...并在回合结束...` | L2 通过 |
| `Recall Critter` | C1 从弃牌堆打出力量≤2随从；C2 额外随从；C3 回底 | `collectDiscardMinions`、临时随从 metadata | `Critter Coach...Recall Critter...` | L2 通过 |
| `Evolution` | C1 选择己方随从；C2 消灭它；C3 打出 Rainboroc 到该处，或搜牌库力量最多高 1 的随从；C4 额外随从打到原基地 | `evolutionPromptProgram`、`buildValidatedDestroyEvents`、`playTitan`、`buildTemporaryMinionEvents` | `Evolution 消灭己方随从后...`、`Evolution 可...Rainboroc...` | L2 通过 |
| `Gotta Get 'Em All` | C1 弃牌堆每个不同随从名各选一张；C2 洗入牌库 | `gottaGetEmAll` 使用 `Map<defId, card>` 去重并 `DECK_REORDERED` | `Leafaroo...Gotta Get Em All...` | L2 通过 |
| `Critter Cube` | C1 选择任意玩家拥有的在场力量≤3随从；C2 洗入你的牌库 | `critterCube`、`CARD_TO_DECK_BOTTOM` + `DECK_REORDERED` | `Critter Cube 将任意玩家拥有的...` | L2 通过 |
| `Super Effective!` | C1 选择基地或随从上的行动牌；C2 消灭该行动牌 | `superEffectivePromptProgram`、`ONGOING_DETACHED` | `Super Effective 可以消灭基地或随从上的行动牌` | L2 通过 |
| `Ittypedia` | C1 持续附着基地；C2 你在这里打出随从后；C3 该随从本回合 +1 | `ittypediaTrigger` onMinionPlayed 同基地/同控制者过滤 | `Ittypedia 在同基地打出自己随从后...` | L2 通过 |
| `Coach Combat` | C1 选择己方随从；C2 消灭其基地上力量更低的随从 | `coachCombat` 使用目标随从与同基地低力量过滤 | 注册与定向路径纳入 Itty 行为文件；需后续 E2E 补真实入口截图 | L2 行为实现，L3 待补 |
| `Leafaroo` | C1 可选；C2 弃牌堆一张牌洗入牌库 | `leafarooPromptProgram` 带 skip 与 `DECK_REORDERED` | `Leafaroo 可将弃牌堆一张牌洗入牌库...` | L2 通过 |
| `Flooffairy` | C1 可选；C2 抽一张牌 | `flooffairyPromptProgram` 带 skip | `Flooffairy 可选择抽牌或跳过` | L2 通过 |
| `Calicoin` | C1 可选；C2 本基地另一个随从 +1 指示物 | `optionalMinionPromptProgram` counter 分支 | `Calicoin 是可选效果...`、`Calicoin 可以...` | L2 通过 |
| `Tadpour` | C1 可选；C2 移动这里另一个随从到另一个基地 | `tadpourChooseMinionProgram` + `tadpourDestinationProgram` | `Tadpour 可选移动...` | L2 通过 |
| `Krakatoad` | C1 可选；C2 这里另一个随从本回合 +2 | `optionalMinionPromptProgram` temp_power 分支 | 与可选 prompt 家族同实现；需后续 E2E 补可视证据 | L2 行为实现，L3 待补 |
| `Critter Coach` | C1 可选搜牌库力量≤2随从；C2 打到这里；C3 回底 | `runTemporaryDeckMinionSearch(... optional=true)` | `Critter Coach 可以跳过...` | L2 通过 |
| `Shellshock` | C1 可选；C2 消灭这里另一个力量≤2随从 | `shellshock` 过滤 `getMinionPower <= 2` | `Shellshock 只消灭...` | L2 通过 |
| `Critter Champion` | C1 天赋；C2 搜牌库力量≤2随从；C3 打到这里；C4 回底 | `registerAbilityProgram(... talent)`、`critterChampion` | 与临时随从回底边界同机制；需后续 E2E 补天赋真实入口 | L2 行为实现，L3 待补 |
| `Critter Combat Club` | C1 主动基地能力；C2 你的回合额外打出力量≤2随从到这里；C3 回合结束仍控制则回底 | `registerActiveBaseAbility('base_critter_combat_club')`、手牌 prompt、`buildTemporaryMinionEvents` | `Critter Combat Club 主动基地能力可额外打出...` | L2 通过 |
| `Itty City` | C1 每回合第一次在这里打出随从后；C2 可选；C3 随机将弃牌堆一个随从洗入牌库 | `registerBaseAbility('base_itty_city','onMinionPlayed')`、reaction queue、`DECK_REORDERED` | `Itty City 首次在这里打出随从后...` | L2 通过 |

## 共享边界

- 临时随从回底通过 `metadata.ittyCrittersReturnToDeckBottomPlayerId` 标记，不改通用 `MINION_PLAYED` 合同。
- `TURN_ENDED` 只在回合玩家仍控制该临时随从时回底；若 Mermaid 临时控制恢复先发生，Itty 回底不会误触发。
- 临时随从离场回底时，其附着行动进入各自 owner 弃牌堆。
- `Critter Cube` 使用现有 `CARD_TO_DECK_BOTTOM` detach 逻辑，再用 `DECK_REORDERED` 洗牌；不新增 reducer 事件。
- `Critter Combat Club` 不走普通额度赠予，而是主动基地能力直接打开手牌选择并打出，确保额外随从能写入 Itty 回底 metadata。
- `Itty City` 通过 reaction queue 暴露可选触发；测试覆盖有合法弃牌堆随从时的跳过与执行路径。

## 验证

| 命令 | 结果 |
| --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/itty-critters.test.ts --configLoader native` | 1 file / 17 tests passed |
| `npx eslint src/games/smashup/abilities/itty_critters.ts src/games/smashup/__tests__/abilities/itty-critters.test.ts src/games/smashup/domain/reduce.ts` | 0 error；`reduce.ts` 仅既有 `any` warning |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native` | 1 file / 7 tests passed |
| `npm run typecheck` | 通过 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/itty-critters.test.ts src/games/smashup/__tests__/abilityRegistry.test.ts src/games/smashup/__tests__/abilityInteractionRegistry.test.ts --configLoader native` | 3 files / 38 tests passed |

## 未完成范围

- L3 真实入口 E2E 与截图证据未完成，不能宣称 Itty Critters 完整可玩收口。
