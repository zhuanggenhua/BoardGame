# Dice Throne 树精录入核对

> 主真相源：`public/assets/i18n/zh-CN/dicethrone/images/treant/**`。实现入口：`src/games/dicethrone/heroes/treant/**`、`src/games/dicethrone/domain/customActions/treant.ts`、`flowHooks.ts`、`passiveAbility.ts`。状态等级：L0 素材定位；L1 静态/i18n/资源；L2 领域行为测试；L3 真实 UI/E2E；L4 复杂交互闭环。

## 2026-05-16 口径修订

- 旧版本虽然已经覆盖了树灵、生命源泉、刺藤、`rooted` 防御时机等流程问题，但在**数据录入阶段**漏掉了“玩家板图面合同”。
- 具体失效点：
  - `quiet-cultivation` 曾被错误落入普通技能共享槽语义；
  - `rooted` 曾被错误挂到 `calm`，导致防御高亮落到倒数第二个技能；
  - 根因不是“没有图片”，而是“有图却没有逐槽按图核对玩家板合同”。
- 因此，本文件必须先把 Treant 玩家板图面合同补成正式录入口径；`evidence/dicethrone/dicethrone-treant-slot-audit-2026-05-16.md` 只负责验证实现是否符合这份录入合同，不再承担“替代录入建合同”的职责。

## 角色基础

| 项 | 结构化字段 | 来源定位 | 状态 | 疑点 |
|---|---|---|---|---|
| 角色 ID | `treant` | 目录名/代码注册 | L3：选角进局 E2E | 无 |
| 中文名 | 树精 | 玩家面板/选角文案 | L3：选角截图可见 | 无 |
| 骰面 | 1/2/3=`branch`，4/5=`leaf`，6=`spirit` | `dice.png`/`diceConfig.ts` | L1 | 无 |
| 面板规格 | v2 宽屏面板，`2048x1233` | `player-board.png` | L3：进局截图可见 | 无 |

## 玩家板图面合同

| 图面区域/槽位 | 图片直接观察结论 | 运行时应绑定对象 | 允许状态 | 当前证据 |
|---|---|---|---|---|
| 左下紫色独立槽 | 独立被动区，不属于普通技能列 | `quiet-cultivation` | passive / 非普通技能候选 | 见 `dicethrone-treant-slot-audit-2026-05-16.md` 的 Vitest + E2E |
| 右上中间普通技能槽 | 普通技能区 | `wild-growth` | offensive | 同上 |
| 中右普通技能槽 | 普通技能区 | `vengeful-vines` / `nature-touch` | offensive | 同上 |
| 右下防御槽 | 独立防御区 | `rooted` | defensive | 同上 |
| `calm` 旧共享槽语义 | Treant 图面不应再把它当成 `rooted` 承载位 | 空 / 不命中 `rooted` | empty / 非 `rooted` | 同上 |

- 结论：Treant 不能继续沿用旧共享 `combo/lightning/lotus/calm` 语义直接反推整张面板；至少 `quiet-cultivation` 和 `rooted` 已证明必须按图面 override。

## 技能 / 被动 / 防御逐项核对

| ID | 类型 | 原文/图文要点 | 结构化字段 | 实现入口 | 状态 |
|---|---|---|---|---|---|
| `shattering-fist` | offensive | 3/4/5 树枝造成 5/6/7 伤害 | `diceSet branch=3/4/5`，damage 5/6/7 | `abilities.ts` | L1 |
| `shattering-fist-2` | upgrade | 破碎之拳 II，伤害提升 | replace `shattering-fist`，damage 6/7/8 | `cards.ts` + `abilities.ts` | L1 |
| `shattering-fist-3` | upgrade | 破碎之拳 III，施加刺藤并伤害 | replace `shattering-fist`，grant `thorn` + damage 6/7/8 | `cards.ts` + `abilities.ts` | L2：刺藤后续伤害已测 |
| `tend-care` | utility | 抽牌、养成树灵、生命源泉、刺藤 | draw 1；seedling 3；life_sap 1；opponent thorn 1 | `abilities.ts` | L1 |
| `tend-care-2` | upgrade | 细心呵护 II，额外木苗树灵 | draw 1；seedling 3；sapling 1；life_sap 1；thorn 1 | `cards.ts` + `abilities.ts` | L2：木苗主动消费已测 |
| `vengeful-vines` | offensive | 小顺子，刺藤 + 7 伤害 | smallStraight；thorn 1；damage 7 | `abilities.ts` | L1 |
| `vengeful-vines-2` | upgrade | 复仇枝蔓 II，刺藤 + 8 伤害 | smallStraight；thorn 1；damage 8 | `cards.ts` + `abilities.ts` | L2：刺藤后续伤害已测 |
| `nature-touch` | offensive | 4 树灵，养成并不可防御伤害 | spirit=4；seedling 2；unblockable damage 5 | `abilities.ts` | L1 |
| `nature-touch-2` | upgrade | 自然之触 II，不可防御伤害提升 | seedling 2；unblockable damage 6 | `cards.ts` + `abilities.ts` | L1 |
| `quiet-cultivation` | passive | 维持阶段养成树灵；图面位于左下独立被动槽 | phaseStart upkeep；seedling +1；图面合同见上表 | `abilities.ts`/`flowHooks.ts`/`ui/abilitySlotMapping.ts`；`treant-ninja-sample-deep-check.test.ts` | L2 + 图面合同专项；缺真实流程 L3 |
| `wild-growth` | offensive | 2 树枝 + 3 树叶，伤害并治疗 | damage 2；heal 1 | `abilities.ts` | L1 |
| `wild-growth-2` | upgrade | 野蛮生长 II，伤害提升 | damage 4；heal 1 | `cards.ts` + `abilities.ts` | L1 |
| `rooted` | defensive | 防御掷 3 骰，按树枝/树叶/树灵结算；图面位于右下独立防御槽 | branch +1 反击，leaf seedling，spirit life_sap；`withDamage` 防御时机；图面合同见上表 | `abilities.ts`/`ui/abilitySlotMapping.ts` | L3：真实防御推进与不可防御跳过防御已测；图面合同专项见 `dicethrone-treant-slot-audit-2026-05-16.md` |
| `rooted-2` | upgrade | 扎根 II，防御掷 4 骰 | defensive diceCount 4；复用 `withDamage` 防御时机 | `cards.ts` + `abilities.ts` | L2：共享 rooted 防御合同 |
| `forest-awakens` | ultimate | 终极技：生命源泉、养成、刺藤、10 伤害 | ultimate；life_sap 1；seedling 5；thorn 1；damage 10 | `abilities.ts` | L1 |

