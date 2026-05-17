# DiceThrone 新派系重审与 Wiki 差异记录（2026-05-17）

## 范围与口径

- 本轮触发问题：Treant `wild-growth` / `wild-growth-2`（中文 UI 为“野蛮生长 / 野蛮生长 II”，用户口径“野性怒吼2”疑似指同一升级技能）在 2 树枝 + 3 树叶骰面下，升级后不能按图面选择“移除树灵加伤 / 弃生命源泉不可防御”。
- 主真相源：`src/games/dicethrone/rule/treant录入核对.md` 与 `src/games/dicethrone/rule/treant卡牌录入核对.md` 中记录的玩家板/卡图核对结论；清晰图片优先于 Wiki。
- Wiki 仅作差异记录：本轮读取 Dice Throne Wiki 的 Treant 页面（https://dice-throne.fandom.com/wiki/Treant），确认 Wiki 提供 Treant 精灵/生命源泉/树灵通则说明，但页面正文没有列出 Wild Growth 的完整玩家板技能文本；因此本轮不使用 Wiki 覆盖图片口径。
- 新派系全集重审对象暂列为：`gunslinger`、`samurai`、`treant`、`ninja`。当前 Treant 基础技能/被动/终极主效果已修到 L2，15 张专属卡已补逐卡真实手牌 L3，树灵每回合限用与神性树灵防负面可选响应已补代表链；Ninja `Training` / `Poison Dart` / `Knife Fan` / `Dojo` / `Shuriken` / `Vanish` / `Escape`、8 张升级卡，以及一组技能本体真实玩家板入口已补 L3。Treant/Ninja 不得据此宣称所有组合分支 L4 完成。

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
| `treant` | 玩家板技能、树灵/生命源泉/刺藤、15 张专属卡主效果 | 已修复 Wild Growth II 触发与主效果；多条技能/卡牌从旧错误语义修到图片口径；15 张专属卡已补逐卡真实手牌入口 L3 | 主效果 L2；15 张专属卡真实手牌 L3；树灵限用与神性树灵响应有代表性 L3 截图链 | 基础技能/token/多目标多骰面组合仍不能外推为全分支 L4 |
| `ninja` | 玩家板技能、三种 token、专属卡与升级卡 | 已修 Dojo 漏骰分支；7 张专属行动卡与 8 张升级卡已补真实手牌 L3；技能本体已补 `slash-2`、`going-forward-2`、`shadow-step-2`、`smoke-screen-2`、`shadow-fang-2`、`poison-blade-2`、`death-blossom-2`、终极技真实玩家板代表链；烟雾弹失败分支已补真实 UI/E2E | Token 复杂链路 L4；专属行动卡/升级卡真实手牌 L3；技能本体代表 L3 | 仍不能外推每个基础版/升级版、每种骰面组合和所有防御/响应/减伤分支 L4 |
| `gunslinger` | 玩家板、Loaded/Bounty、专属卡与复合升级 | 本轮静态重扫发现 `Quick Draw II / Fill'Em With Lead` 的 Loaded 重掷仍有结构层残余，已收敛为 `tokenBonusDieReroll` 定义层 hook；并修正文档漂移：`Bounty` 不自动过期但可被移除状态链路移除；`Quick Draw II / Fill'Em With Lead` Loaded 可重掷、`Spin the Chamber`、`Eat My Lead` 与 The Law 单选均已补真实 UI 证据 | 既有 L2/L3 证据复用；`Bye Bye` 移除 Bounty 有真实手牌 E2E 文档；Loaded 重掷本轮有定义层合同测试和行为回归；多条枪手 UI 链路通过 L3 | `mark-the-target` 仍不能写成 UI L3 |
| `samurai` | 玩家板、Honor/Shame/Back Strike、专属卡与复合升级 | 本轮静态重扫未发现新增运行时代码 bug；本地文档显示 Masamune II、复合升级、行动/攻击修正卡已回到本地合同；`Zanshin` 多骰攻击修正已复跑真实 UI 链路 | 既有 L2 为主；`Zanshin` 攻击修正本轮复跑 L3；Honor/Back Strike 等仍复用历史 E2E | 仍未新增逐对象全集 L3；不能把历史“无角色级 residual”改写成新一轮全面审计完成 |

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
- `src/games/dicethrone/domain/execute.ts` / `src/games/dicethrone/domain/commandValidation.ts`
  - 修复 Ninja `shadow-step` 被全局兼容别名误改成 Moon Elf `elusive-step` 的入口 bug；现在只有当前玩家没有 `shadow-step` 且拥有 `elusive-step` 时才走旧兼容别名。
