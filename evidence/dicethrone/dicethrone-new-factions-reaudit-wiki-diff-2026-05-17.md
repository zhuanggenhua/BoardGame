# DiceThrone 新派系重审与 Wiki 差异记录（2026-05-17）

## 范围与口径

- 本轮触发问题：Treant `wild-growth` / `wild-growth-2`（中文 UI 为“野蛮生长 / 野蛮生长 II”，用户口径“野性怒吼2”疑似指同一升级技能）在 2 树枝 + 3 树叶骰面下，升级后不能按图面选择“移除树灵加伤 / 弃生命源泉不可防御”。
- 主真相源：`src/games/dicethrone/rule/treant录入核对.md` 与 `src/games/dicethrone/rule/treant卡牌录入核对.md` 中记录的玩家板/卡图核对结论；清晰图片优先于 Wiki。
- Wiki 仅作差异记录：本轮读取 Dice Throne Wiki 的 Treant 页面（https://dice-throne.fandom.com/wiki/Treant），确认 Wiki 提供 Treant 精灵/生命源泉/树灵通则说明，但页面正文没有列出 Wild Growth 的完整玩家板技能文本；因此本轮不使用 Wiki 覆盖图片口径。
- 新派系全集重审对象暂列为：`gunslinger`、`samurai`、`treant`、`ninja`。当前 Treant 基础技能/被动/终极与 15 张专属卡主效果已局部修到 L2，树灵每回合限用与神性树灵防负面可选响应已补代表链；Ninja `Training` / `Poison Dart` / `Knife Fan` / `Dojo` / `Shuriken` / `Vanish` / `Escape` 已补真实手牌 L3。其余升级卡和基础/升级技能本体不得据此宣称已重审完成。

## 已确认旧结论失效

- `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md` 中把 Treant/Ninja 作为“全链路审计完成”的结论已经不足以作为 Treant 收口证据。
- `src/games/dicethrone/rule/treant录入核对.md` 已明确写出 `wild-growth` 真相源应为：造成 2 伤害；可移除至多 2 树灵，每移除 1 树灵增加 4 伤害；可弃掉生命源泉使此次攻击不可防御。旧代码是 `damage 2 + heal 1`。
- `src/games/dicethrone/rule/treant卡牌录入核对.md` 已明确写出 `upgrade-wild-growth-2` 真相源应为：造成 4 伤害；同样可移除至多 2 树灵加伤，并可弃生命源泉使攻击不可防御。旧代码是 `damage 4 + heal 1`。

## Wiki 对照差异

> 2026-05-17 在线对照源：Dice Throne Wiki / Fandom。Wiki 仅作为对照源，本地清晰图片、规则文档和已登记真相源优先。

