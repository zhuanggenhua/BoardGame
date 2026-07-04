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
- 2026-07-03 反馈复核后，本句对 `upgrade-wild-growth-2` 已失效：该卡图实际是 `野性怒吼 II`，应替换 `wild-roar`，不是替换 `wild-growth`。证据裁图为 `tmp/image-check/crops/treant_wild_roar_2_large_straight_card.jpg`；原来把 12345 大顺子反馈归到 `野蛮生长 II` 是对象定位错误。
- 截至 2026-06-04，`细心呵护 II / 培育`、`自然之触 II / 自然之怜`、`复仇枝蔓 II / 苦痛根系` 都已经补齐同卡双分支与对象级 direct closeout `L3`。本句旧版曾把 `乱花迷眼` 归到 `野蛮生长 II`，2026-07-04 已按正式卡图改为归属 `野性怒吼 II`。
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
| 29 | `upgrade-wild-growth-2` | 野性怒吼 II | `wild-roar` | `WILD_ROAR_2` 当前已按正式卡图改为 `wild-roar-2-main` + `wild-roar-2-dazzle` 双分支：上半区大顺子造成 `8` 伤害并投掷 `5` 骰；下半区 `乱花迷眼` 为 `2 树枝 + 2 树灵`，施加刺藤并造成 `4` 点不可防御伤害 | **2026-07-04 回图复核确认：旧“野蛮生长 II / wild-growth / 乱花迷眼”归属错误，现已改为升级野性怒吼并补齐乱花迷眼分支** |
| 30 | `upgrade-shattering-fist-2` | 破碎之拳 II | `shattering-fist` | `SHATTERING_FIST_2` 当前主路线与卡图一致；技能本体对象级 direct closeout `L3` 已补齐 | **升级卡接线正确；目标升级技能当前已对齐，剩批次级治理与旧文档统一收口** |

## 结构裁定

- 下列升级卡都应该是“**一张升级卡 -> 一个基础技能 -> 升级后技能内部含多个 `variants`**”：
  - `upgrade-tend-care-2`
  - `upgrade-nature-touch-2`
  - `upgrade-vengeful-vines-2`
- `upgrade-wild-growth-2` 同样是复合升级结构；2026-07-04 复核后确认它是 `野性怒吼 II`，应升级 `wild-roar`，上半区为 `大顺子` 主路线，下半区为 `乱花迷眼`。

## 关联证据

- 全量升级重审汇总：`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
