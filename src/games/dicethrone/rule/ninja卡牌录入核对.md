# Dice Throne 忍者卡牌录入核对

> 运行时合同：`ability-cards-ninja.atlas.json`，5x8 row-major，`previewRef.type='atlas'`。通用卡使用 `TREANT_NINJA_COMMON_ATLAS_INDEX`；`card-unexpected` 在 `slot-37`。状态等级同 `ninja录入核对.md`。

## 专属卡运行时接线

| slot | cardId | 中文 | 类型/费用/时机 | 原文/图文要点 | 结构化字段 | 证据层级 |
|---:|---|---|---|---|---|---|
| 17 | `ninja-card-training` | 训练 | action / 0CP / main | 获得忍术 | grant self `ninjutsu=1` | L3：真实主阶段手牌打出、手牌消耗与 `ninjutsu=1` 已测 |
| 18 | `upgrade-blink-2` | 瞬身 II | upgrade / 2CP / main | 升级瞬身 | replace `blink` -> `BLINK_2` | L3：真实手牌打出、CP 5->3、`abilityLevels.blink=2` 已测 |
| 19 | `upgrade-going-forward-2` | 一往无前 II | upgrade / 2CP / main | 升级一往无前 | replace `going-forward` -> `GOING_FORWARD_2` | L3：真实手牌打出、CP 5->3、`abilityLevels.going-forward=2` 已测 |
| 20 | `upgrade-slash-2` | 斩击 II | upgrade / 2CP / main | 升级斩击 | replace `slash` -> `SLASH_2` | L3：真实手牌打出、CP 5->3、`abilityLevels.slash=2` 已测 |
| 21 | `upgrade-shadow-step-2` | 暗影步 II | upgrade / 2CP / main | 升级暗影步 | replace `shadow-step` -> `SHADOW_STEP_2` | L3：真实手牌打出、CP 5->3、`abilityLevels.shadow-step=2` 已测；`lightning` 槽与慢性中毒/烟雾弹结算后续已有代表覆盖 |
| 22 | `ninja-card-shuriken` | 手里剑 | action / 1CP / roll | 攻击修正，投 5 骰；每个忍刀 +1 | `rollDie diceCount=5`；katana `bonusDamage=1` | L3：真实手牌、奖励骰特写、收口后攻击修正 +3 已测 |
| 23 | `ninja-card-escape` | 脱身 | action / 0CP / instant | 被攻击后打出，按骰面减伤或获得烟雾弹 | pendingDamage target/beforeDamageReceived；rollDie 1；shield/smoke_bomb | L3：真实受击响应窗、奖励骰本体、手牌消耗、护盾写入与伤害收口已测 |
| 24 | `ninja-card-poison-dart` | 毒镖 | action / 2CP / main | 施加慢性中毒 | grant opponent `delayed_poison=2` | L3：真实主阶段手牌打出、CP 3->1、对手 `delayed_poison=2` 已测 |
| 25 | `ninja-card-knife-fan` | 刀扇 | action / 2CP / main | 主要阶段行动牌；不可在投掷阶段作为攻击修正打出 | direct unblockable damage 1；`timing='main'`；非 `isAttackModifier` | L3：真实主阶段手牌打出、CP 3->1、对手 HP 30->29、无 `pendingDamage` 已测；offensiveRoll 否定仍由合同测试覆盖 |
| 26 | `upgrade-smoke-screen-2` | 烟雾阵 II | upgrade / 2CP / main | 升级烟雾阵 | replace `smoke-screen` -> `SMOKE_SCREEN_2` | L3：真实手牌打出、CP 5->3、`abilityLevels.smoke-screen=2` 已测；`lotus` 槽与 token 后续已有代表覆盖 |
| 27 | `upgrade-shadow-fang-2` | 影牙 II | upgrade / 2CP / main | 升级影牙 | replace `shadow-fang` -> `SHADOW_FANG_2` | L3：真实手牌打出、CP 5->3、`abilityLevels.shadow-fang=2` 已测；忍术后续已有代表覆盖 |
| 28 | `upgrade-poison-blade-2` | 毒刃 II | upgrade / 2CP / main | 升级毒刃 | replace `poison-blade` -> `POISON_BLADE_2`，不可防御 | L3：真实手牌打出、CP 5->3、`abilityLevels.poison-blade=2` 已测；慢性中毒/不可防御后续已有代表覆盖 |
| 29 | `upgrade-death-blossom-2` | 死亡盛放 II | upgrade / 2CP / main | 升级死亡盛放 | replace `death-blossom` -> `DEATH_BLOSSOM_2` | L3：真实手牌打出、CP 5->3、`abilityLevels.death-blossom=2` 已测；忍术后续已有代表覆盖 |
| 35 | `ninja-card-vanish` | 雾隐 | action / 0CP / instant | 获得烟雾弹 | grant self `smoke_bomb=1` | L3：真实手牌打出后获得烟雾弹已测 |
| 36 | `ninja-card-dojo` | 道场 | action / 0CP / main | 投掷1骰；若投出面具，获得烟雾弹与 2 忍术；否则抽 1 | `rollDie diceCount=1`；mask => `smoke_bomb=1` + `ninjutsu=2`；default => `drawCard=1` | L3：真实手牌打出、面具分支、非面具抽牌分支和奖励骰收口已测 |

## 通用卡映射

- 共用 `COMMON_CARDS`，通过 `injectCommonCardPreviewRefs(COMMON_CARDS, DICETHRONE_CARD_ATLAS_IDS.NINJA, TREANT_NINJA_COMMON_ATLAS_INDEX)` 注入忍者专属 atlas 索引。
- 通用卡运行时图集状态为 L1；本轮机制重点不在通用卡重审。

## 当前结论

- 专属卡静态数据、i18n 与 atlas 接线达到 L1；2026-05-14 修正 `ninja-card-knife-fan`，它是主要阶段行动牌，不是投掷阶段攻击修正。
- 由专属卡产生的新增 token 后续行为已通过代表性 L2 测试覆盖：慢性中毒、忍术、烟雾弹；其中训练、毒镖、刀扇、手里剑、脱身、雾隐、道场和 8 张升级卡已在 2026-05-17 补真实手牌 L3。
- 2026-05-17 按本地卡图与 Wiki 对照修正 `ninja-card-dojo`：旧实现直接获得烟雾弹与 2 忍术，漏掉“投 1 骰；面具成功，否则抽 1”的分支；现已补真实手牌 E2E，截图链见 `evidence/dicethrone/dicethrone-ninja-dojo-real-hand-e2e-2026-05-17.md`。
- 2026-05-17 补 `ninja-card-shuriken`、`ninja-card-vanish` 与 `ninja-card-escape` 真实手牌 E2E，截图链见 `evidence/dicethrone/dicethrone-ninja-shuriken-vanish-real-hand-e2e-2026-05-17.md` 与 `evidence/dicethrone/dicethrone-ninja-escape-real-hand-e2e-2026-05-17.md`。
- 2026-05-19 纠正 Ninja v2 玩家板槽位合同：`shadow-step` 在 `lightning`，`smoke-screen` 在 `lotus`；旧槽位记法失效，相关证据已回写。
- 2026-05-15 完整流程重审后，本文件不再使用“当前发布口径已收口”结论。原因是多数专属卡尚未逐卡证明候选入口、真实打出、CP/手牌消耗、效果写入、分支/否定路径和后续清理；这些对象只能按 `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md` 中的 L1/L2/L3/L4 层级结论判定。
