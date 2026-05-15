# Dice Throne 忍者卡牌录入核对

> 运行时合同：`ability-cards-ninja.atlas.json`，5x8 row-major，`previewRef.type='atlas'`。通用卡使用 `TREANT_NINJA_COMMON_ATLAS_INDEX`；`card-unexpected` 在 `slot-37`。状态等级同 `ninja录入核对.md`。

## 专属卡运行时接线

| slot | cardId | 中文 | 类型/费用/时机 | 原文/图文要点 | 结构化字段 | 证据层级 |
|---:|---|---|---|---|---|---|
| 17 | `ninja-card-training` | 训练 | action / 0CP / main | 获得忍术 | grant self `ninjutsu=1` | L2：忍术后续已测 |
| 18 | `upgrade-blink-2` | 瞬身 II | upgrade / 2CP / main | 升级瞬身 | replace `blink` -> `BLINK_2` | L1 |
| 19 | `upgrade-going-forward-2` | 一往无前 II | upgrade / 2CP / main | 升级一往无前 | replace `going-forward` -> `GOING_FORWARD_2` | L1 |
| 20 | `upgrade-slash-2` | 斩击 II | upgrade / 2CP / main | 升级斩击 | replace `slash` -> `SLASH_2` | L1 |
| 21 | `upgrade-shadow-step-2` | 暗影步 II | upgrade / 2CP / main | 升级暗影步 | replace `shadow-step` -> `SHADOW_STEP_2` | L2：慢性中毒/烟雾弹后续已测 |
| 22 | `ninja-card-shuriken` | 手里剑 | action / 1CP / roll | 攻击修正，投 5 骰；每个忍刀 +1 | `rollDie diceCount=5`；katana `bonusDamage=1` | L1 |
| 23 | `ninja-card-escape` | 脱身 | action / 0CP / instant | 被攻击后打出，按骰面减伤或获得烟雾弹 | pendingDamage target/beforeDamageReceived；rollDie 1；shield/smoke_bomb | L2：烟雾弹后续已测 |
| 24 | `ninja-card-poison-dart` | 毒镖 | action / 2CP / main | 施加慢性中毒 | grant opponent `delayed_poison=2` | L2：慢性中毒回合结束已测 |
| 25 | `ninja-card-knife-fan` | 刀扇 | action / 2CP / main | 主要阶段行动牌；不可在投掷阶段作为攻击修正打出 | direct unblockable damage 1；`timing='main'`；非 `isAttackModifier` | L2：合同测试覆盖 main 可打、offensiveRoll 不可打 |
| 26 | `upgrade-smoke-screen-2` | 烟雾阵 II | upgrade / 2CP / main | 升级烟雾阵 | replace `smoke-screen` -> `SMOKE_SCREEN_2` | L2：token 后续已测 |
| 27 | `upgrade-shadow-fang-2` | 影牙 II | upgrade / 2CP / main | 升级影牙 | replace `shadow-fang` -> `SHADOW_FANG_2` | L2：忍术后续已测 |
| 28 | `upgrade-poison-blade-2` | 毒刃 II | upgrade / 2CP / main | 升级毒刃 | replace `poison-blade` -> `POISON_BLADE_2`，不可防御 | L2：慢性中毒/防 debuff 已测 |
| 29 | `upgrade-death-blossom-2` | 死亡盛放 II | upgrade / 2CP / main | 升级死亡盛放 | replace `death-blossom` -> `DEATH_BLOSSOM_2` | L2：忍术后续已测 |
| 35 | `ninja-card-vanish` | 雾隐 | action / 0CP / instant | 获得烟雾弹 | grant self `smoke_bomb=1` | L2：烟雾弹已测 |
| 36 | `ninja-card-dojo` | 道场 | action / 0CP / main | 获得烟雾弹与忍术 | grant self `smoke_bomb=1`；`ninjutsu=2` | L2：两类 token 已测 |

## 通用卡映射

- 共用 `COMMON_CARDS`，通过 `injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.NINJA, TREANT_NINJA_COMMON_ATLAS_INDEX)` 注入忍者专属 atlas 索引。
- 通用卡运行时图集状态为 L1；本轮机制重点不在通用卡重审。

## 当前结论

- 专属卡静态数据、i18n 与 atlas 接线达到 L1；2026-05-14 修正 `ninja-card-knife-fan`，它是主要阶段行动牌，不是投掷阶段攻击修正。
- 由专属卡产生的新增 token 后续行为已通过代表性 L2 测试覆盖：慢性中毒、忍术、烟雾弹。
- 2026-05-15 完整流程重审后，本文件不再使用“当前发布口径已收口”结论。原因是多数专属卡尚未逐卡证明候选入口、真实打出、CP/手牌消耗、效果写入、分支/否定路径和后续清理；这些对象只能按 `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md` 中的 L1/L2/L3/L4 层级结论判定。