## Token / 状态逐项核对

| ID | 中文 | 类型/上限 | 原文/图文要点 | 结构化字段 | 实现/验证 | 状态 |
|---|---|---:|---|---|---|---|
| `treant_seedling` | 幼种树灵 | consumable / 3 | 自己掷骰阶段花费 1 个，重掷 1 颗自己的骰子 | passive action `rerollDie`，tokenCost 1，`ownRollPhase` | `passiveAbility.ts` + `execute.ts`；`treant-token-mechanics.test.ts`；`dicethrone-treant-ninja-mechanics.e2e.ts` 真实骰子按钮重掷截图链 | L3：真实 UI 重掷闭环 |
| `treant_sapling` | 木苗树灵 | consumable / 2 | 主阶段花费 1 个治疗 1 并 +1CP；或额外 1CP 抽 1 | passive custom `treant-sapling-heal-cp` / `treant-sapling-draw` | `customActions/treant.ts`；`treant-token-mechanics.test.ts` 覆盖治疗+CP 与额外 1CP 抽牌分支；真实 UI 短按钮与两分支截图链 | L3：真实 UI 两分支闭环 |
| `treant_divine` | 神性树灵 | consumable / 1 | 造成伤害前 +3；可防止即将受到的负面状态 | `activeUse.modifyDamageDealt +3`；preDefense debuff filter | `tokens.ts` + `flowHooks.ts`；防 debuff 与 beforeDamageDealt +3 已测；攻击方响应窗 +3 与防负面阶段推进 E2E | L4：响应窗/阶段推进闭环 |
| `life_sap` | 生命源泉 | buff / 1 | 主阶段花费并掷 1 骰，治疗骰值一半向上取整 | passive custom `treant-life-sap-use`；bonus die + display-only settlement | `customActions/treant.ts`；`treant-token-mechanics.test.ts`；真实奖励骰特写/治疗/收口截图链 | L4：奖励骰特写与收口闭环 |
| `thorn` | 刺藤 | debuff / 1 | 进攻掷骰结束移除，并按额外投掷次数受伤 | `offensiveRoll` phase exit，damage `rollCount - 1` | `flowHooks.ts`；`treant-token-mechanics.test.ts`；阶段推进反伤并消耗 E2E 截图链 | L4：阶段推进闭环 |

## 当前结论

- 旧结论“树灵消费重掷、木苗、刺藤为 L2 债务”已失效：这些机制已实现并进入 L2 测试层。
- 2026-05-15 完整流程重审发现 `rooted` 曾停留在静态 L1 且防御时机错误，现已修为 `withDamage` 并补 L2/L3 证据。
- 2026-05-16 又追加发现：Treant 图面合同不能靠共享旧槽位语义推断。`quiet-cultivation`/`rooted` 的图面落点必须直接按玩家板图片核对，当前专项证据见 `dicethrone-treant-slot-audit-2026-05-16.md`。
- Treant 远未达到“全对象已修好”：当前只有 `rooted` 达到明确 L3，Token/状态链路大体已进 L3/L4，但多数基础/升级技能仍停在 L1/L2，尚未逐技能证明真实入口链路。
- 本文件不再使用“当前发布口径已收口”概括整批对象；Treant 全对象只能按 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md` 中逐项 L1/L2/L3/L4 矩阵结论判定。
