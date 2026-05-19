# DiceThrone 枪手（Gunslinger）审计报告（2026-04-11）

> 2026-05-19 范围澄清：本文件只覆盖 `gunslinger` 单英雄补审。当前整批“新英雄补审”总范围统一按 `gunslinger / samurai / treant / ninja` 四位理解；总范围与跨英雄汇总口径请以 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md` 和 `evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 为准。
>
> 2026-05-19 本轮补审回写：已重新复跑 `Mark the Target` 的真实 UI/E2E，旧文档里“`mark-the-target` 仍缺真实 UI/E2E”这条结论失效；当前枪手残余风险重新收敛到 `Loaded` 基础奖励骰特写缺少单独 evidence 文档，而不是 `mark-the-target` 本体未验。

## 审计范围
- 角色板能力/终极技：左轮、赏金猎人、快枪手、掩护、枪战决斗、死亡之眼、左轮速射、对决、终极技
- 提示板状态/骰面说明：装填（Loaded）、赏金（Bounty）、骰面说明
- 专属卡组：升级卡、行动卡、攻击修正卡，以及 `slot-22 / 23 / 24` 复合升级牌的下半区技能变体（`pistol-whip / mark-the-target / the-law`）
- 关键实现入口：
  - `src/games/dicethrone/heroes/gunslinger/abilities.ts`
  - `src/games/dicethrone/heroes/gunslinger/cards.ts`
  - `src/games/dicethrone/heroes/gunslinger/tokens.ts`
  - `src/games/dicethrone/heroes/gunslinger/diceConfig.ts`
  - `src/games/dicethrone/domain/customActions/gunslinger.ts`
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/games/dicethrone/domain/choiceEffects.ts`
  - `src/games/dicethrone/domain/effects.ts`
  - `src/games/dicethrone/ui/BonusDieOverlay.tsx`
  - `src/games/dicethrone/domain/reduceCombat.ts` / `rules.ts`
  - `src/engine/primitives/damageCalculation.ts`
- 相关测试：
  - `src/games/dicethrone/__tests__/cross-hero.test.ts`
  - `src/games/dicethrone/__tests__/card-cross-audit.test.ts`
  - `src/games/dicethrone/__tests__/ability-customaction-audit.test.ts`
- E2E 证据：`evidence/dicethrone/dicethrone-wild-west-e2e-test.md`、`evidence/dicethrone/dicethrone-high-noon-branches-e2e-test.md`

## 权威来源
- `src/games/dicethrone/rule/枪手真相源表.md`
- `src/games/dicethrone/rule/枪手录入核对.md`
- `src/games/dicethrone/rule/枪手卡牌录入核对.md`
- 汉化原图路径（见真相源表中的 `player-board.webp` / `tip.webp` / `ability-cards.webp`）
- Wiki/英文图仅作对照，不覆盖汉化图结论
- 权威来源优先级（本轮显式裁定）：**卡牌/技能/token 自身文本 > 角色提示板/录入规则文档 > 历史实现/旧审计 > Wiki 对照**

## 成熟旧对象对照（共享契约）
- 参照 Monk / Paladin 等成熟角色的“攻击修正卡 → bonusDamage + Spotlight”链路：
  - `card-wild-west` 走 bonus-die spotlight，不修改主骰盘。
  - `attackModifierBonusDamage` 统一汇总，UI 通过 `useActiveModifiers` 展示。
- 参照 Barbarian / Samurai 等成熟角色的“复合升级卡 → 基础技能 ID → variants”链路：
  - `slot-22 / 23 / 24` 对应 `upgrade-fan-the-hammer-2 / upgrade-take-cover-2 / upgrade-deadeye-2` 三张**整张物理升级牌**。
  - 下半区 `pistol-whip / mark-the-target / the-law` 只作为升级后技能变体存在，**不是独立手牌对象**。
- 结论：枪手攻击修正卡与复合升级卡现在都已回到既有共享合同；旧审计把下半区变体当成“已自动覆盖”的写法已失效。

## 时机正确性语义核对（四问）补审（2026-04-12）

### 1. `card-wild-west`
- **触发动作**：不是“打出卡牌”，而是**本次攻击里后续某次花费 `Loaded`**。
- **触发时点**：打出时只往 `pendingAttack.loadedBonusDieBoost` 挂载“允许重掷 + 结算后再加 1”的等待态；真正的奖励骰特写在 `use-loaded -> handleLoadedUse()` 时才出现。
- **消耗发生点**：`Loaded` 的扣减发生在通用装填使用链路，不在 `card-wild-west` 的出牌时立即扣减。
- **范围与持续**：仅覆盖**本次攻击的下一次装填奖励骰**，结算后由 `clearLoadedBoostEvent` 清空。
- **补审结论**：现有 E2E 与实现落点一致，旧“打出即触发”的审计结论已失效，当前口径维持 ✅。

### 2. `Loaded` 基础奖励骰链路（装填）
- **触发动作**：攻击掷骰阶段结束时，若可用装填则进入“是否花费装填”的选择。
- **触发时点**：`flowHooks.ts` 在 offensiveRoll 结束时创建装填选择；真正消耗发生在 `choiceEffects.ts` 的 `use-loaded`。
- **消耗发生点**：装填扣减由 `use-loaded` 统一执行，不应由能力/卡牌直接扣除。
- **范围与持续**：仅对“本次装填奖励骰”生效，结算后结束，不应残留。
- **补审结论**：目前文档仍把 `Loaded` 简化成“✅ 一致”，但证据链未完整串起 **flow → choice → effect → UI**，需补齐实现入口与 UI 证据链。

### 3. `upgrade-quick-draw` / `fill-em-with-lead` 的“花费装填时可重掷”条款
- **触发动作**：两者触发的都不是升级/终极技本体结算，而是**后续执行 `use-loaded` / `gunslinger-loaded-use`** 这次“花费装填并掷奖励骰”。
- **触发时点**：发生在装填奖励骰链路开启时，而非 `phaseStart` 本体或终极技本身的 10 点伤害结算瞬间。
- **消耗发生点**：`Loaded` 的实际扣减统一走通用 token 使用链；两条例外只是让该奖励骰获得“可重掷 1 次”。
- **范围与持续**：都是**该次装填奖励骰仅可重掷 1 次**，不应外溢成整回合常驻 buff。
- **补审结论（2026-05-17 更新）**：运行时行为仍由 `cross-hero.test.ts` 覆盖；定义层已新增 `tokenBonusDieReroll` 元数据，`Quick Draw II` 声明为 `scope: allTokenUses`，`Fill'Em With Lead` 声明为来源技能级 Loaded 重掷 hook，`handleLoadedUse()` 读取能力定义而不是硬编码 `sourceAbilityId` / `quickDrawLevel`。结构层 D3/D8/D23 finding 已收敛；`Quick Draw II` 已补独立 UI 证据，`Fill'Em With Lead` 与其余枪手 UI 缺口仍按 D47 保留。

### 4. `Bounty` 的“当受此指示物影响的玩家遭到对手攻击时”
- **触发动作**：应限定为**持有赏金的一方遭到对手攻击来伤**，而不是任意 `DAMAGE_DEALT`。
- **触发时点**：应在攻击伤害计算时加 1 伤害并给攻击者 +1 CP；按规则/Wiki 补充，**防御反击伤害不应触发**。
- **消耗发生点**：触发加伤/给 CP 本身无消耗；“持续到游戏结束”只表示不会自然过期或因触发自动消耗，不表示免疫移除状态类卡牌/效果。
- **范围与持续**：仅影响“对手攻击”这类来伤，不能把 `duel` 的防御反击也算进去。
- **补审结论**：实现侧已通过 `damageTriggerScope: 'opponentAttackDamage'` 将触发范围收紧为“对手攻击来伤”，从而天然排除 `duel` 这类防御反击伤害；并已有负路径测试覆盖（`duel` 反伤不触发）。因此旧“门禁未闭环/待补回归”结论失效，当前可标为 **✅ 已闭环**（剩余仅为证据文档同步问题）。

## 逐项结论

### 角色板能力 / 终极技
| 能力 | 权威描述要点（汉化图） | 实现入口 | 维度 | 结论 |
| --- | --- | --- | --- | --- |
| 左轮（revolver） | 3/4/5 个子弹分别造成 3/4/5 伤害 | `abilities.ts` + `customActions/gunslinger.ts` | D1/D3 | ✅ 一致 |
| 左轮 II（revolver-2） | 3/4/5 个子弹分别造成 4/5/6 伤害；若至少 4 颗同点数，再施加击倒 | `abilities.ts` + `customActions/gunslinger.ts` | D1/D3/D8 | ✅ 已对齐 |
| 赏金猎人（bounty-hunter） | 施加赏金并造成不可防御伤害 | `abilities.ts` | D1/D3 | ✅ 一致 |
| 快枪手（quick-draw） | 维持阶段获得装填；升级后每次花费装填可重掷该奖励骰一次 | `abilities.ts` + `customActions/gunslinger.ts` | D1/D3/D8/D23 | ✅ 运行时已验证；升级后的“花费装填时可重掷”已通过 `tokenBonusDieReroll: { scope: 'allTokenUses' }` 显式建模，handler 读取定义层 hook |
| 掩护射击（take-cover） | 获得闪避并造成伤害；升级后下半区解锁 `mark-the-target` | `abilities.ts` | D1/D3 | ✅ 一致 |
| 枪战决斗（showdown） | 双方比点；赢/平时提升总伤害 | `abilities.ts` + `customActions/gunslinger.ts` | D1/D8 | ✅ 一致 |
| 死亡之眼（deadeye） | 施加击倒并造成不可防御伤害；升级后下半区解锁 `the-law` | `abilities.ts` + `customActions/gunslinger.ts` | D1/D3 | ✅ 一致 |
| 左轮速射（fan-the-hammer） | 获得 2 闪避并造成伤害；升级后下半区解锁 `pistol-whip` | `abilities.ts` | D1/D3 | ✅ 一致 |
| 对决（duel） | 防御阶段双方投骰比较；赢时二选一，输时造成 1 点不可防御伤害 | `abilities.ts` + `customActions/gunslinger.ts` | D1/D5 | ✅ 一致 |
| 终极技（fill-em-with-lead） | 获得闪避、对手获得赏金与击倒，再造成 10 点不可防御伤害；花费装填时可重掷奖励骰 | `abilities.ts` + `customActions/gunslinger.ts` | D1/D3/D8/D23 | ✅ 行为测试已覆盖；“花费装填时重掷”已显式建模为来源技能级 `tokenBonusDieReroll` hook |

### 提示板状态 / 骰面说明
| 状态 | 权威描述要点（汉化图） | 实现入口 | 维度 | 结论 |
| --- | --- | --- | --- | --- |
| 装填（loaded） | 消耗 1 装填掷 1 骰，额外伤害=半值向上取整；`Wild West / Quick Draw` 等文本可显式重掷该奖励骰 | `tokens.ts` + `customActions/gunslinger.ts` + `flowHooks.ts` + `choiceEffects.ts` + `effects.ts` + `BonusDieOverlay.tsx` | D1/D3/D7/D8 | ⚠️ 行为一致，但 flow→choice→effect→UI 证据链未完全闭合 |
| 赏金（bounty） | 受攻击伤害 +1，攻击者额外获得 1CP；补充裁定为“防御伤害不触发”；不会自然过期但可被移除状态类效果移除 | `tokens.ts` + `reduceCombat.ts` + `damageCalculation.ts` + `execute.ts` | D1/D3/D8/D22 | ✅ 已通过 `damageTriggerScope: 'opponentAttackDamage'` 收紧为“对手攻击来伤”，由 `duel` 负路径测试覆盖；当前 `removable: true`，`Bye Bye` 真实手牌链路可移除 |
| 骰面说明 | 1-3 子弹 / 4-5 冲刺 / 6 准星 | `diceConfig.ts` | D1/D3 | ✅ 一致 |

### 升级卡（专属手牌对象）
| 卡牌ID | 汉化卡名 / 类别 | 权威描述要点 | 实现入口 | 维度 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `upgrade-revolver-2` | 左轮手枪 II / 升级 | 3/4/5 子弹→4/5/6 伤害；若 ≥4 颗同点数，再施加击倒 | `cards.ts` + `abilities.ts` + `customActions/gunslinger.ts` | D1/D3/D8 | ✅ 一致 |
| `upgrade-bounty-hunter-2` | 赏金猎人 II / 升级 | 赏金 + 2 点不可防御伤害 | `cards.ts` + `abilities.ts` | D1/D3 | ✅ 一致 |
| `upgrade-showdown-2` | 枪战决斗 II / 升级 | 小顺；赢/平→8 伤害，否则 6 伤害 | `cards.ts` + `abilities.ts` + `customActions/gunslinger.ts` | D1/D3/D8 | ✅ 一致 |
| `upgrade-showdown-3` | 枪战决斗 III / 升级 | 小顺；赢/平→9 伤害，否则 6 伤害 | `cards.ts` + `abilities.ts` + `customActions/gunslinger.ts` | D1/D3/D8 | ✅ 一致 |
| `upgrade-fan-the-hammer-2` | 左轮速射 II / 复合升级 | 整张物理升级牌；上半区升级本体，下半区为 `pistol-whip` 变体 | `cards.ts` + `abilities.ts` + `card-cross-audit.test.ts` | D1/D3/D33 | ✅ 已按复合升级合同接线 |
| `upgrade-take-cover-2` | 掩护射击 II / 复合升级 | 整张物理升级牌；下半区为 `mark-the-target` 变体 | `cards.ts` + `abilities.ts` + `card-cross-audit.test.ts` | D1/D3/D33 | ✅ 已按复合升级合同接线 |
| `upgrade-deadeye-2` | 死亡之眼 II / 复合升级 | 整张物理升级牌；下半区为 `the-law` 变体 | `cards.ts` + `abilities.ts` + `card-cross-audit.test.ts` | D1/D3/D33 | ✅ 已按复合升级合同接线 |
| `upgrade-duel-2` | 对决 II / 升级 | 平手也算赢；赢时可选 3 点不可防御伤害或抵挡一半进攻伤害 | `cards.ts` + `abilities.ts` + `customActions/gunslinger.ts` | D1/D3/D5 | ✅ 一致 |
| `upgrade-quick-draw` | 快速拔枪 / 升级 | 维持阶段获得装填；此后每次花费装填都可重掷该奖励骰一次 | `cards.ts` + `abilities.ts` + `customActions/gunslinger.ts` | D1/D3/D8/D23 | ✅ 行为链已覆盖；升级后的“花费装填时”触发已落到 `QUICK_DRAW_UPGRADED.tokenBonusDieReroll.scope = allTokenUses` |

### 复合升级下半区技能变体（非独立手牌）
| 变体ID | 所属升级牌 | 权威描述要点 | 实现入口 | 维度 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `pistol-whip` | `upgrade-fan-the-hammer-2` | 获得 1 闪避、施加击倒、造成 1 点不可防御伤害；不应生成独立手牌/弃牌对象 | `abilities.ts` + `customActions/gunslinger.ts` + `cross-hero.test.ts` | D1/D3/D22/D33 | ✅ 一致 |
| `mark-the-target` | `upgrade-take-cover-2` | 获得 2 闪避，并选择 1 名目标施加赏金；不应生成独立手牌/弃牌对象 | `abilities.ts` + `customActions/gunslinger.ts` + `cross-hero.test.ts` | D1/D3/D5/D33 | ✅ 一致 |
| `the-law` | `upgrade-deadeye-2` | 获得 1 闪避；对**至多 2 名**目标玩家施加赏金 + 击倒；1v1 自动退化为唯一对手 | `abilities.ts` + `customActions/gunslinger.ts` + `cross-hero.test.ts` | D1/D3/D5/D33 | ✅ 一致 |

### 专属行动卡 / 攻击修正卡
| 卡牌ID | 汉化卡名 / 类别 | 权威描述要点 | 实现入口 | 维度 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `card-wanted` | 通缉逮捕！/ 行动 | 选择 1 名玩家，给予赏金；4 人组队局可选任意目标玩家 | `cards.ts` + `customActions/gunslinger.ts` | D1/D5/D34 | ✅ 一致 |
| `card-spin-the-chamber` | 转动弹槽！/ 行动 | 获得 1 个装填 | `cards.ts` | D1/D7 | ✅ 一致 |
| `card-high-noon` | 赌命轮盘！/ 行动 | 选择 1 名目标玩家，掷 1 颗奖励骰并按结果触发 2 不可防御伤害 / 击倒 / 赏金；1v1 自动退化为唯一对手 | `cards.ts` + `customActions/gunslinger.ts` | D1/D5/D10/D15 | ✅ 一致（E2E 已验证） |
| `card-wild-west` | 荒野西部！/ 攻击修正 | **打出后仅挂载**；当你**花费 1 装填**时触发奖励骰（可重掷一次），结算后总伤害 +1，不改主骰盘 | `cards.ts` + `customActions/gunslinger.ts` | D1/D5/D7/D15/D18 | ✅ 一致（E2E 已验证） |
| `card-eat-my-lead` | 吃我的铅弹！/ 攻击修正 | 额外掷 5 骰；每个子弹令本次攻击 +1；若加伤 >4，再施加击倒 | `cards.ts` + `customActions/gunslinger.ts` | D1/D3/D8 | ✅ 一致 |

## 验证证据
- **本次文档回写（2026-04-12）未新增跑测。** 本节中的动态证据分为两类并显式区分：
  - **历史动态证据复用**：既有 E2E evidence 文档、截图产物、既有测试文件中的断言与先前审计留痕；
  - **本轮静态补审**：基于源码落点、规则文档、真相源表与既有 evidence 的重新核对。
- 因此，除非某条证据明确写了“已复跑/已执行”，否则本文件均按“**历史证据复用**”口径理解，不将本轮文档修订误写成新增动态验证。
- Wild West E2E：`evidence/dicethrone/dicethrone-wild-west-e2e-test.md`
- High Noon E2E：`evidence/dicethrone/dicethrone-high-noon-branches-e2e-test.md`
- The Law 既有多目标证据：`evidence/dicethrone/dicethrone-gunslinger-the-law-multiselect-e2e-test.md`
- 枪手 / 武士变体链路既有证据：`evidence/dicethrone/dicethrone-gunslinger-samurai-variant-e2e-test.md`
- 4 人目标集合（Wanted / High Noon / Pistol Whip）：`evidence/dicethrone/dicethrone-gunslinger-samurai-4p-targeted-cards-e2e-test.md`
- 已有 Loaded 奖励骰特写 E2E 文件：`e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts`（基础 Loaded 已有真实选择到单骰特写覆盖；2026-05-17 新增 `Quick Draw II` 与 `Fill'Em With Lead` 可重掷单骰特写覆盖）
- 静态实现核对：
  - `src/games/dicethrone/domain/customActions/gunslinger.ts:46-140,227-250,446-460,531-651,654-699,709-796`
  - `src/games/dicethrone/domain/flowHooks.ts:661-699`
  - `src/games/dicethrone/domain/choiceEffects.ts:127-149`
  - `src/games/dicethrone/domain/effects.ts:300-393`
  - `src/games/dicethrone/ui/BonusDieOverlay.tsx:135-175,252-260`
  - `src/games/dicethrone/heroes/gunslinger/abilities.ts:147-167,284-297,396-409`
  - `src/games/dicethrone/heroes/gunslinger/cards.ts:171-238`
  - `src/games/dicethrone/heroes/gunslinger/tokens.ts:72-91`
  - `src/engine/primitives/damageCalculation.ts:307-385`
  - `src/games/dicethrone/heroes/gunslinger/diceConfig.ts:12-30`