- [Treant Wiki](https://dice-throne.fandom.com/wiki/Treant) 确认 Treant 的 Spirits 是 Companion pieces，Seedling / Sapling / Dryad 各有独立堆叠上限与花费效果；每种 Spirit 每回合只能花费一次，且因能力 “discard/remove a Spirit” 时不会同时获得普通花费效果。
- Wiki Treant 页面确认 Wellspring / Spirits / Dryad 等机制存在，但本页正文未提供 Wild Growth / Wild Growth II 的完整技能文本。对 Wild Growth 的字段仍以本地图片核对文档为准。
- Wiki 页面使用英文命名 `Wellspring` / `Dryad Spirit`；当前代码本地化与 ID 使用 `life_sap` / `treant_divine`。这是命名差异，不是本轮功能差异。
- [Ninja Wiki](https://dice-throne.fandom.com/wiki/Ninja) 与本地卡图对 `DOJO! / 道场！` 一致：应为“投 1 骰；掷出面具时获得烟雾弹和 2 忍术；否则抽 1”。旧本地实现和旧核对文档只写“获得烟雾弹和 2 忍术”，属于录入层漏分支；本轮以本地卡图为主真相源修正。
- [Bounty Wiki](https://dice-throne.fandom.com/wiki/Bounty) 与枪手汉化提示板主干一致：负面状态，持有者被对手攻击时攻击者加伤并得 CP；Wiki 额外补充“即使伤害被防止也触发、不会由防御伤害触发”。Wiki 未给出“不可被移除状态效果移除”的裁定，因此不得把 `Persistent / 持续` 外推成 `removable: false`。
- [Samurai Wiki](https://dice-throne.fandom.com/wiki/Samurai) 与本地规则文档的核心状态口径一致：Shame/Honor/Back Strike 的补充裁定主要落在伤害类型、Bushido 得 Honor、Ultimate 例外等规则说明。当前本地 Samurai 仍以 `武士录入核对.md` 与卡图合同为主真相源；本轮在线对照未发现必须覆盖本地图片口径的新增冲突。

## 批次对象清单与层级快照

| heroId | 对象范围 | 本轮结论 | 当前最高证据 | 不得外推的缺口 |
| --- | --- | --- | --- | --- |
| `treant` | 玩家板技能、树灵/生命源泉/刺藤、15 张专属卡主效果 | 已修复 Wild Growth II 触发与主效果；多条技能/卡牌从旧错误语义修到图片口径 | L2 为主；树灵限用与神性树灵响应有代表性 L3 截图链 | 专属卡真实手牌逐卡 L3 未补齐，不能写 Treant 全量端到端收口 |
| `ninja` | 玩家板技能、三种 token、专属卡与升级卡 | 已修 Dojo 漏骰分支；`training/poison-dart/knife-fan/shuriken/escape/vanish/dojo` 已补真实手牌 L3；四项回归有专项证据 | Token 复杂链路 L4；7 张专属行动卡真实手牌 L3；多张升级卡仍仅 L1/L2 | 多数升级卡和部分基础/升级技能本体缺真实入口 L3 截图链 |
| `gunslinger` | 玩家板、Loaded/Bounty、专属卡与复合升级 | 本轮静态重扫未发现新增运行时代码 bug；修正文档漂移：`Bounty` 不自动过期但可被移除状态链路移除 | 既有 L2/L3 证据复用；`Bye Bye` 移除 Bounty 有真实手牌 E2E 文档 | `Loaded` 基础奖励骰、Quick Draw II / 终极技 Loaded 重掷仍有结构层未完全收口风险 |
| `samurai` | 玩家板、Honor/Shame/Back Strike、专属卡与复合升级 | 本轮静态重扫未发现新增运行时代码 bug；本地文档显示 Masamune II、复合升级、行动/攻击修正卡已回到本地合同 | 既有 L2 为主，部分真实入口/E2E 证据复用 | 本轮未新增逐对象 L3；不能把历史“无角色级 residual”改写成新一轮全面审计完成 |

## 本轮修复

- `src/games/dicethrone/heroes/treant/abilities.ts`
  - `wild-growth` 从错误的 `damage 2 + heal 1` 改为：preDefense 组合选择 + withDamage 基础伤害 2。
  - `WILD_GROWTH_2` 从错误的 `damage 4 + heal 1` 改为：preDefense 组合选择 + withDamage 基础伤害 4。
  - `nature-touch` / `NATURE_TOUCH_2` 从固定不可防御伤害改为：preDefense 选择养成后的树灵分布，withDamage 造成基础 5/6 点不可防御伤害，并追加养成后树灵总数的伤害。
  - `rooted` / `ROOTED_2` 从错误的“逐骰树枝反击、逐骰树叶发幼种、逐骰树灵发生命源泉”改为：防止 `树枝数 + 树灵数` 伤害；双树叶触发养成 1 树灵选择；双树灵选择 1 名玩家获得生命源泉；Rooted II 共享同一合同但掷 4 骰。
  - `tend-care` / `TEND_CARE_2` 从错误的 `seedling3 + self lifeSap + opponent thorn` / `seedling3 + sapling1 + self lifeSap + opponent thorn` 改为：抽 1 后进入组合选择；基础版养成 3 树灵，升级版养成 4 树灵；同时选择 1 名玩家获得生命源泉、选择 1 名对手获得刺藤。
  - `forest-awakens` 从错误的 `self lifeSap + seedling5 + opponent thorn + damage10` 改为：选择养成 5 树灵后的最终分布；自己和队友获得生命源泉；当前防御目标获得刺藤；再造成 10 点终极伤害。
- `src/games/dicethrone/domain/customActions/treant.ts`
  - 新增 `treant-wild-growth-choice`：根据当前幼种/木苗/神性树灵与生命源泉生成组合选项。
  - 新增 `treant-wild-growth-resolve` choice effect：消耗所选树灵与生命源泉，按每个树灵 +4 写入 `pendingAttack.bonusDamage`，弃生命源泉时把本次攻击设为不可防御。
  - 新增 `treant-nature-touch-cultivate` / `treant-nature-touch-cultivate-resolve`：枚举 `养成2树灵` 的合法最终分布（获得幼种或升级现有树灵），选择后写回树灵 token，并把养成后树灵总数写入 `pendingAttack.bonusDamage`。
  - 新增 `treant-rooted-defense` / `treant-rooted-resolve`：按防御骰面总数生成 Rooted 防御结果；用负向 `pendingAttack.bonusDamage` 表达防止伤害，避免通用 shield 在伤害计算与 reducer 中被重复消费；选择分支写回养成后的树灵分布或生命源泉目标。
  - 新增 `treant-tend-care-choice` / `treant-tend-care-3-resolve` / `treant-tend-care-4-resolve`：枚举基础版 3 次、升级版 4 次养成后的合法树灵分布，并把生命源泉目标与刺藤目标纳入同一选择，避免旧 `CHOICE_REQUESTED` 中断机制吞掉后续选择。
  - 新增 `treant-forest-awakens-choice` / `treant-forest-awakens-resolve`：枚举 5 次养成后的合法树灵分布，并写回自己/队友生命源泉、防御目标刺藤。
  - 新增 Treant 专属卡 custom action：`treant-card-trample-roll`、`treant-card-drink-deep`、`treant-card-harvest`、`treant-card-cultivate`、`treant-card-downpour`、`treant-card-soulfire-roll`、`treant-card-mother-tree-roll`，修正 Trample、Drink Deep、Harvest、Cultivate、Downpour、Soulfire、Mother Tree、Planting 的卡图主语义。
- `src/games/dicethrone/domain/events.ts` / `src/games/dicethrone/domain/systems.ts` / `src/games/dicethrone/hooks/useDiceThroneState.ts` / `src/games/dicethrone/ui/ChoiceModal.tsx`
  - `CHOICE_REQUESTED.options` 透传 `labelParams`，用于 Tend & Care 这类组合选项在 UI 中显示养成结果和目标。
- `src/games/dicethrone/domain/attack.ts` / `src/games/dicethrone/domain/effects.ts`
  - 防御效果若改写 `pendingAttack.bonusDamage`，攻击结算必须读取防御后的 `pendingAttack`；同时允许 `bonusDamage` 为负值，作为同一次攻击内的伤害降低。
- `public/locales/zh-CN/game-dicethrone.json` / `public/locales/en/game-dicethrone.json`
  - 更新 Wild Growth / Wild Growth II / Rooted / Rooted II / Tend & Care / Tend & Care II / Forest Awakens 描述，去掉错误“治疗”、Rooted 反击语义，以及 Tend & Care / Forest Awakens 固定给自己/固定幼种的错语义。
  - 新增 Treant Wild Growth、Nature Touch、Rooted、Tend & Care、Forest Awakens 选择与奖励骰展示文案。
  - 更新 Treant 专属卡 Trample、Drink Deep、Harvest、Downpour、Soulfire、Mother Tree、Planting 描述，并补充对应选择/奖励骰展示文案。
  - 补齐 `upgrade-tend-care-2`、`upgrade-rooted-2`、`upgrade-nature-touch-2`、`upgrade-vengeful-vines-2`、`upgrade-wild-growth-2` 的完整升级后效果描述，不再只显示 “Upgrade/升级某技能”。
- `src/games/dicethrone/domain/flowHooks.ts`
  - `thorn` 在进攻掷骰阶段退出时的伤害从 `rollCount - 1` 改为 `min(rollCount - 1, 2)`，符合“每回合至多因此受到 2 伤害”。
- `src/games/dicethrone/heroes/ninja/cards.ts`
  - `ninja-card-dojo` 从错误的直接授予 `smoke_bomb=1` 与 `ninjutsu=2` 改为：投 1 骰；面具分支获得烟雾弹和 2 忍术；否则抽 1。
- `public/locales/zh-CN/game-dicethrone.json` / `public/locales/en/game-dicethrone.json`
  - 补齐 Ninja `ninja-card-dojo` 的真实卡图描述，以及道场奖励骰成功/失败分支展示文案。
- `e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts`
  - 新增 `ninja-card-dojo` 真实手牌 E2E：从 Ninja 主阶段手牌打出，分别覆盖面具成功分支与非面具抽牌分支，并验证奖励骰特写和收口状态。
  - 新增 `ninja-card-shuriken` 真实手牌 E2E：投掷阶段打出攻击修正牌，5 骰中 3 忍刀，收口后 `bonusDamage=3`、`attackModifierBonusDamage=3`。
  - 新增 `ninja-card-vanish` 真实手牌 E2E：主阶段手牌打出后获得烟雾弹。
  - 新增 `ninja-card-escape` 真实手牌 E2E：受击 `afterAttackResolved` 响应窗中打出，奖励骰手里剑分支授 2 点护盾，并在伤害响应收口后验证 HP 30 -> 25、`pendingDamage` 清空。
- `evidence/dicethrone/dicethrone-ninja-dojo-real-hand-e2e-2026-05-17.md`
  - 记录 Dojo L3 截图链与逐张肉眼观察结论。
- `evidence/dicethrone/dicethrone-ninja-shuriken-vanish-real-hand-e2e-2026-05-17.md`
  - 记录 Shuriken / Vanish L3 截图链与逐张肉眼观察结论。
- `evidence/dicethrone/dicethrone-ninja-escape-real-hand-e2e-2026-05-17.md`
  - 记录 Escape L3 截图链与逐张肉眼观察结论。
- `evidence/dicethrone/dicethrone-ninja-main-action-real-hand-e2e-2026-05-17.md`
  - 记录 Training / Poison Dart / Knife Fan 主阶段真实手牌 L3 截图链与逐张肉眼观察结论。

## 验证证据

- `npx vitest run src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts --configLoader native --maxWorkers 1`
  - 早期结果：通过，11 tests passed。
  - 新增覆盖：
    - Rooted 按树枝 + 树灵总数防止伤害，不再对攻击者反击，也不再按单颗树叶/树灵直接发 token。
    - Rooted 双树叶时出现养成 1 树灵选择，选择后再按减伤后的攻击伤害结算。
    - Rooted II 掷 4 骰；双树灵时可选择自己获得生命源泉，并按树枝 + 树灵总数防止伤害。
    - Wild Growth II 升级后，在 2 树枝 + 3 树叶骰面下 `getAvailableAbilityIds(...)` 包含 `wild-growth`。
    - Wild Growth II 选择“移除 1 幼种 + 1 木苗树灵并弃生命源泉”后，消耗对应 token，`bonusDamage=8`，`isDefendable=false`，最终造成 12 伤害，且不再产生 `HEAL_APPLIED`。
    - Tend & Care 基础版抽 1 后可选择养成 3 树灵的最终分布，并可把生命源泉给任一玩家、把刺藤给对手。
    - Tend & Care II 使用升级后的 4 次养成合同，覆盖从 0 树灵养成到 `2 幼种 + 1 木苗` 的路径，不再是固定 `幼种3 + 木苗1`。
    - Forest Awakens 在 2v2 中可选择养成 5 树灵后的最终分布，自己和队友获得生命源泉，防御目标获得刺藤，并最终造成 10 点终极伤害。
    - Nature Touch II 选择“养成后幼种 3、木苗 1”后，写回树灵 token，`bonusDamage=4`，最终造成 10 点不可防御伤害，且不进入防御结算。
- `npx vitest run src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts src/games/dicethrone/__tests__/treant-token-mechanics.test.ts --configLoader native --maxWorkers 1`
  - 追加修复前结果：通过，19 tests passed。
  - 追加修复后 `treant-ability-card-contract.test.ts` 已扩展到 19 tests，单文件通过；与 `treant-token-mechanics.test.ts` 合计 27 tests passed。
- `npx vitest run src/games/dicethrone/__tests__/customaction-category-consistency.test.ts --configLoader native --maxWorkers 1`
  - 结果：通过，10 tests passed。
- `npx vitest run src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/customaction-category-consistency.test.ts --configLoader native --maxWorkers 1`
  - 追加修复前结果：通过，29 tests passed。
  - 追加修复后结果：通过，37 tests passed。
  - 新增覆盖：
    - Quiet Cultivation 按养成 1 树灵选择最终分布，不再固定幼种。
    - Shattering Fist 基础版可移除 1 树灵施加刺藤；II 固定刺藤并维持 5/6/7；III 三同点触发养成 1。
    - Treant 专属卡 Drink Deep 可选择任一玩家获得生命源泉。
    - Harvest 可移除至多 3 树灵获得 CP，且移除至少 2 时可选择至多 2 名玩家获得生命源泉。
    - Planting / Cultivate / Downpour / Mother Tree 均按养成最终分布结算，不再固定幼种。
    - Trample 按树枝数加攻击修正伤害，且只有加伤至少 3 才施加刺藤。
    - Soulfire 树枝造成全对手附属伤害，树叶获得生命源泉，树灵养成 1 树灵。
- `npx eslint src/games/dicethrone/heroes/treant/abilities.ts src/games/dicethrone/domain/customActions/treant.ts src/games/dicethrone/domain/events.ts src/games/dicethrone/domain/systems.ts src/games/dicethrone/hooks/useDiceThroneState.ts src/games/dicethrone/ui/ChoiceModal.tsx src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts`
  - 结果：通过；`systems.ts` 保留既有 `no-explicit-any` warning，无新增 error。
- `npm run typecheck`
  - 结果：通过。
- `npm run i18n:check`
  - 结果：通过，`i18n-check: no missing keys detected.`
- `npx vitest run src/games/dicethrone/__tests__/treant-token-mechanics.test.ts --configLoader native --maxWorkers 1`
  - 结果：通过，8 tests passed。
  - 新增覆盖：`rollCount=5` 且身上有 `thorn` 时仍只受到 2 点伤害，并消耗刺藤。
- `npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts --configLoader native --maxWorkers 1`
  - 2026-05-17 实测通过，`5/5` tests passed。
  - 新增覆盖：`ninja-card-dojo` 的面具成功分支获得烟雾弹和 2 忍术；非面具分支抽 1，且不直接获得 token。
- `npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/card-cross-audit.test.ts src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native --maxWorkers 1`
  - 2026-05-17 实测通过，`4` 个 test files / `99` tests passed。
  - 覆盖面：Ninja Dojo + Treant 能力/卡牌合同 + Treant token 机制 + 共享卡图/升级合同 + Gunslinger/Samurai 既有交叉行为回归。
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者道场应通过真实手牌打出并按骰面分支结算"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\01-dojo-mask-before-drag.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\02-dojo-mask-bonus-die-overlay.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\03-dojo-mask-after-closeout.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\05-dojo-other-bonus-die-overlay.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\06-dojo-other-after-closeout.png`
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者雾隐应通过真实手牌打出并获得烟雾弹"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者雾隐应通过真实手牌打出并获得烟雾弹\01-vanish-before-drag.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者雾隐应通过真实手牌打出并获得烟雾弹\02-vanish-after-play-smoke-bomb.png`
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正\01-shuriken-before-drag.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正\02-shuriken-bonus-dice-overlay.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正\03-shuriken-after-closeout-bonus-damage.png`
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰\01-escape-before-drag-pending-damage.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰\02-escape-bonus-die-overlay-detail.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰\03-escape-after-closeout-shield-granted.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰\04-escape-after-end-attack-damage-resolved.png`
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算\01-training-before-drag.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算\02-training-after-play-ninjutsu.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算\04-poison-dart-after-play-delayed-poison.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算\06-knife-fan-after-play-direct-damage.png`

## Completion audit（2026-05-17）

| 验收项 | 当前状态 | 证据 | 结论 |
| --- | --- | --- | --- |
| Wild Growth II 在 `2 Branch + 3 Leaf` 下可选 | 已修 | `treant-ability-card-contract.test.ts` 中 `Wild Growth II 升级后仍应在 2 树枝 + 3 树叶骰面下可选择` | 通过 L2 |
| Wild Growth / II 图面效果 | 已修 | 同文件覆盖移除至多 2 树灵、每个 +4、弃生命源泉不可防御、无治疗事件 | 通过 L2 |
| Treant 树灵/生命源泉/刺藤关键机制 | 局部修复并有代表链 | `treant-token-mechanics.test.ts` 与 Treant E2E 截图链 | 代表覆盖，不是全卡 L3 |
| Ninja Dojo | 已修 | `ninja-ability-card-contract.test.ts` 两分支；`dicethrone-treant-ninja-mechanics.e2e.ts` 真实手牌两分支截图链 | 通过 L3 |
| Ninja Shuriken / Vanish / Escape | 已补真实入口 | `dicethrone-treant-ninja-mechanics.e2e.ts` 真实手牌截图链；`dicethrone-ninja-shuriken-vanish-real-hand-e2e-2026-05-17.md`；`dicethrone-ninja-escape-real-hand-e2e-2026-05-17.md` | 通过 L3 |
| Ninja Training / Poison Dart / Knife Fan | 已补真实入口 | `dicethrone-treant-ninja-mechanics.e2e.ts` 主阶段真实手牌截图链；`dicethrone-ninja-main-action-real-hand-e2e-2026-05-17.md` | 通过 L3 |
| Gunslinger Bounty 文档漂移 | 已回写 | `枪手录入核对.md`、`dicethrone-gunslinger-audit-2026-04-11.md`、`dicethrone-paladin-blessing-removable-fix.md` | 文档漂移已处理 |
| Samurai 本轮重扫 | 未发现新增代码 bug | `武士录入核对.md`、`武士卡牌录入核对.md`、`cross-hero.test.ts` 既有覆盖 | 只能写静态/既有证据复用 |
| Wiki 差异记录 | 已补本轮对照 | 本节 Treant/Ninja/Bounty/Samurai Wiki 链接 | Wiki 不覆盖本地图 |
| 全部新派系全面审计完成 | 未完成 | 仍缺 Ninja/Treant 多张专属卡真实打出 L3、Gunslinger/ Samurai 部分 UI/evidence 缺口 | 不得宣称完成 |

## 未完成与风险

- Treant 全量仍未收口：本轮只代表基础技能/被动/终极与 15 张专属卡主效果已局部接入正确养成/防御/目标选择语义，树灵每回合限用与神性树灵防负面可选只补了代表性真实入口链，不代表专属卡真实打出 L3 已完成，也不代表 Treant 可发布收口。
- Ninja 全量仍未收口：Training、Poison Dart、Knife Fan、Dojo、Shuriken、Vanish、Escape 已补真实手牌 L3；多数升级卡和部分基础/升级技能本体仍缺真实入口 L3。
- Gunslinger / Samurai 本轮已补 Wiki 差异与静态重扫结论，但没有新增逐对象 L3，因此不能把“未发现新增 bug”写成“全面审计完成”。
- Wild Growth 当前支持精确选择被移除的幼种/木苗/神性树灵；每回合每种树灵只能花费一次的通则已接入共享状态门禁，但仍需后续扩展更多真实入口覆盖。
