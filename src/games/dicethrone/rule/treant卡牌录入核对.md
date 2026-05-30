# Dice Throne 树精卡牌录入核对

> 2026-05-30 重审范围：只回写**树精升级卡**。本文件现在只回答两件事：
> 1. 升级卡图槽、`cardId`、`targetAbilityId` 是否对。
> 2. 升级卡替换进去的 `newAbilityDef` 是否被错录。

主真相源：

- `public/assets/i18n/zh-CN/dicethrone/images/treant/abilitycards.png`
- `temp/treant-upgrade-crops/*.png`

实现入口：

- `src/games/dicethrone/heroes/treant/cards.ts`
- `src/games/dicethrone/heroes/treant/abilities.ts`

## 2026-05-30 当前结论

- 树精升级卡的**图槽、卡牌对象、`replaceAbility(targetAbilityId=基础技能ID)` 这一层大体是对的**。
- 真正错的是：多张升级卡替换进去的升级技能定义只录了主路线，没有按卡图保留下挂分支。
- `upgrade-wild-growth-2` 更严重：不仅缺下挂分支，连主路线 trigger / 结算模型都疑似对错对象了。

## 升级卡矩阵

| slot | cardId | 中文 | `targetAbilityId` | 当前 `newAbilityDef` 状态 | 结论 |
|---:|---|---|---|---|---|
| 18 | `upgrade-tend-care-2` | 细心呵护 II | `tend-care` | `TEND_CARE_2` 只有主路线，缺 `培育` | **错录** |
| 19 | `upgrade-rooted-2` | 扎根 II | `rooted` | `ROOTED_2` 当前主路线与卡图基本一致 | **当前主路线对齐** |
| 21 | `upgrade-shattering-fist-3` | 破碎之拳 III | `shattering-fist` | `SHATTERING_FIST_3` 当前主路线与卡图基本一致 | **当前主路线对齐** |
| 25 | `upgrade-nature-touch-2` | 自然之触 II | `nature-touch` | `NATURE_TOUCH_2` 只有主路线，缺 `自然之怜` | **错录** |
| 28 | `upgrade-vengeful-vines-2` | 复仇枝蔓 II | `vengeful-vines` | `VENGEFUL_VINES_2` 只有主路线，缺 `苦痛根系` | **错录** |
| 29 | `upgrade-wild-growth-2` | 野性怒吼 II | `wild-growth` | `WILD_GROWTH_2` 仍是旧 `2 树枝 + 3 树叶` 合同，主路线和分支都不对 | **严重错录** |
| 30 | `upgrade-shattering-fist-2` | 破碎之拳 II | `shattering-fist` | `SHATTERING_FIST_2` 当前主路线与卡图基本一致 | **当前主路线对齐** |

## 结构裁定

- 下列升级卡都应该是“**一张升级卡 -> 一个基础技能 -> 升级后技能内部含多个 `variants`**”：
  - `upgrade-tend-care-2`
  - `upgrade-nature-touch-2`
  - `upgrade-vengeful-vines-2`
  - `upgrade-wild-growth-2`

## 关联证据

- 全量升级重审汇总：`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