- `src/games/dicethrone/domain/rules.ts`
  - `offensiveRoll` 可用技能筛选允许 `utility` 类型，修复 Ninja `smoke-screen` / Treant `tend-care` 这类非伤害骰面技能无法从真实玩家板槽位选择的问题。
- `e2e/dicethrone/dicethrone-ninja-ability-real-entry.e2e.ts`
  - 新增 Ninja 技能本体真实玩家板 E2E：覆盖 `slash-2`、`going-forward-2`、`shadow-step-2`、`smoke-screen-2`、`shadow-fang-2`、`poison-blade-2`、`death-blossom-2`、`ninja-assassinate` 的槽位入口、代表结算、奖励骰特写与收口。
- `src/games/dicethrone/domain/combat/types.ts` / `src/games/dicethrone/heroes/gunslinger/abilities.ts` / `src/games/dicethrone/domain/customActions/gunslinger.ts`
  - 新增 `tokenBonusDieReroll` 定义层 hook；`Quick Draw II` 声明为 `scope: allTokenUses`，`Fill'Em With Lead` 声明为来源技能级 Loaded 重掷 hook；`handleLoadedUse()` 改为读取能力定义，不再用 `sourceAbilityId === 'fill-em-with-lead' || quickDrawLevel >= 2` 硬编码承接。
- `src/games/dicethrone/__tests__/gunslinger-loaded-contract.test.ts`
  - 新增 Gunslinger Loaded 重掷定义层合同测试，防止 `Quick Draw II / Fill'Em With Lead` 的 hook 回退为隐式分支。
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
- `evidence/dicethrone/dicethrone-ninja-upgrade-real-hand-e2e-2026-05-17.md`
  - 记录 8 张 Ninja 升级卡主阶段真实手牌 L3 截图链、`abilityLevels` 与 `upgradeCardByAbilityId` 断言。
- `evidence/dicethrone/dicethrone-ninja-smoke-bomb-failure-e2e-2026-05-17.md`
  - 记录 Smoke Bomb 失败骰面真实响应窗 E2E、失败后保留伤害与跳过响应后扣伤害的闭环。
- `evidence/dicethrone/dicethrone-ninja-ability-real-entry-e2e-2026-05-17.md`
  - 记录 Ninja 技能本体真实玩家板入口 L3 证据、`shadow-step` 别名修复、`utility` 入口修复、奖励骰特写与逐张截图肉眼观察。
- `evidence/dicethrone/dicethrone-treant-full-audit-2026-05-16.md`
  - 回写 Treant 15 张专属卡逐卡真实手牌 L3 证据链；本轮复跑 `树精专属主阶段卡...`、`树精践踏...`、`树精剩余升级卡...`、`树精剩余主阶段动作卡...`、`树精魂火...` 共 5 条 E2E 均通过。
- `evidence/dicethrone/dicethrone-gunslinger-audit-2026-04-11.md` / `src/games/dicethrone/rule/枪手录入核对.md`
  - 回写 `Quick Draw II / Fill'Em With Lead` 的 Loaded 重掷结构层 finding 已收敛；新增两者花费 Loaded 后可重掷单骰特写的真实 UI 证据，同时保留其他枪手对象 UI 独立 evidence 缺口。
- `evidence/dicethrone/dicethrone-gunslinger-the-law-multiselect-e2e-test.md`
  - 补齐 The Law “至多 2 名目标”场景中只选 1 名目标后的最终态截图，证明弹窗关闭、只给被选 P2 施加 `bounty + knockdown`，未误伤未选 P3。
- `e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts`
  - 新增 `Spin the Chamber` 真实手牌 UI 链路：主阶段打出后获得 1 个 Loaded，手牌移除并进入弃牌。
  - 新增 `Eat My Lead` 真实手牌 UI 链路：攻击掷骰阶段打出后出现 5 骰奖励结果、`攻击修正 +5` 与击倒，并可关闭奖励骰特写。
- `evidence/dicethrone/samurai-attack-modifier-e2e-test.md`
  - 2026-05-17 复跑 `Zanshin` 5 骰攻击修正真实 UI 链路，并回写新截图路径与肉眼观察。

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
- `node node_modules/eslint/bin/eslint.js e2e/dicethrone/dicethrone-ninja-ability-real-entry.e2e.ts src/games/dicethrone/domain/execute.ts src/games/dicethrone/domain/commandValidation.ts src/games/dicethrone/domain/rules.ts`
  - 2026-05-17 实测通过。
- `npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts src/games/dicethrone/__tests__/moon-elf-abilities.test.ts --configLoader native --maxWorkers 1`
  - 2026-05-17 实测通过，`2` 个 test files / `40` tests passed。
