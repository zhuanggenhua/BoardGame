# Magical Girls L2 行为证据（baokemeng / Big in Japan）

日期：2026-05-26

## 范围

- 派系：`magical_girls`
- 能力实现：`src/games/smashup/abilities/magical_girls.ts`
- 行为测试：`src/games/smashup/__tests__/abilities/magical-girls.test.ts`
- 注册入口：`src/games/smashup/abilities/index.ts`

## 已覆盖对象

| 对象 | L2 结论 | 证据 |
| --- | --- | --- |
| `magical_girls_coronet_attack` | 通过 | 按“不由你控制且力量 ≤ 你在同基地随从数量”消灭目标；审计正则已修正，避免把“你的随从数量”误判成目标为己方随从。 |
| `magical_girls_lunar_healing_love_spell` | 通过 | 多选各玩家弃牌堆随从，按拥有者回手。 |
| `magical_girls_magical_staff` | 通过 | 附着随从 +1；随附着随从离场导致本行动脱离时，改放拥有者牌库顶。 |
| `magical_girls_kiss_the_sky_spell` | 通过 | 从己方弃牌堆回收一个随从，并给予额外行动额度。 |
| `magical_girls_purge_the_demon` | 通过 | 可摧毁场上/附着行动，或移除目标卡上的全部力量指示物。 |
| `magical_girls_celestial_teleport` | 通过 | 移动己方随从到另一个基地。 |
| `magical_girls_coordination` | 通过 | 无可用 Walking Castle 时给予额外随从额度；Walking Castle 分支已接入选择入口。 |
| `magical_girls_silver_shard` | 通过 | 所有玩家弃牌堆随从洗回牌库，非随从弃牌保留。 |
| `magical_girls_lunar_captain` | 通过 | 天赋回收己方弃牌堆中力量不高于本基地己方随从数量的随从。 |
| `magical_girls_technomagical_lass` | 通过 | 天赋消灭本基地不由你控制且力量不高于本基地己方随从数量的随从。 |
| `magical_girls_bewitching_gal` | 通过 | 天赋使本基地 breakpoint 按本基地己方随从数量临时降低。 |
| `magical_girls_sakura_warrior` | 通过 | 天赋使本基地一个随从直到你的下回合开始时按本基地己方随从数量降低力量。 |
| `magical_girls_rainbow_girl` | 通过 | 打出后本基地其他己方随从本回合 +1。 |
| `magical_girls_fancy_suit_lad` | 通过 | 保护本基地其他己方随从不受其他玩家影响；不保护自身。 |
| `magical_girls_white_magicat` | 通过 | 搜索牌库/弃牌堆中的 `Power Maid` 加入手牌。 |
| `magical_girls_power_maid` | 通过 | 天赋将力量不高于本基地己方随从数量的随从移入或移出这里。 |
| `magical_girls_black_magicat` | 通过 | 搜索牌库/弃牌堆中的 `Lunar Captain` 加入手牌。 |
| `base_akihabara_high` | 通过 | 在这里打出随从后，本基地其他己方随从本回合 +1。 |
| `base_q_point` | 通过 | 计分前逐玩家保留这里一张牌，摧毁其余随从/持续行动。 |

## 已跑验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/magical-girls.test.ts --configLoader native`
  - 结果：1 file / 11 tests passed
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/magical-girls.test.ts src/games/smashup/__tests__/abilities/itty-critters.test.ts src/games/smashup/__tests__/abilities/kaiju.test.ts src/games/smashup/__tests__/abilityRegistry.test.ts src/games/smashup/__tests__/abilityInteractionRegistry.test.ts --configLoader native`
  - 结果：5 files / 64 tests passed
- `npx eslint src/games/smashup/abilities/magical_girls.ts src/games/smashup/__tests__/abilities/magical-girls.test.ts src/games/smashup/abilities/index.ts`
  - 结果：通过
- `npm run typecheck`
  - 结果：通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native`
  - 结果：1 file / 7 tests passed
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native`
  - 早期结果：27 tests 中 24 passed / 3 failed；失败归因已在后续 Mega Troopers 实现与 legacy 边界登记中处理。
  - 最新结果见统一审计：1 file / 27 tests passed。
- `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts`
  - 结果：5 tests passed；Magical Girls 覆盖 `base_q_point` 计分前 reaction session、逐玩家保留/摧毁和 finalState。

## 残余范围

- 当前证据证明 Magical Girls L2 领域行为，并由统一 E2E 覆盖 `base_q_point` 代表性 L3/L4。
- 尚未补逐卡全量浏览器真实入口 E2E 截图。
- `magical_girls_coordination` 的 Walking Castle 分支已接入，后续 L3/L4 需覆盖真实泰坦入口。