- 静态/行为测试证据：
  - `src/games/dicethrone/__tests__/card-cross-audit.test.ts:279-330`（复合升级卡 atlas 接线；确认不存在 `card-pistol-whip / card-mark-the-target / card-the-law` 假手牌对象）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:404-454`（`duel` 的防御反击伤害不触发 `bounty`）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:522-571`（`fill-em-with-lead` 的 Loaded 重掷行为）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:663-913`（`the-law` 1v1 fallback、多人多目标、4 人组队目标集合）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:915-1046`（`wanted / high-noon` 的 4 人目标集合）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:1205-1471`（`spin-the-chamber / wanted / high-noon` 行为链）
  - `src/games/dicethrone/__tests__/cross-hero.test.ts:1886-1936`（`upgrade-quick-draw` 的 Loaded 重掷行为）
  - `src/games/dicethrone/__tests__/gunslinger-loaded-contract.test.ts`（`Quick Draw II` / `Fill'Em With Lead` 的 `tokenBonusDieReroll` 定义层合同）
- 2026-05-17 本轮实测：
  - `node node_modules/eslint/bin/eslint.js src/games/dicethrone/__tests__/gunslinger-loaded-contract.test.ts src/games/dicethrone/domain/combat/types.ts src/games/dicethrone/heroes/gunslinger/abilities.ts src/games/dicethrone/domain/customActions/gunslinger.ts`
  - `npx vitest run src/games/dicethrone/__tests__/gunslinger-loaded-contract.test.ts --configLoader native --maxWorkers 1`，`2 tests passed`
  - `npx vitest run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native --maxWorkers 1 -t "fill-em-with-lead can reroll|upgrade quick-draw makes loaded|wild west keeps fixed|base loaded choice"`，`5 passed / 61 skipped`
  - `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "gunslinger quick draw II should make loaded spotlight rerollable after real choice click"`，`1 passed`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-quick-draw-II-should-make-loaded-spotlight-rerollable-after-real-choice-click\23-gunslinger-quick-draw-2-loaded-choice-before-use.png`
      - 肉眼观察：真实页面上出现“技能结算选择”弹窗，选项中可见“装填”，背景是枪手玩家板与当前战斗 UI；这证明用例不是只读静态状态，而是从结算选择入口进入 Loaded 花费链路。
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-quick-draw-II-should-make-loaded-spotlight-rerollable-after-real-choice-click\24-gunslinger-quick-draw-2-loaded-rerollable-spotlight.png`
      - 肉眼观察：真实页面显示单骰奖励骰特写，右侧可见骰面列表与“投掷/已确认”区域，中间提示“点击骰子花费 0 装填重投”；顶部 token 区装填已从 1 扣到 0。该截图达到 `Quick Draw II` 花费 Loaded 后可重掷一次的 UI 证据要求。
  - `node scripts/infra/check-file-encoding.mjs --quiet`，通过（用于排除一次 E2E 启动前编码候选文件 ENOENT 的瞬态问题）
  - `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "gunslinger fill em with lead should make sourced loaded spotlight rerollable"`，`1 passed`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-fill-em-with-lead-should-make-sourced-loaded-spotlight-rerollable\25-gunslinger-fill-em-with-lead-loaded-choice-before-use.png`
      - 肉眼观察：真实战斗页面上出现“技能结算选择”弹窗，选项中可见“装填”，背景为枪手玩家板与攻击掷骰阶段 UI；这证明终极技来源的 Loaded 花费链路仍从真实选择入口进入。
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-fill-em-with-lead-should-make-sourced-loaded-spotlight-rerollable\26-gunslinger-fill-em-with-lead-loaded-rerollable-spotlight.png`
      - 肉眼观察：真实页面显示单骰奖励骰特写，右侧骰面列表可见，中央提示“点击骰子花费 0 装填重投”；顶部装填 token 已扣到 0。用例状态断言 `sourceAbilityId=fill-em-with-lead`、`maxRerollCount=1`、`displayOnly=false`，该截图链达到 `Fill'Em With Lead` 来源技能级 Loaded 重掷 UI 证据要求。
  - `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "should allow confirming after selecting only one target"`，`1 passed`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-allow-confirming-after-selecting-only-one-target\14-the-law-single-target-selected.png`
      - 肉眼观察：The Law 交互弹窗显示“选择至多 2 名目标玩家”，P2/P3 两个目标都可见；只选择 P2 后确认按钮可用，证明“至多 2 名”不是必须选满 2 名。
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-allow-confirming-after-selecting-only-one-target\14-the-law-single-target-resolved.png`
      - 肉眼观察：确认后弹窗已关闭，P2 头像区可见赏金与击倒图标，P3 头像区没有对应新增图标；用例状态断言也确认 P2 `bounty=1/knockdown=1`、P3 保持 0。该截图补齐 The Law 单选最终态证据。
  - `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "gunslinger spin the chamber should grant loaded from real hand play"`，`1 passed`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-spin-the-chamber-should-grant-loaded-from-real-hand-play\27-gunslinger-spin-the-chamber-before-play.png`
      - 肉眼观察：主阶段真实手牌区可见 `转动弹槽！`，顶部枪手装填为 0、CP 为 2，证明从真实手牌入口开始。
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-spin-the-chamber-should-grant-loaded-from-real-hand-play\28-gunslinger-spin-the-chamber-after-play-loaded.png`
      - 肉眼观察：打出后左侧状态区出现 Loaded 图标，CP 从 2 扣到 1，卡牌进入弃牌区；用例断言 `loaded=1` 且手牌不再包含该卡。
  - `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "gunslinger eat my lead should roll five bonus dice from real hand play"`，`1 passed`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-eat-my-lead-should-roll-five-bonus-dice-from-real-hand-play\29-gunslinger-eat-my-lead-before-play.png`
      - 肉眼观察：攻击掷骰阶段真实手牌区可见 `吃我的铅弹！`，攻击结算按钮与主骰盘均在真实战斗 UI 中。
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-eat-my-lead-should-roll-five-bonus-dice-from-real-hand-play\30-gunslinger-eat-my-lead-bonus-dice-overlay.png`
      - 肉眼观察：右侧可见 5 个奖励骰均为子弹面，顶部可见 `攻击修正 +5`，目标头像区可见击倒图标；用例状态断言 `attackModifierBonusDamage=5`、`bonusDamage=5`、`knockdown=1`。
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-eat-my-lead-should-roll-five-bonus-dice-from-real-hand-play\31-gunslinger-eat-my-lead-after-closeout.png`
      - 肉眼观察：奖励骰特写已关闭，5 个骰面、`攻击修正 +5` 与击倒结果仍保留，证明该链路可收口。
  - `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "should open target selection and apply bounty after selecting upgraded take cover variant"`，`1 passed`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-open-target-selection-and-apply-bounty-after-selecting-upgraded-take-cover-variant\32-mark-the-target-before-select.png`
      - 肉眼观察：真实战斗页面里，枪手升级后的 `take-cover` 槽已叠加升级卡图，进入结算前能看到玩家板、目标头像区与可推进的当前战斗 UI；这证明 `mark-the-target` 不是靠伪造交互直接起效，而是从真实玩家板变体入口进入。
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-open-target-selection-and-apply-bounty-after-selecting-upgraded-take-cover-variant\33-mark-the-target-selected-target.png`
      - 肉眼观察：目标选择弹窗中至少能看到两个候选目标；点击 `dt-player-target-1` 后，确认按钮从 disabled 变为 enabled，证明“选择 1 名目标玩家”这条 UI 门禁真实存在。
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-open-target-selection-and-apply-bounty-after-selecting-upgraded-take-cover-variant\34-mark-the-target-resolved.png`
      - 肉眼观察：交互关闭后，枪手自己保留 `2` 层闪避，P1 目标出现赏金，未选中的 P2 没有被误加赏金；这达到 `mark-the-target` 的“单目标选择 -> 只作用于所选玩家 -> 收口后可继续推进”验收要求。
  - `src/games/dicethrone/__tests__/ability-customaction-audit.test.ts:239-242`（枪手 resolve handler 已接线）