- `npm run test:e2e:ci -- e2e/dicethrone/dicethrone-ninja-ability-real-entry.e2e.ts`
  - 2026-05-17 实测通过，`3 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-ability-real-entry.e2e\基础与升级技能应从真实玩家板槽位进入正确 sourceAbilityId\03-shadow-step-2-before-click.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-ability-real-entry.e2e\不可防御、utility 与终极技能应从真实槽位结算到权威状态\06-smoke-screen-2-after-resolve.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-ability-real-entry.e2e\死亡盛放 II 应从真实槽位触发奖励骰特写并收口\03-death-blossom-2-bonus-dice-overlay-detail.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-ability-real-entry.e2e\不可防御、utility 与终极技能应从真实槽位结算到权威状态\08-assassinate-after-resolve.png`
- `node node_modules/eslint/bin/eslint.js src/games/dicethrone/__tests__/gunslinger-loaded-contract.test.ts src/games/dicethrone/domain/combat/types.ts src/games/dicethrone/heroes/gunslinger/abilities.ts src/games/dicethrone/domain/customActions/gunslinger.ts`
  - 2026-05-17 实测通过。
- `npx vitest run src/games/dicethrone/__tests__/gunslinger-loaded-contract.test.ts --configLoader native --maxWorkers 1`
  - 2026-05-17 实测通过，`2 tests passed`。
- `npx vitest run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native --maxWorkers 1 -t "fill-em-with-lead can reroll|upgrade quick-draw makes loaded|wild west keeps fixed|base loaded choice"`
  - 2026-05-17 实测通过，`5 passed / 61 skipped`。
- `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "gunslinger quick draw II should make loaded spotlight rerollable after real choice click"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-quick-draw-II-should-make-loaded-spotlight-rerollable-after-real-choice-click\23-gunslinger-quick-draw-2-loaded-choice-before-use.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-quick-draw-II-should-make-loaded-spotlight-rerollable-after-real-choice-click\24-gunslinger-quick-draw-2-loaded-rerollable-spotlight.png`
  - 肉眼观察：第一张图为真实战斗页面上的“技能结算选择”弹窗，能看到“装填”选项；第二张图为单骰奖励骰特写，能看到右侧骰面列表与“点击骰子花费 0 装填重投”提示，顶部装填 token 已扣为 0。该截图链证明 `Quick Draw II` 的全局 Loaded 重掷 hook 已进入真实 UI。
- `node scripts/infra/check-file-encoding.mjs --quiet`
  - 2026-05-17 实测通过；用于排除一次 E2E 启动前编码候选文件 ENOENT 的瞬态问题。
- `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "gunslinger fill em with lead should make sourced loaded spotlight rerollable"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-fill-em-with-lead-should-make-sourced-loaded-spotlight-rerollable\25-gunslinger-fill-em-with-lead-loaded-choice-before-use.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-fill-em-with-lead-should-make-sourced-loaded-spotlight-rerollable\26-gunslinger-fill-em-with-lead-loaded-rerollable-spotlight.png`
  - 肉眼观察：第一张图为真实战斗页面上的“技能结算选择”弹窗，能看到“装填”选项；第二张图为单骰奖励骰特写，能看到右侧骰面列表与“点击骰子花费 0 装填重投”提示，顶部装填 token 已扣为 0。用例同时断言 `sourceAbilityId=fill-em-with-lead` 与 `maxRerollCount=1`，证明来源技能级 Loaded 重掷 hook 已进入真实 UI。
