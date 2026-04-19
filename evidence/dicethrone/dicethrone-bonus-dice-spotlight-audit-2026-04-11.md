# DiceThrone 骰子特写文案 vs 实际效果审计（2026-04-11）

## 审计范围
- UI：`BonusDieSpotlightContent`、`BonusDieOverlay`、`CardSpotlightOverlay`
- 文案来源：`public/locales/zh-CN/game-dicethrone.json` → `bonusDie.effect.*`
- 效果实现来源：
  - 通用 rollDie 逻辑：`src/games/dicethrone/domain/effects.ts`
  - 各英雄/卡牌 custom action：`src/games/dicethrone/domain/customActions/*.ts`
  - 各英雄卡牌/技能定义：`src/games/dicethrone/heroes/**/{cards.ts,abilities.ts}`

## 权威来源（描述 → 实现）
- **描述侧（UI 文案）**：`bonusDie.effect` i18n 文案（骰子特写显示的唯一描述来源）
- **实现侧（实际效果）**：domain 层 effect / custom action 产生的事件与其副作用

> 说明：本审计目标是“骰子特写文案是否与实际效果一致”，因此以 UI 文案为“描述”，以 domain 实现为“效果事实”。

## 关联审计维度
- D1 语义保真（文案是否准确覆盖实际效果）
- D3 数据流闭环（effectKey → i18n → UI → 事件效果）
- D15 UI 状态同步（UI 文案与实际效果一致）

---

## 逐项结论（按英雄/模块分组）

### 僧侣 Monk
- `bonusDie.effect.fist`：文案“拳: 伤害 +2”；实现：`taiji-combo-2` rollDie 条件效果 `bonusDamage:2`（`heroes/monk/cards.ts`）✅
- `bonusDie.effect.palm`：文案“掌: 伤害 +3”；实现：`bonusDamage:3`（同上）✅
- `bonusDie.effect.taiji`：文案“太极: 获得 2 个太极标记”；实现：`grantToken(TAIJI,2)` ✅
- `bonusDie.effect.lotus`：文案“莲花: 选择获得闪避或净化”；实现：`triggerChoice` 选闪避/净化 ✅
- `bonusDie.effect.enlightenmentLotus`：文案“莲花！获得 2太极 + 闪避 + 净化”；实现：`card-enlightenment` 给予 2 太极+闪避+净化 ✅
- `bonusDie.effect.enlightenmentOther`：文案“抽 1 张牌”；实现：默认效果 `drawCard:1` ✅
- `bonusDie.effect.gainCp`：文案“获得 {{cp}} CP”；实现：`one-throw-fortune` 获得 `ceil(value/2)` CP（`customActions/monk.ts`）✅
- `bonusDie.effect.thunderStrikeDie / thunderStrikeReroll / thunderStrike2Die / thunderStrike2Reroll`：文案仅描述“投掷/重掷值”；实现为“多骰总和伤害 + 可重掷 +（II 版）阈值倒地”，文案未覆盖总和伤害/阈值倒地 ⚠️ 描述偏简略

### 野蛮人 Barbarian
- `bonusDie.effect.barbarianSuppress`：文案“压制投掷：{{value}}”；实现：3 骰总和伤害，超过阈值附加脑震荡（`customActions/barbarian.ts`）⚠️ 文案未体现总和伤害与脑震荡
- `bonusDie.effect.energeticStrength`：文案“星！治疗 2 并施加脑震荡”；实现：治疗 2 + 脑震荡（`heroes/barbarian/cards.ts`）✅
- `bonusDie.effect.energeticOther`：文案“抽 1 张牌”；实现：默认 `drawCard:1` ✅
- `bonusDie.effect.luckyRoll.result`：文案“{{heartCount}}个心面：治疗{{healAmount}}”；实现：治疗 `1 + 2×心面` ✅
- `bonusDie.effect.morePleaseRoll.result`：文案“{{swordCount}}个剑面：伤害+{{damage}}”；实现：伤害 + 施加脑震荡（`customActions/barbarian.ts`）❌ **缺失脑震荡效果**