## 旧结论失效与本轮补审回写（2026-04-12）
1. **旧审计把枪手专属卡区简化成 4 个行动/攻击修正对象，遗漏了 `spin-the-chamber` 与三张复合升级卡的下半区变体。**
   - 失效原因：之前只围绕用户指出的 `Wild West / High Noon` 问题回写，没有按 `枪手卡牌录入核对.md` 的整张物理牌合同重新枚举全部专属对象。
   - 修正：本轮已补入 `upgrade-fan-the-hammer-2 / upgrade-take-cover-2 / upgrade-deadeye-2` 及其 `pistol-whip / mark-the-target / the-law` 变体，另补录 `card-spin-the-chamber`。
2. **旧审计默认把 `the-law / pistol-whip / mark-the-target` 当成“已被 cards.ts 覆盖”的对象，这一表述失效。**
   - 正确口径：三者只存在于升级后基础技能的 `variants` 内，不是独立手牌；对应证据见 `card-cross-audit.test.ts:279-330` 与 `cross-hero.test.ts:1598,1656`。
3. **旧审计把 `card-high-noon` 的目标范围误写成“敌方 only”，这一结论失效。**
   - 失效原因：卡面写的是“对目标玩家”，但旧实现沿用 `resolveSingleOpponentCard` 的敌方过滤；旧审计只验证了 1v1 分支结算与奖励骰特写，没有按 D5 对“多人目标集合”做反查与 E2E 证据闭环。
   - 修正：本轮已将 `High Noon` 目标选择改为 `createSinglePlayerInteraction + getSeatingOrder()`（多人局可选全部座次玩家，1v1 自动退化为唯一对手），并同步更新 4 人 E2E 覆盖与证据链。