- `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "should allow confirming after selecting only one target"`
  - 2026-05-17 首次执行在 `openTestGame` 等测试 harness 时命中页面启动保护页，重试通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-allow-confirming-after-selecting-only-one-target\14-the-law-single-target-selected.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-allow-confirming-after-selecting-only-one-target\14-the-law-single-target-resolved.png`
  - 肉眼观察：选择态截图中只选 P2 后确认按钮可用；结算态截图中弹窗已关闭，P2 有赏金与击倒，P3 无对应新增图标，证明 The Law 单选最终态已闭环。
- `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "gunslinger spin the chamber should grant loaded from real hand play"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-spin-the-chamber-should-grant-loaded-from-real-hand-play\27-gunslinger-spin-the-chamber-before-play.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-spin-the-chamber-should-grant-loaded-from-real-hand-play\28-gunslinger-spin-the-chamber-after-play-loaded.png`
  - 肉眼观察：打出前真实手牌区可见 `转动弹槽！`；打出后左侧状态区出现 Loaded 图标，CP 从 2 扣到 1，卡牌进入弃牌区。
- `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "gunslinger eat my lead should roll five bonus dice from real hand play"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-eat-my-lead-should-roll-five-bonus-dice-from-real-hand-play\29-gunslinger-eat-my-lead-before-play.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-eat-my-lead-should-roll-five-bonus-dice-from-real-hand-play\30-gunslinger-eat-my-lead-bonus-dice-overlay.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-eat-my-lead-should-roll-five-bonus-dice-from-real-hand-play\31-gunslinger-eat-my-lead-after-closeout.png`
  - 肉眼观察：打出前真实手牌区可见 `吃我的铅弹！`；奖励骰阶段可见 5 个子弹骰、`攻击修正 +5` 与目标击倒；关闭后奖励骰特写消失，结果仍保留。
- `npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "samurai zanshin should settle 5 bonus dice and synchronize effects against paladin"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-overlay.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-closed.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-settled.png`
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
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者升级卡应通过真实手牌逐张升级到正确技能"`
  - 2026-05-17 实测通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\01-upgrade-blink-2-before-drag.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\01-upgrade-blink-2-after-play.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者升级卡应通过真实手牌逐张升级到正确技能\08-upgrade-death-blossom-2-after-play.png`
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者烟雾弹失败骰面应消耗 token 但保留伤害并可继续结算"`
  - 2026-05-17 首次执行被 CPU 重任务门禁拦截；等待后重跑通过，`1 passed`。
  - 关键截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者烟雾弹失败骰面应消耗token但保留伤害并可继续结算\01-smoke-bomb-failure-token-response-before-use.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者烟雾弹失败骰面应消耗token但保留伤害并可继续结算\02-smoke-bomb-failure-after-use-pending-damage.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者烟雾弹失败骰面应消耗token但保留伤害并可继续结算\03-smoke-bomb-failure-after-damage-resolved.png`
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "树精专属主阶段卡应通过真实手牌完成升级与选择结算代表链"`
  - 2026-05-17 本轮复跑通过，`1 passed`。
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "树精践踏应通过真实手牌打出并在奖励骰收口后计入攻击修正"`
  - 2026-05-17 本轮补奖励骰局部截图后复跑通过，`1 passed`。
  - 关键截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精践踏应通过真实手牌打出并在奖励骰收口后计入攻击修正\02-trample-bonus-dice-overlay-detail.png`
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "树精剩余升级卡应通过真实手牌逐张升级到正确技能"`
  - 2026-05-17 本轮实测通过，`1 passed`。
  - 关键截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精剩余升级卡应通过真实手牌逐张升级到正确技能\05-upgrade-wild-growth-2-after-play.png`
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "树精剩余主阶段动作卡应通过真实手牌逐张结算"`
  - 2026-05-17 本轮实测通过，`1 passed`。
  - 关键截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精剩余主阶段动作卡应通过真实手牌逐张结算\11-mother-tree-spirit-after-resolve.png`