### 圣骑士 Paladin
- `bonusDie.effect.divineFavor.*`：文案与 `card-divine-favor` 的抽牌/治疗/CP 效果一致 ✅
- `bonusDie.effect.absolution.*`：文案与 `card-absolution` 的伤害/护盾/CP 效果一致 ✅
- `bonusDie.effect.godsGrace.pray`：文案“祈祷: 获得 4 CP”；实现：`card-gods-grace` 祈祷面获得 4 CP ✅
- `bonusDie.effect.holyLight2.*`：文案与 `holy-light-2` 的暴击/守护/抽牌/CP 效果一致 ✅
- `bonusDie.effect.default`：用于 `card-gods-grace` 的默认效果（抽 1 张牌），但文案为“额外投掷” ❌ **文案与实际效果不一致**

### 烈火术士 Pyromancer
- `bonusDie.effect.fire/magma/fiery_soul/meteor`：文案与“火之高兴”效果（+3伤害/灼烧/2火焰专精/击倒）一致 ✅
- `bonusDie.effect.infernalEmbrace.fire`：文案“烈焰: 获得 2 烈焰精通”；实现一致 ✅
- `bonusDie.effect.infernalEmbrace.1`：文案“抽 1 张牌”；实现默认抽 1 ✅
- `bonusDie.effect.pyroBlast2Die / pyroBlast2Reroll / pyroBlast3Die / pyroBlast3Reroll`：文案仅“炎爆术/重投”提示；实际效果依骰面造成伤害/灼烧/火焰专精/击倒 ⚠️ 文案仅表示投掷，不描述具体效果

### 暗影刺客 Shadow Thief
- `bonusDie.effect.oneWithShadowsHit`：文案“暗影! 伏击+2CP”；实现：伏击标记 +2CP ✅
- `bonusDie.effect.oneWithShadowsMiss`：文案“抽 1 张牌”；实现一致 ✅
- `bonusDie.effect.shadowDamage`：文案“暗影之舞”；实现：投掷结果的一半伤害 ⚠️ 文案仅显示技能名
- `bonusDie.effect.sneakAttack`：文案“偷袭!”；实现：骰值加入本次伤害（`pendingDamageBonus`）⚠️ 文案未体现加伤

### 枪手 Gunslinger
- `bonusDie.effect.gunslingerLoadedDie / gunslingerLoadedReroll`：文案“装填投掷/重掷：{{value}}”；实现：伤害加成为骰值的一半（向上取整）⚠️ 文案未体现加伤规则
- `bonusDie.effect.gunslingerHighNoonBullet/Dash/Bullseye`：文案与 2 伤害 / 击倒 / 赏金 效果一致 ✅
- `bonusDie.effect.gunslingerEatMyLeadDie`：文案“吃我的铅弹！投掷：{{value}}”；实现：5 骰统计子弹面 ✅
- `bonusDie.effect.gunslingerEatMyLead.result`：文案“伤害+{{bonusDamage}}”；实现：子弹面数→伤害加成 ✅
- `bonusDie.effect.gunslingerEatMyLead.resultKnockdown`：文案包含“并施加击倒”；实现：子弹面数>4 时击倒 ✅

### 武士 Samurai
- `bonusDie.effect.samuraiBackStrikeDie`：文案“反击投掷：{{value}}”；实现：骰值一半伤害反击 ⚠️ 文案仅表示投掷
- `bonusDie.effect.samuraiRighteousnessKatana/Helm/RisingSun`：文案与 +2 伤害 / 2 层耻辱 / 1 反击一致 ✅
- `bonusDie.effect.samuraiMasamune.result`：文案与“武士刀→伤害+N，头盔→耻辱，旭日→反击”一致 ✅