4. **旧审计把“枪手规则文档仍有 merge conflict 残留”继续列为待收口项，这一结论失效。**
   - 失效原因：当前 `src/games/dicethrone/rule/枪手*.md` 已无 `<<<<<<< / ======= / >>>>>>>` 冲突标记，旧 finding 没有及时回写失效。
   - 新证据路径：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\rule\枪手录入核对.md`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\rule\枪手卡牌录入核对.md`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\rule\枪手真相源表.md`
   - 新结论：merge conflict 风险已失效；不再作为枪手残余风险保留。
5. **旧审计把 `quick-draw / upgrade-quick-draw / fill-em-with-lead` 的“花费装填时可重掷”写成 `D3` 闭环已收口，这一结论曾失效；2026-05-17 已重新收敛。**
   - 失效原因：按“时机四问”回查后，真正触发动作是后续 `use-loaded`，而不是升级卡/终极技本体；当时定义层只有描述文本，执行仍依赖 `handleLoadedUse()` 中 `sourceAbilityId === 'fill-em-with-lead' || quickDrawLevel >= 2` 的隐式特判。
   - 新证据路径：`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\heroes\gunslinger\abilities.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\combat\types.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\domain\customActions\gunslinger.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\gunslinger-loaded-contract.test.ts`、`D:\gongzuo\webgame\BoardGame\src\games\dicethrone\__tests__\cross-hero.test.ts`
   - 新结论：`Quick Draw II / Fill'Em With Lead` 的 Loaded 重掷已回到定义层 `tokenBonusDieReroll` hook，运行时读取 hook 并保留既有行为回归；结构层 finding 已收敛。