- `npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "树精魂火应通过真实手牌打出并结算三种骰面分支"`
  - 2026-05-17 本轮实测通过，`1 passed`。
  - 关键截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精魂火应通过真实手牌打出并结算三种骰面分支\02-soulfire-bonus-dice-overlay-detail.png`

## Completion audit（2026-05-17）

| 验收项 | 当前状态 | 证据 | 结论 |
| --- | --- | --- | --- |
| Wild Growth II 在 `2 Branch + 3 Leaf` 下可选 | 已修 | `treant-ability-card-contract.test.ts` 中 `Wild Growth II 升级后仍应在 2 树枝 + 3 树叶骰面下可选择` | 通过 L2 |
| Wild Growth / II 图面效果 | 已修 | 同文件覆盖移除至多 2 树灵、每个 +4、弃生命源泉不可防御、无治疗事件 | 通过 L2 |
| Treant 15 张专属卡真实手牌入口 | 已补逐卡入口 | `dicethrone-treant-ninja-mechanics.e2e.ts` 五条 Treant 专属卡用例；`dicethrone-treant-full-audit-2026-05-16.md` | 通过逐卡入口 L3；不外推所有组合分支 L4 |
| Treant 树灵/生命源泉/刺藤关键机制 | 局部修复并有代表链 | `treant-token-mechanics.test.ts` 与 Treant E2E 截图链 | 代表覆盖，不是所有 token 组合 L4 |
| Ninja Dojo | 已修 | `ninja-ability-card-contract.test.ts` 两分支；`dicethrone-treant-ninja-mechanics.e2e.ts` 真实手牌两分支截图链 | 通过 L3 |
| Ninja Shuriken / Vanish / Escape | 已补真实入口 | `dicethrone-treant-ninja-mechanics.e2e.ts` 真实手牌截图链；`dicethrone-ninja-shuriken-vanish-real-hand-e2e-2026-05-17.md`；`dicethrone-ninja-escape-real-hand-e2e-2026-05-17.md` | 通过 L3 |
| Ninja Training / Poison Dart / Knife Fan | 已补真实入口 | `dicethrone-treant-ninja-mechanics.e2e.ts` 主阶段真实手牌截图链；`dicethrone-ninja-main-action-real-hand-e2e-2026-05-17.md` | 通过 L3 |
| Ninja 8 张升级卡 | 已补真实入口 | `dicethrone-treant-ninja-mechanics.e2e.ts` 主阶段真实手牌截图链；`dicethrone-ninja-upgrade-real-hand-e2e-2026-05-17.md` | 通过升级卡打出 L3；不外推技能本体所有分支 |
| Ninja 技能本体真实玩家板入口 | 已补代表链 | `dicethrone-ninja-ability-real-entry.e2e.ts`；`dicethrone-ninja-ability-real-entry-e2e-2026-05-17.md` | 通过技能本体代表 L3；`slash-2`/`going-forward-2`/`shadow-fang-2` 只证明入口，不外推所有防御后分支 |
| Ninja Smoke Bomb 失败分支 | 已补真实入口 | `dicethrone-treant-ninja-mechanics.e2e.ts` 响应窗截图链；`dicethrone-ninja-smoke-bomb-failure-e2e-2026-05-17.md` | 通过 L4 |
| Gunslinger Bounty 文档漂移 | 已回写 | `枪手录入核对.md`、`dicethrone-gunslinger-audit-2026-04-11.md`、`dicethrone-paladin-blessing-removable-fix.md` | 文档漂移已处理 |
| Gunslinger Loaded 重掷结构层与主要 UI | 已收敛一部分 | `tokenBonusDieReroll` 定义层 hook；`gunslinger-loaded-contract.test.ts`；`cross-hero.test.ts` 定向行为回归；`dicethrone-watch-out-spotlight.e2e.ts` 的 Quick Draw II / Fill'Em With Lead 单骰特写、The Law 单选最终态、Spin the Chamber、Eat My Lead 截图链 | Loaded 结构层通过定义层合同 + L2 行为；多条 UI 通过 L3；不外推 `mark-the-target` UI |
| Samurai 本轮重扫 | 未发现新增代码 bug；补一条真实 UI 复跑 | `武士录入核对.md`、`武士卡牌录入核对.md`、`samurai-attack-modifier-e2e-test.md`、`Zanshin` E2E 复跑 | `Zanshin` 通过 L3；其余对象仍以静态/既有证据复用为主 |
| Wiki 差异记录 | 已补本轮对照 | 本节 Treant/Ninja/Bounty/Samurai Wiki 链接 | Wiki 不覆盖本地图 |
| 全部新派系全面审计完成 | 未完成 | Treant/Ninja 专属卡入口已补到 L3，Ninja 技能本体已有代表 L3，Gunslinger Loaded 重掷结构层、多条代表 UI 与 The Law 单选最终态已补；但 Treant/Ninja 全组合 L4、Gunslinger `mark-the-target` UI、Samurai 部分 UI/evidence 缺口仍未全量补齐 | 不得宣称完成 |

## 未完成与风险

- Treant 全量仍未收口：15 张专属卡逐卡真实手牌入口 L3 已补，但基础技能/token/多目标多骰面组合仍是 L2 + 代表性 L3，不代表所有组合分支 L4 都已完成。
- Ninja 全量仍未收口：Training、Poison Dart、Knife Fan、Dojo、Shuriken、Vanish、Escape 与 8 张升级卡已补真实手牌 L3，`smoke_bomb` 成功/失败分支已补真实 UI/E2E；技能本体也已补一组真实玩家板代表 L3，但不能外推为每个基础版/升级版、每种骰面组合和所有防御/响应/减伤分支 L4。
- Gunslinger 本轮已补 `Quick Draw II / Fill'Em With Lead` 的 Loaded 重掷结构层 hook、行为回归与两条独立 UI/E2E 截图链，并补齐 The Law 单选最终态、Spin the Chamber、Eat My Lead；但 `mark-the-target` 仍缺真实 UI/E2E。Samurai 本轮只复跑 `Zanshin` 多骰攻击修正真实 UI 链路，其余对象仍以静态/既有证据复用为主。两者都不能写成“全面审计完成”。
- Wild Growth 当前支持精确选择被移除的幼种/木苗/神性树灵；每回合每种树灵只能花费一次的通则已接入共享状态门禁，但仍需后续扩展更多真实入口覆盖。
