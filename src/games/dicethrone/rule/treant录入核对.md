# Dice Throne 树精录入核对

> 主真相源：`public/assets/i18n/zh-CN/dicethrone/images/treant/**`。实现入口：`src/games/dicethrone/heroes/treant/**`、`src/games/dicethrone/domain/customActions/treant.ts`、`flowHooks.ts`、`passiveAbility.ts`。状态等级：L0 素材定位；L1 静态/i18n/资源；L2 领域行为测试；L3 真实 UI/E2E；L4 复杂交互闭环。

## 角色基础

| 项 | 结构化字段 | 来源定位 | 状态 | 疑点 |
|---|---|---|---|---|
| 角色 ID | `treant` | 目录名/代码注册 | L3：选角进局 E2E | 无 |
| 中文名 | 树精 | 玩家面板/选角文案 | L3：选角截图可见 | 无 |
| 骰面 | 1/2/3=`branch`，4/5=`leaf`，6=`spirit` | `dice.png`/`diceConfig.ts` | L1 | 无 |
| 面板规格 | v2 宽屏面板，`2048x1233` | `player-board.png` | L3：进局截图可见 | 无 |

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
| `quiet-cultivation` | passive | 维持阶段养成树灵 | phaseStart upkeep；seedling +1 | `abilities.ts`/`flowHooks.ts` | L1 |
| `wild-growth` | offensive | 2 树枝 + 3 树叶，伤害并治疗 | damage 2；heal 1 | `abilities.ts` | L1 |
| `wild-growth-2` | upgrade | 野蛮生长 II，伤害提升 | damage 4；heal 1 | `cards.ts` + `abilities.ts` | L1 |
| `rooted` | defensive | 防御掷 3 骰，按树枝/树叶/树灵结算 | branch +1 反击，leaf seedling，spirit life_sap | `abilities.ts` | L1 |
| `rooted-2` | upgrade | 扎根 II，防御掷 4 骰 | defensive diceCount 4 | `cards.ts` + `abilities.ts` | L1 |
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
- 当前发布口径已收口：新增 token/passive 的关键规则分支均有 L2 单测；幼种树灵、木苗树灵达到 L3 真实 UI 链路；神性树灵、生命源泉、刺藤达到 L4 复杂交互/阶段推进闭环。