6. **`Bounty` 的“仅对手攻击来伤触发”门禁**（旧结论失效，已闭环）
   - 旧问题：此前文档把 `Bounty` 写成“待补回归/静态风险”，但这是漏读了 token 定义里的触发范围门禁。
   - 新证据路径：`src/games/dicethrone/heroes/gunslinger/tokens.ts`（`damageTriggerScope: 'opponentAttackDamage'`）+ `src/engine/primitives/damageCalculation.ts`（scope 判定）+ `src/games/dicethrone/__tests__/cross-hero.test.ts:404-455`（`duel` 防御反击不触发的负路径）。
   - 新结论：`Bounty` 已严格限定为“对手攻击来伤”触发，`duel` 防御反击被排除；可标记为 **✅ 已闭环**（剩余仅是证据文档同步）。
7. **`Bounty` 的“持续到游戏结束 = 不可移除”旧外推失效**（2026-05-17 回写）
   - 旧问题：早期文档和 `dicethrone-paladin-blessing-removable-fix.md` 曾把枪手 `Bounty` 与圣骑士 `Blessing of Divinity` 一起列为 `removable: false`，并写成“只能通过触发效果自动消耗，不能被玩家主动移除或转移”。
   - 失效原因：`Bounty` 是负面 token；卡图“持续到游戏结束”只代表不会自然过期/不会触发后自动消耗，不代表免疫移除状态类卡牌或效果。后续 `Bye Bye` 真实手牌 E2E 已证明旧口径会导致赏金可见但确认失败。
   - 新证据路径：`src/games/dicethrone/heroes/gunslinger/tokens.ts`（当前 `passiveTrigger.removable: true`）+ `evidence/dicethrone-bye-bye-bounty-repro-e2e.md`（复现与修复后截图链）+ `src/games/dicethrone/__tests__/paladin-blessing-removable.test.ts`（不可移除白名单仍保护圣骑士神圣祝福）。
   - 新结论：`Bounty` 不会自然清理，但可被 `Bye Bye` 等移除状态链路移除；“生命周期”与“removable 门禁”必须分开审计。

