# Dice Throne 忍者录入核对

> 主真相源：`public/assets/i18n/zh-CN/dicethrone/images/ninja/**`。实现入口：`src/games/dicethrone/heroes/ninja/**`、`src/games/dicethrone/domain/customActions/ninja.ts`、`flowHooks.ts`。状态等级：L0 素材定位；L1 静态/i18n/资源；L2 领域行为测试；L3 真实 UI/E2E；L4 复杂交互闭环。

## 角色基础

| 项 | 结构化字段 | 来源定位 | 状态 | 疑点 |
|---|---|---|---|---|
| 角色 ID | `ninja` | 目录名/代码注册 | L3：选角进局 E2E | 无 |
| 中文名 | 忍者 | 玩家面板/选角文案 | L3：选角截图可见 | 无 |
| 骰面 | 1/2/3=`ninja_katana`，4/5=`shuriken`，6=`mask` | `dice.png`/`diceConfig.ts` | L1 | 无 |
| 面板规格 | v2 宽屏面板，`2048x1260` | `player-board.png` | L3：进局截图可见 | 无 |

## 技能 / 防御逐项核对

| ID | 类型 | 原文/图文要点 | 结构化字段 | 实现入口 | 状态 |
|---|---|---|---|---|---|
| `slash` | offensive | 3/4/5 忍刀造成 5/6/7 伤害 | `diceSet katana=3/4/5`，damage 5/6/7 | `abilities.ts` | L1 |
| `slash-2` | upgrade | 斩击 II，伤害提升 | replace `slash`，damage 6/7/8 | `cards.ts` + `abilities.ts` | L1 |
| `going-forward` | offensive | 4 手里剑造成 7 伤害 | `shuriken=4`，damage 7 | `abilities.ts` | L1 |
| `going-forward-2` | upgrade | 一往无前 II | replace `going-forward` | `cards.ts` + `abilities.ts` | L1 |
| `poison-blade` | offensive | 小顺子，慢性中毒 + 5 伤害 | smallStraight；delayed_poison 1；damage 5；Ninja v2 面板使用 `combo` 视觉槽 | `abilities.ts` / `ui/abilitySlotMapping.ts` | L3：真实 UI 槽位选择已测 |
| `poison-blade-2` | upgrade | 毒刃 II，慢性中毒 + 不可防御伤害 | delayed_poison 1；unblockable damage 6 | `cards.ts` + `abilities.ts` | L2：神性树灵防 debuff 已测 |
| `shadow-step` | offensive | 4 面具，烟雾弹、慢性中毒、不可防御伤害 | mask=4；smoke_bomb 1；delayed_poison 1；unblockable damage 6 | `abilities.ts` | L2：烟雾弹/慢性中毒 token 已测 |
| `shadow-step-2` | upgrade | 暗影步 II，慢性中毒 2、伤害 7 | smoke_bomb 1；delayed_poison 2；unblockable damage 7 | `cards.ts` + `abilities.ts` | L2 |
| `death-blossom` | offensive | 忍刀/手里剑累计伤害，面具给忍术 | rollDie 5；katana +1，shuriken +2，mask ninjutsu +1；Ninja v2 面板使用 `sky` 视觉槽 | `abilities.ts` / `ui/abilitySlotMapping.ts` | L3：真实 UI 槽位选择已测 |
| `death-blossom-2` | upgrade | 死亡盛放 II | replace `death-blossom` | `cards.ts` + `abilities.ts` | L1 |
| `smoke-screen` | utility | 获得烟雾弹/忍术并给慢性中毒 | smoke_bomb 1；ninjutsu 2；opponent delayed_poison 1 | `abilities.ts` | L2：token 后续机制已测 |
| `smoke-screen-2` | upgrade | 烟雾阵 II，忍术 3 | smoke_bomb 1；ninjutsu 3；delayed_poison 1 | `cards.ts` + `abilities.ts` | L2 |
| `shadow-fang` | offensive | 大顺子，忍术 2 + 8 伤害 | largeStraight；ninjutsu 2；damage 8 | `abilities.ts` | L2：忍术后续机制已测 |
| `shadow-fang-2` | upgrade | 影牙 II，忍术 2 + 9 伤害 | largeStraight；ninjutsu 2；damage 9 | `cards.ts` + `abilities.ts` | L2 |
| `blink` | defensive | 防御掷 3 骰，忍刀/手里剑反击，面具烟雾弹 | diceCount 3；katana +1，shuriken +2，mask smoke_bomb；`withDamage` 防御时机 | `abilities.ts` / `domain/attack.ts` | L3：真实防御推进与不可防御跳过防御均已测 |
| `blink-2` | upgrade | 瞬身 II | replace `blink` | `cards.ts` + `abilities.ts` | L1 |
| `ninja-assassinate` | ultimate | 终极技：慢性中毒 2、烟雾弹、10 伤害 | ultimate；delayed_poison 2；smoke_bomb 1；damage 10 | `abilities.ts` | L2：慢性中毒/烟雾弹后续机制已测 |

## Token / 状态逐项核对

| ID | 中文 | 类型/上限 | 原文/图文要点 | 结构化字段 | 实现/验证 | 状态 |
|---|---|---:|---|---|---|---|
| `delayed_poison` | 慢性中毒 | debuff / 2 | 拥有者回合结束移除全部，每层受 3 伤害 | `discard` phase exit，consume all，damage `stacks*3` | `flowHooks.ts`；`ninja-token-mechanics.test.ts`；回合结束扣血并归零 E2E 截图链 | L4：回合结束闭环 |
| `ninjutsu` | 忍术 | consumable / 3 | 造成伤害前花费并掷骰；1-3 +1，4-5 +2，6 选择慢性中毒或不可防御且 +2 | `activeUse.customActionId=ninja-ninjutsu-use`；choice handler | `customActions/ninja.ts`；4-5 与 6 两分支已测；奖励骰加伤、6 点慢性中毒/不可防御选择链 E2E | L4：奖励骰/选择链闭环 |
| `smoke_bomb` | 烟雾弹 | buff / 1 | 受到伤害前花费并掷骰，1-3 避免本次伤害 | `rollToNegate`，success range 1-3 | `tokenResponse.ts`；`ninja-token-mechanics.test.ts`；防御方响应窗免伤 E2E 截图链 | L4：防御响应窗闭环 |

## 当前结论

- 旧结论“忍术固定 +1、烟雾弹固定减伤 2、慢性中毒为债务”已失效：这些机制已改为提示板口径并进入 L2 测试层。
- 2026-05-14 回归审计又推翻了旧“Ninja 已全面收口”口径：`poison-blade` / `death-blossom` 槽位、`blink` 防御、不可防御跳过防御、`ninja-card-knife-fan` 时机均曾漏审。
- 当前修订后口径：上述四项已有 L2 合同测试与 L3 真实入口 E2E；Ninja 全量机制是否“全面审计完成”仍必须以后续逐对象矩阵为准，不能再用旧接入审计直接代替。
