# Dice Throne 树精卡牌录入核对

> 运行时合同：`ability-cards-treant.atlas.json`，5x8 row-major，`previewRef.type='atlas'`。通用卡使用 `TREANT_NINJA_COMMON_ATLAS_INDEX`；`card-unexpected` 在 `slot-37`。状态等级同 `treant录入核对.md`。

## 2026-05-16 卡图逐格重审修订

本轮直接按 `abilitycards.png` 逐格重看后，旧表里多行“结构化字段”已经失效，不能再把 Treant 专属卡说成“多数只是缺 L3”。当前至少有以下硬冲突：

| 图槽/对象 | 卡图直接结论 | 当前实现 | 审计结论 |
|---|---|---|---|
| `slot-17` `treant-card-trample` | `投掷5骰：增加 1×树枝 伤害。如果增加了至少 3 伤害，施加刺藤。` | 代码按 `branch +1`，但把刺藤触发写成“掷出树灵” | **刺藤触发条件写错** |
| `slot-18` `upgrade-tend-care-2` | `抽取1。养成4树灵。1名玩家获得生命源泉。选择1名对手施加刺藤。` | 代码写成 `seedling3 + sapling1 + self lifeSap + opponent thorn` | **养成总语义、目标和交互都不对** |
| `slot-20` `treant-card-drink-deep` | `1名玩家获得生命源泉。` | 代码只给 `self` | **目标语义错误** |
| `slot-21` `upgrade-shattering-fist-3` | `3/4/5 树枝造成 5/6/7 伤害；如果投出 3 个相同数字，养成1树灵；施加刺藤。` | 代码写成 `6/7/8 伤害 + 自动刺藤` | **伤害、额外条件、养成子句都不对** |
| `slot-22` `treant-card-harvest` | `移除至多3树灵，每移除1树灵获得1CP。如果至少有2树灵被移除，则至多2名玩家获得生命源泉。` | 代码写成 `draw1 + cultivate1` | **整张卡完全错录** |
| `slot-23` `treant-card-cultivate` | `养成3树灵。` | 代码直接 `grant seedling 3` | **受“养成语义缺失”牵连，当前不成立** |
| `slot-24` `treant-card-downpour` | `你可以养成所有现有的树灵各一次（以任意顺序）。` | 代码写成 `heal 2 + cultivate1` | **整张卡完全错录** |
| `slot-25` `upgrade-nature-touch-2` | `养成2树灵。然后造成6不可防御伤害，每有1树灵 +1 伤害。` | 代码写成 `cultivate2 + 6 点固定不可防御伤害` | **树灵加伤没做** |
| `slot-26` `treant-card-soulfire` | `投掷3骰：树枝=对所有对手造成1附属伤害；树叶=获得生命源泉；树灵=养成1树灵。` | 代码把树枝分支做成 `bonusDamage +1` | **树枝分支做错** |
| `slot-27` `treant-card-mother-tree` | `投掷1骰：如果投出树灵，养成4树灵。否则抽取1。` | 代码分支结构对，但仍然直接 `grant seedling 4` | **受“养成语义缺失”牵连** |
| `slot-28` `upgrade-vengeful-vines-2` | `施加刺藤。造成8伤害。` | 当前实现与主效果一致 | **当前未命中主效果冲突** |
| `slot-29` `upgrade-wild-growth-2` | `造成4伤害。你可以移除至多2树灵，每移除1树灵，增加4伤害。你可以弃掉生命源泉使此次攻击变为不可防御。` | 代码写成 `damage 4 + heal 1` | **技能主体做错** |
| `slot-30` `upgrade-shattering-fist-2` | `3/4/5 树枝造成 5/6/7 伤害。施加刺藤。` | 当前 `cards.ts` 预览索引写成 `35`，效果仍是 `6/7/8` 且不带这张卡图上的主效果 | **预览索引越界 + 规则录错** |
| `slot-31` `treant-card-planting` | `养成3树灵。` | 当前 `cards.ts` 预览索引写成 `36`，效果写成 `grant seedling 4` | **预览索引越界 + 数值/养成语义错误** |

### 图集合同追加 finding

- `src/assets/atlas-configs/dicethrone/ability-cards-treant.atlas.json` 当前只有 `frames[0..34]`。
- `src/games/dicethrone/heroes/treant/cards.ts` 却给：
  - `upgrade-shattering-fist-2` 绑定 `sourceAtlasIndex: 35`
  - `treant-card-planting` 绑定 `sourceAtlasIndex: 36`
- 这两张卡的 `previewRef.index` 已经超出当前 atlas frame 范围，属于**硬合同错误**，不是“还没补 E2E”。

## 专属卡运行时接线