## D1–D49 全量审计表（2026-04-12 补审）
- **D1 语义保真**：✅ 主要能力、专属手牌、复合升级下半区变体与汉化图主语义基本一致；`Quick Draw II / Fill'Em With Lead` 的“花费装填时可重掷”已回到定义层显式 hook。
- **D2 边界完整**：✅ 装填/赏金/最多 2 目标等限定条件在主流程 handler 与规则中基本一致。
- **D3 数据流闭环**：✅ 复合升级/目标牌闭环已对齐；`Quick Draw II / Fill'Em With Lead` 的 Loaded 重掷已由能力定义 `tokenBonusDieReroll` 驱动，`handleLoadedUse()` 只消费 hook。
- **D4 查询一致性**：✅ 未发现可变属性直读绕过统一入口。
- **D5 交互完整**：✅ `Wanted / The Law / High Noon / mark-the-target` 均有对应交互入口；`The Law` 在 UI 与领域层都允许“选 1 人即可确认”，并已补单选最终态截图链。
- **D6 副作用传播**：✅ 赏金与装填的额外收益可触发既有资源机制。
- **D7 资源守恒**：✅ `Wild West` 在**花费 Loaded 时**消耗装填并追加 +1；`spin-the-chamber` 正确授予装填；装填消耗不越界。
- **D8 时序正确**：✅ `Wild West` 触发时点已对齐；`Bounty` 的 attack-only 门禁已闭环；`Quick Draw II / Fill'Em With Lead` 的装填例外在后续 `use-loaded` 链路触发，并由定义层 hook 描述。
- **D9 幂等与重入**：⚠️ 已覆盖 Wild West/High Noon 特写链路，但未新增专项重入回归。
- **D10 元数据一致**：✅ `High Noon / duel / pistol-whip / the-law` 等 handler categories 与实际事件类型一致；`Wild West` 现为“挂载触发条件 → Loaded 花费时生效”，未误报为直接伤害 handler。
- **D11 Reducer 消耗路径**：✅ 攻击修正伤害走 `attackModifierBonusDamage`。
- **D12 写入-消耗对称**：✅ 赏金/装填写入与主流程消耗基本对称；`The Law` 交互 resolve 只消费已选目标。
- **D13 多来源竞争**：⚠️ 装填与其他攻击修正叠加未做组合回归。
- **D14 回合清理完整**：✅ 攻击修正结算后自动清理。
- **D15 UI 状态同步**：⚠️ Wild West、High Noon、Eat My Lead 特写链路已覆盖，主骰盘不改动已验证；攻击修正加伤通过统一 attack-modifier 区域可观测；`Quick Draw II` 与 `Fill'Em With Lead` 的 Loaded 可重掷单骰特写均已补真实 UI 证据；Spin the Chamber 与 `mark-the-target` 真实手牌/真实玩家板交互已补 UI 证据。当前 UI 缺口重新收敛到 `Loaded` 基础奖励骰缺少单独 evidence 文档，而不是 `mark-the-target` 未验证。
- **D16 条件优先级**：✅ Revolver/升级变体判定顺序正确。
- **D17 隐式依赖**：✅ `Quick Draw II / Fill'Em With Lead` 的装填例外已从 `quickDrawLevel / sourceAbilityId` 硬编码分支收敛到 `tokenBonusDieReroll` 定义层 hook；规则文档 merge conflict 风险已消除。
- **D18 否定路径**：✅ Wild West 奖励骰重掷后进入“达到重掷上限不可再次重掷”的否定路径，已由 E2E 截图链路覆盖（见 `dicethrone-wild-west-e2e-test.md` 第 2 张截图）。
- **D19 组合场景**：⚠️ 赏金+装填叠加未做组合回归。
- **D20 状态可观测性**：⚠️ UI 证据已覆盖 Wild West / High Noon / The Law / Spin the Chamber / Eat My Lead / `mark-the-target` 的关键交互阶段；基础 Loaded、`Quick Draw II` 与 `Fill'Em With Lead` 单骰特写已有 E2E 截图入口。剩余风险集中在 `Loaded` 基础奖励骰缺少独立 evidence 叙述，而不是 `mark-the-target` 本体。
- **D21 触发频率门控**：✅ 装填消耗与奖励骰仅触发一次。
- **D22 伤害计算管线配置**：✅ `Bounty` 通过 `damageTriggerScope: 'opponentAttackDamage'` 明确限定触发范围；其余主线伤害事件仍由统一管线输出。
- **D23 架构假设一致性**：✅ 特写与复合升级合同一致；装填例外语义已由能力定义层声明、通用 loaded handler 消费，避免共享假设分叉。
- **D24 Handler 共返状态一致性**：N/A。
- **D25 MatchState 传播完整性**：N/A。
- **D26 事件设计完整性**：✅ `High Noon / Wild West / Eat My Lead` 的 bonus die 事件保留 `attacker/target/face` 等展示所需上下文。
- **D27 可选参数语义**：✅ 交互参数均显式传入。
- **D28 白名单/黑名单完整性**：N/A。
- **D29 PPSE 事件替换完整性**：N/A。
- **D30 消灭流程时序与白名单**：N/A。
- **D31 效果拦截路径完整性**：N/A。
- **D32 替代路径后处理对齐**：N/A。
- **D33 跨实体同类能力一致性**：✅ 与其他攻击修正卡、其他成熟角色的复合升级卡合同一致；下半区技能变体已不再与“独立手牌对象”混用。
- **D34 交互选项 UI 渲染模式正确性**：✅ 选择玩家交互渲染正常。
- **D35 交互上下文快照完整性**：N/A。
- **D35.1 多系统命令门控职责清晰**：N/A。
- **D36 延迟事件补发健壮性**：N/A。
- **D37 交互选项动态刷新完整性**：N/A。
- **D38 UI 门控系统优先级冲突**：⚠️ 未做 UI 门控冲突专项复核。
- **D39 流程控制标志清除完整性**：N/A。
- **D40 后处理循环事件去重完整性**：N/A。
- **D41 系统职责重叠检测**：N/A。
- **D42 事件流全链路审计**：N/A。
- **D43 重构完整性检查**：N/A。
- **D44 测试设计反模式检测**：✅ 旧审计漏项已补；本轮新增定义层合同测试，避免只靠行为测试掩盖 hook 漏建。
- **D45 Pipeline 多阶段调用去重**：N/A。
- **D46 交互选项 UI 渲染模式声明完整性**：N/A。
- **D47 E2E 覆盖完整性**：⚠️ Wild West / High Noon / Wanted / Pistol Whip / The Law / Spin the Chamber / Eat My Lead / `mark-the-target` 已有真实 UI 证据；`Quick Draw II` 与 `Fill'Em With Lead` 的 Loaded 可重掷单骰特写已补真实 UI/E2E。当前未补的是 `Loaded` 基础奖励骰的单独 evidence 文档化，而不是 `mark-the-target` 的真实入口。
- **D48 UI 交互渲染模式完整性**：N/A。
- **D49 abilityTags 与触发机制一致性**：N/A。

