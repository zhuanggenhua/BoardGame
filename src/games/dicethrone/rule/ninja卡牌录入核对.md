# Dice Throne 忍者卡牌录入核对

> 2026-05-30 重审范围：只回写**忍者升级卡**。本文件现在只回答两件事：
> 1. 升级卡图槽、`cardId`、`targetAbilityId` 是否对。
> 2. 升级卡替换进去的 `newAbilityDef` 是否被错录。

主真相源：

- `public/assets/i18n/zh-CN/dicethrone/images/ninja/Ablilitycards.png`
- `temp/ninja-upgrade-crops/*.png`

实现入口：

- `src/games/dicethrone/heroes/ninja/cards.ts`
- `src/games/dicethrone/heroes/ninja/abilities.ts`

## 2026-05-30 当前结论

- 忍者升级卡的**图槽、卡牌对象、`replaceAbility(targetAbilityId=基础技能ID)` 这一层大体是对的**。
- 真正错的是：很多升级卡替换进去的升级技能定义本身录错了，把**同一卡内的多个分支**录成了单一路线，或者把主路线都写错了。
- 所以问题不是“升级卡没接上”，而是“升级卡接上了错误的升级技能定义”。

## 升级卡矩阵

| slot | cardId | 中文 | `targetAbilityId` | 当前 `newAbilityDef` 状态 | 结论 |
|---:|---|---|---|---|---|
| 18 | `upgrade-blink-2` | 瞬身 II | `blink` | 2026-06-03 已确认不是升级卡接错，而是升级技能的防御重投合同漏进共享流程；现已补 `trigger.rollLimit = 2` 并以合同测试 + 真实防御 E2E 锁定 | **升级卡接线正确；共享实现漏项已修** |
| 19 | `upgrade-going-forward-2` | 一往无前 II | `going-forward` | 只替换成单一路线 `GOING_FORWARD_2`；缺 `刀尖舔血`；主路线也没实现投 `2` 骰 / 可重掷 / `<=6` 不可防御 | **错录** |
| 20 | `upgrade-slash-2` | 斩击 II | `slash` | `SLASH_2` 数值写成 `6/7/8`，缺“3 同点获得 1 忍术” | **错录** |
| 21 | `upgrade-shadow-step-2` | 暗影步 II | `shadow-step` | `SHADOW_STEP_2` 缺 `勒杀`，主路线伤害也写错 | **错录** |
| 26 | `upgrade-smoke-screen-2` | 烟雾阵 II | `smoke-screen` | `SMOKE_SCREEN_2` 缺 `九字切` | **错录** |
| 27 | `upgrade-shadow-fang-2` | 影牙 II | `shadow-fang` | `SHADOW_FANG_2` 缺 `诳惑`，主路线还漏烟雾弹且伤害写高 | **错录** |
| 28 | `upgrade-poison-blade-2` | 毒刃 II | `poison-blade` | `POISON_BLADE_2` 被写成固定中毒 + 不可防御，和卡图奖励骰语义不符 | **错录** |
| 29 | `upgrade-death-blossom-2` | 死亡盛放 II | `death-blossom` | `DEATH_BLOSSOM_2` 直接复用基础版，面具效果和重掷规则都不对 | **错录** |

## 结构裁定

- 下列升级卡都应该是“**一张升级卡 -> 一个基础技能 -> 升级后技能内部含多个 `variants`**”：
  - `upgrade-going-forward-2`
  - `upgrade-shadow-step-2`
  - `upgrade-smoke-screen-2`
  - `upgrade-shadow-fang-2`
- 不能把下挂分支拆成新的升级卡对象，也不能继续把下挂分支忽略掉。

## 关联证据

- 全量升级重审汇总：`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