| slot | cardId | 中文 | 类型/费用/时机 | 原文/图文要点 | 结构化字段 | 证据层级 |
|---:|---|---|---|---|---|---|
| 17 | `treant-card-trample` | 践踏 | action / 1CP / roll | 攻击修正，投 5 骰；树枝加伤，树灵施加刺藤 | `rollDie diceCount=5`；branch `bonusDamage=1`；spirit grant opponent `thorn` | L1 静态接线；刺藤后续 L4 代表链 |
| 18 | `upgrade-tend-care-2` | 细心呵护 II | upgrade / 2CP / main | 升级细心呵护 | replace `tend-care` -> `TEND_CARE_2` | L1 静态接线；木苗后续 L3 代表链 |
| 19 | `upgrade-rooted-2` | 扎根 II | upgrade / 3CP / main | 升级扎根 | replace `rooted` -> `ROOTED_2`，防御骰 4 | L2：`rooted-2` 共享防御合同已测；缺逐卡真实打出 L3 |
| 20 | `treant-card-drink-deep` | 痛饮 | action / 1CP / main | 获得生命源泉 | grant self `life_sap=1` | L2：生命源泉消费已测 |
| 21 | `upgrade-shattering-fist-3` | 破碎之拳 III | upgrade / 2CP / main | 升级破碎之拳到 III | replace `shattering-fist` -> `SHATTERING_FIST_3` | L2：刺藤后续已测 |
| 22 | `treant-card-harvest` | 丰收 | action / 0CP / main | 抽牌并养成 | draw 1；grant self `treant_seedling=1` | L2：幼种消费已测 |
| 23 | `treant-card-cultivate` | 培育 | action / 3CP / main | 养成树灵 | grant self `treant_seedling=3` | L2：幼种消费已测 |
| 24 | `treant-card-downpour` | 大雨倾盆 | action / 2CP / main | 治疗并养成 | heal 2；grant self `treant_seedling=1` | L2：幼种消费已测 |
| 25 | `upgrade-nature-touch-2` | 自然之触 II | upgrade / 2CP / main | 升级自然之触 | replace `nature-touch` -> `NATURE_TOUCH_2` | L1 |
| 26 | `treant-card-soulfire` | 魂火 | action / 1CP / roll | 攻击修正，投 3 骰按面结算 | branch +1 damage；leaf life_sap；spirit seedling | L2：life_sap/seedling 后续已测 |
| 27 | `treant-card-mother-tree` | 母树 | action / 0CP / main | 投 1 骰；树灵养成，否则抽牌 | rollDie 1；spirit seedling 4；default draw 1 | L2：树灵/默认抽牌分支已测；缺真实打出 L3 |
| 28 | `upgrade-vengeful-vines-2` | 复仇枝蔓 II | upgrade / 2CP / main | 升级复仇枝蔓 | replace `vengeful-vines` -> `VENGEFUL_VINES_2` | L2：刺藤后续已测 |
| 29 | `upgrade-wild-growth-2` | 野蛮生长 II | upgrade / 2CP / main | 升级野蛮生长 | replace `wild-growth` -> `WILD_GROWTH_2` | L1 |
| 35 | `upgrade-shattering-fist-2` | 破碎之拳 II | upgrade / 1CP / main | 升级破碎之拳到 II | replace `shattering-fist` -> `SHATTERING_FIST_2` | L1 |
| 36 | `treant-card-planting` | 种植 | action / 1CP / main | 养成树灵 | grant self `treant_seedling=4` | L2：幼种消费已测 |

## 通用卡映射

- 共用 `COMMON_CARDS`，通过 `injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.TREANT, TREANT_NINJA_COMMON_ATLAS_INDEX)` 注入树精专属 atlas 索引。
- 通用卡运行时图集状态为 L1；本轮机制重点不在通用卡重审。

## 当前结论

- 专属卡静态数据、i18n 与 atlas 接线达到 L1。
- 由专属卡产生的新增 token 后续行为已通过代表性 L2 测试覆盖：幼种树灵、木苗树灵治疗+CP、木苗树灵额外 1CP 抽牌、生命源泉、刺藤、神性树灵防负面状态与造成伤害前 +3。
- 以上两条旧结论已经不够用：Treant 专属卡并不只是“多数停在 L1/L2”，而是已经直接命中多张**录入错误 / atlas 合同错误 / 规则语义错误**。尤其 `treant-card-harvest`、`treant-card-downpour`、`treant-card-soulfire`、`upgrade-shattering-fist-3`、`upgrade-wild-growth-2`、`treant-card-planting` 不能继续按旧结构化字段当真。
- Treant 专属卡仍远未收口：当前没有一张专属卡达到逐卡真实打出 L3，绝大多数仍停在 L1/L2。
- 2026-05-15 完整流程重审后，本文件不再使用“当前发布口径已收口”结论。原因是多数专属卡尚未逐卡证明候选入口、真实打出、CP/手牌消耗、效果写入、分支/否定路径和后续清理；这些对象只能按 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md` 中的 L1/L2/L3/L4 层级结论判定。