## 未覆盖风险 / 待确认
1. **`Loaded` 基础奖励骰特写已有 E2E 文件覆盖，但仍缺单独 evidence 文档承载 flow→choice→effect→UI 的完整叙述。** 当前可引用既有 E2E 文件、截图产物与静态实现路径，但不能写成枪手 Loaded 全对象 UI 已完成。
2. **`Quick Draw II / Fill'Em With Lead` 的 Loaded 重掷结构层与 UI 单骰特写已补。** 当前仍不得把这些证据外推成“基础 Loaded 奖励骰对象自己的独立 evidence 文档也已齐全”。

## 修订记录
- 2026-04-11：补审枪手派系并记录已修复项（Revolver II 四同点、Wanted/The Law 目标范围、High Noon 骰面归属）。
- 2026-04-12：补齐 High Noon 特写 E2E 证据链，并回写审计结论为“✅ 一致”。
- 2026-04-12（补审回写）：补录 `spin-the-chamber` 与三张复合升级卡下半区变体（`pistol-whip / mark-the-target / the-law`），修正“专属卡区已全覆盖”的失效结论，并把复合升级合同与静态证据补回审计文档。
- 2026-04-12（Wild West 触发时机修订）：
  - 旧结论：`card-wild-west` 打出即消耗装填并触发奖励骰。
  - 失效原因：权威描述为“**当你花费装填时触发**”，先前把触发时机误写成“打出即触发”，属于触发语义漏审（D1/D5/D18）。
  - 新证据路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-bonus-die-overlay.png`
  - 新结论：**打出仅挂载**，当你花费 Loaded 时触发奖励骰与后续 +1；命中 D1/D5/D7/D18。
- 2026-04-12（审计遗漏回写）：
  - 补充 `Loaded` 基础奖励骰链路的 flow→choice→effect→UI 证据入口。
  - 修正文档中 `fill-em-with-lead / upgrade-quick-draw` 的测试引用行号。
  - 补入 `duel` 防御反击不触发 `bounty` 的负路径证据。
  - 更新 D47 与未覆盖风险，明确 `Loaded / Quick Draw II / Fill'Em With Lead` 的 UI 证据缺口。
  - 将“本轮复跑”与“历史证据复用”口径拆开，避免把本次文档回写误写成新增动态验证。
