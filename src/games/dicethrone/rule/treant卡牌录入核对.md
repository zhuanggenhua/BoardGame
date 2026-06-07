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

## 2026-06-05 当前结论

- 树精升级卡的**图槽、卡牌对象、`replaceAbility(targetAbilityId=基础技能ID)` 这一层仍然是对的**。
- 截至 2026-06-04，`细心呵护 II / 培育`、`自然之触 II / 自然之怜`、`复仇枝蔓 II / 苦痛根系`、`野蛮生长 II / 乱花迷眼` 都已经补齐同卡双分支与对象级 direct closeout `L3`。
- 截至 2026-06-05，`扎根 II`、`破碎之拳 II`、`破碎之拳 III` 也已经补到技能本体对象级 `L3`；其中 `扎根 II` 的防御收口态和 `破碎之拳 III` 的攻击快照条件判定，已继续补到关键 `L4` 子句。
- 当前主问题不再是“升级卡接上了错误技能定义”，而是旧卡牌核对文档若不回写，会继续把后续审计误导成“这些升级技能还没实现”。

## 升级卡矩阵

| slot | cardId | 中文 | `targetAbilityId` | 当前 `newAbilityDef` 状态 | 结论 |
|---:|---|---|---|---|---|
| 18 | `upgrade-tend-care-2` | 细心呵护 II | `tend-care` | `TEND_CARE_2` 当前已按主路线 + `培育` 双分支落地；对象级 direct closeout L3 已补齐，关键 L4 也已锁定，剩批次级治理与旧文档统一收口 | **升级卡接线正确；目标升级技能当前已对齐** |
| 19 | `upgrade-rooted-2` | 扎根 II | `rooted` | `ROOTED_2` 当前主路线与卡图一致；技能本体对象级真实防御入口 `L3` 已补齐，关键防御收口态 `L4` 也已锁定 | **升级卡接线正确；目标升级技能当前已对齐，剩批次级治理与旧文档统一收口** |
| 21 | `upgrade-shattering-fist-3` | 破碎之拳 III | `shattering-fist` | `SHATTERING_FIST_3` 当前主路线与卡图一致；技能本体对象级 `L3` 已补齐，关键“攻击快照 vs 当前活跃骰” `L4` 也已锁定 | **升级卡接线正确；目标升级技能当前已对齐，剩批次级治理与旧文档统一收口** |
| 25 | `upgrade-nature-touch-2` | 自然之触 II | `nature-touch` | `NATURE_TOUCH_2` 当前已按主路线 + `自然之怜` 双分支落地；对象级 direct closeout L3 已补齐，关键 L4 也已锁定，剩批次级治理与旧文档统一收口 | **升级卡接线正确；目标升级技能当前已对齐** |
| 28 | `upgrade-vengeful-vines-2` | 复仇枝蔓 II | `vengeful-vines` | `VENGEFUL_VINES_2` 当前已按主路线 + `苦痛根系` 双分支落地；对象级 direct closeout L3 已补齐，关键 L4 也已锁定，剩批次级治理与旧文档统一收口 | **升级卡接线正确；目标升级技能当前已对齐** |
| 29 | `upgrade-wild-growth-2` | 野蛮生长 II | `wild-growth` | `WILD_GROWTH_2` 当前已按主路线 + `乱花迷眼` 双分支落地；对象级 direct closeout L3 已补齐，关键 displayOnly 收口 L4 也已锁定，剩批次级治理与旧文档统一收口 | **升级卡接线正确；目标升级技能当前已对齐** |
| 30 | `upgrade-shattering-fist-2` | 破碎之拳 II | `shattering-fist` | `SHATTERING_FIST_2` 当前主路线与卡图一致；技能本体对象级 direct closeout `L3` 已补齐 | **升级卡接线正确；目标升级技能当前已对齐，剩批次级治理与旧文档统一收口** |

## 结构裁定

- 下列升级卡都应该是“**一张升级卡 -> 一个基础技能 -> 升级后技能内部含多个 `variants`**”：
  - `upgrade-tend-care-2`
  - `upgrade-nature-touch-2`
  - `upgrade-vengeful-vines-2`
  - `upgrade-wild-growth-2`

## 关联证据

- 全量升级重审汇总：`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
