# Dice Throne 树精卡牌录入核对

> 运行时合同：`ability-cards-treant.atlas.json`，5x8 row-major，`previewRef.type='atlas'`。通用卡使用 `TREANT_NINJA_COMMON_ATLAS_INDEX`；`card-unexpected` 在 `slot-37`。状态等级同 `treant录入核对.md`。

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
- Treant 专属卡仍远未收口：当前没有一张专属卡达到逐卡真实打出 L3，绝大多数仍停在 L1/L2。
- 2026-05-15 完整流程重审后，本文件不再使用“当前发布口径已收口”结论。原因是多数专属卡尚未逐卡证明候选入口、真实打出、CP/手牌消耗、效果写入、分支/否定路径和后续清理；这些对象只能按 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md` 中的 L1/L2/L3/L4 层级结论判定。