- 2026-04-12（时机四问补审）：
  - 当时下调 `quick-draw / upgrade-quick-draw / fill-em-with-lead` 的收口口径为“行为已验证、结构未完全收口”（2026-05-17 已重新收敛到定义层 hook）。
  - 将 `Bounty` 的结论回写为“attack-only 门禁已闭环”，并补充引用负路径测试与实现门禁，避免再次误报为待补回归。
  - 移除已过期的“枪手规则文档 merge conflict 残留”残余风险。
- 2026-05-17（Bounty 可移除性回写）：
  - 旧结论：“持续到游戏结束”被外推为 `removable: false / 不可被移除状态类效果移除`。
  - 失效原因：后续真实手牌 `Bye Bye` 复现显示该外推会造成 UI 可选但领域验证拒绝；当前项目口径是负面 token 必须可移除，除非有明确白名单。
  - 新结论：`Bounty` 当前 `removable: true`；不自动过期但可被移除状态链路移除。
- 2026-05-17（Loaded 重掷结构收敛）：
  - 将 `Quick Draw II / Fill'Em With Lead` 的 Loaded 重掷从 `handleLoadedUse()` 内硬编码 id/等级分支迁移到 `tokenBonusDieReroll` 定义层 hook。
  - 新增 `gunslinger-loaded-contract.test.ts` 锁定 hook 合同，并复跑相关 `cross-hero.test.ts` 行为链。
  - 补充 `Quick Draw II` 与 `Fill'Em With Lead` 花费 Loaded 后的独立真实 UI/E2E 截图链；保留若干专属卡真实 UI/E2E 缺口。
- 2026-05-19（`mark-the-target` UI 证据回写）：
  - 旧结论：`mark-the-target` 仍缺真实 UI/E2E 截图链。
  - 失效原因：仓库里实际已存在对应真实 E2E 场景，但旧审计没有把 `dicethrone-watch-out-spotlight.e2e.ts` 中的升级变体入口、目标选择和最终态截图链回写到枪手单英雄文档。
  - 新证据路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-open-target-selection-and-apply-bounty-after-selecting-upgraded-take-cover-variant\32-mark-the-target-before-select.png`、`33-mark-the-target-selected-target.png`、`34-mark-the-target-resolved.png`
  - 新结论：`mark-the-target` 的真实玩家板入口、目标选择门禁和只作用于已选目标的收口结果都已补齐；对应 D15/D20/D47 收敛。