### 月精灵 Moon Elf
- `bonusDie.effect.moonShadowStrike.moon / .other`：文案与“施加致盲+缠绕+锁定 / 抽牌”一致 ✅
- `bonusDie.effect.watchOut`：文案“看箭投掷：{{value}}”；对应无效骰面（无额外效果）✅
- `bonusDie.effect.watchOut.bow/foot/moon`：文案与伤害+2 / 缠绕 / 致盲一致 ✅
- `bonusDie.effect.volley.result`：文案仅“弓面数→伤害+X”；实现还会**施加缠绕** ❌ **缺失缠绕效果**
- `bonusDie.effect.explodingArrow.result`：文案仅“伤害公式”；实现还会**扣 CP（按月面数）+ 致盲** ❌ **缺失 CP 扣减与致盲**
- `bonusDie.effect.explodingArrow2.result`：同上（缺失 CP 扣减与致盲）❌
- `bonusDie.effect.explodingArrow3.result`：文案仅“伤害公式”；实现还会**扣 CP + 致盲 + 缠绕** ❌ **缺失关键效果**
- `bonusDie.effect.blinded`：文案“致盲判定”；实现为致盲判定掷骰 ✅
- `bonusDie.effect.blinded.hit / blinded.miss`：文案“攻击成功/失败”；实现与判定结果一致 ✅

---

## 问题清单（需修复/补文案）
1. **`bonusDie.effect.morePleaseRoll.result`** 文案缺失脑震荡效果（`customActions/barbarian.ts`）
2. **`bonusDie.effect.volley.result`** 文案缺失缠绕效果（`customActions/moon_elf.ts`）
3. **`bonusDie.effect.explodingArrow*.result`** 文案缺失 CP 扣减与致盲/缠绕（`customActions/moon_elf.ts`）
4. **`bonusDie.effect.default`** 被用于 `card-gods-grace` 的“抽 1 张牌”，但文案为“额外投掷”不一致（`heroes/paladin/cards.ts`）

## 已补充文案（此前偏简略）
- `barbarianSuppress`、`shadowDamage`、`sneakAttack`、`gunslingerLoadedDie/Reroll`、`samuraiBackStrikeDie`、`thunderStrike*`、`pyroBlast*` 等已补充实际加伤/阈值/附加效果说明。

## 未覆盖风险 / 备注
- `bonusDie.effect` 里存在若干未在运行时使用的 key（如 `pyrohotstreak2.*`、`magmaArmor.*`、`infernalEmbrace.2~6`、`holyLight`/`holyDefense`/`godsGrace`/`divineFavor`/`absolution` 非分面 key 等）。本轮未对“未使用 key”做一致性判断。

---

## 结论
- 多数骰子特写文案与实际效果一致。
- 发现 **4 处明显不一致/缺失关键效果**（Barbarian More Please、Moon Elf Volley/Exploding Arrow 系列、Paladin God’s Grace 默认效果）。
- 已补充此前仅展示“投掷/技能名”的文案，使特写能直接体现加伤与附加效果。

## 修复记录
- 2026-04-11：已更新 `bonusDie.effect.morePleaseRoll.result`、`bonusDie.effect.volley.result`、`bonusDie.effect.explodingArrow*.result` 文案；新增 `bonusDie.effect.godsGrace.other` 并将 `card-gods-grace` 默认效果改用该 key。
- 2026-04-11：补充 `barbarianSuppress`、`shadowDamage`、`sneakAttack`、`gunslingerLoadedDie/Reroll`、`samuraiBackStrikeDie`、`thunderStrike*`、`pyroBlast*` 文案，写明加伤/阈值/附加效果。
- 2026-04-11：`shadowDamage` / `gunslingerLoadedDie(Reroll)` / `samuraiBackStrikeDie` 改为**直接展示计算结果**（通过 effectParams 注入 {{damage}}/{{bonusDamage}}），UI 与 ActionLog 均显示实际数值。
