# Dice Throne 树精录入核对

> 2026-05-30 重审范围：只审**树精全部升级技能**，不再沿用旧“5 张升级卡描述已按卡图展开、录入层没有残余”的结论。
>
> 主真相源：
> - `public/assets/i18n/zh-CN/dicethrone/images/treant/abilitycards.png`
> - `temp/treant-upgrade-crops/tendcare2.png`
> - `temp/treant-upgrade-crops/rooted2.png`
> - `temp/treant-upgrade-crops/shatteringfist2.png`
> - `temp/treant-upgrade-crops/shatteringfist3.png`
> - `temp/treant-upgrade-crops/naturetouch2_precise.png`
> - `temp/treant-upgrade-crops/vengefulvines2_precise.png`
> - `temp/treant-upgrade-crops/wildgrowth2_precise.png`
>
> 对照实现：
> - `src/games/dicethrone/heroes/treant/abilities.ts`
> - `src/games/dicethrone/heroes/treant/cards.ts`
> - `src/games/dicethrone/domain/customActions/treant.ts`

## 2026-05-30 当前结论

- 树精旧文档里“5 张升级卡描述已经按卡图重录、录入层没有残余”的说法已经失效。
- 当前看到的真实情况是：
  - `细心呵护 II`
  - `自然之触 II`
  - `复仇枝蔓 II`
  - `野性怒吼 II`

  这四张都存在**升级卡主路线以下还挂着一个同卡分支**，当前实现没有按这个结构录。
- `扎根 II`、`破碎之拳 II`、`破碎之拳 III` 目前从已裁到的整卡语义看，主路线和现有代码大体一致，暂未看到“同卡下挂第二分支”问题。

## 升级技能重审矩阵

| 基础技能 | 卡图主路线 | 卡图下挂分支 | 当前实现 | 应有结构 | 结论 |
|---|---|---|---|---|---|
| `细心呵护 II` | `2 树叶 + 2 螺旋`；抽 `1`；养成 `4` 树灵；`1` 名玩家获得生命源泉；选择 `1` 名对手施加刺藤 | `培育`：`2 树枝 + 2 螺旋`；养成 `6` 树灵 | `TEND_CARE_2` 只有主路线，缺 `培育` | `tend-care` 升级版应带主路线与 `培育` 两个 `variants` | **录入错 + 实现错** |
| `扎根 II` | 防御投掷 `4` 骰；防止 `1×树枝 + 1×树灵` 伤害；若投出 `2` 树叶则养成 `1` 树灵；若投出 `2` 螺旋则 `1` 名玩家获得生命源泉 | 当前裁图未见明确下挂第二分支 | `ROOTED_2` 与当前主路线一致 | 保持 `rooted` 基础技能 ID；当前重点是保持真实防御结算 | **主路线当前对齐** |
| `破碎之拳 III` | `3/4/5` 树枝造成 `5/6/7` 伤害；若投出 `3` 个相同数字，养成 `1` 树灵；施加刺藤 | 当前裁图未见明确下挂第二分支 | `SHATTERING_FIST_3` 与当前主路线大体一致 | 保持现结构 | **主路线当前对齐** |
| `自然之触 II` | `4 螺旋`；养成 `2` 树灵；然后造成 `6` 不可防御伤害；每有 `1` 树灵 `+1` 伤害 | `自然之怜`：`3 螺旋`；治疗 `1`；获得 `1` CP；抽 `1`；养成 `1` 树灵 | `NATURE_TOUCH_2` 只有主路线，缺 `自然之怜` | `nature-touch` 升级版应带主路线与 `自然之怜` 两个 `variants` | **录入错 + 实现错** |
| `复仇枝蔓 II` | 小顺子；施加刺藤；造成 `8` 伤害 | `苦痛根系`：`3 树叶`；每有 `1` 树灵造成 `1` 真实伤害 | `VENGEFUL_VINES_2` 只有主路线，缺 `苦痛根系` | `vengeful-vines` 升级版应带主路线与 `苦痛根系` 两个 `variants` | **录入错 + 实现错** |
| `野性怒吼 II` | 大顺子；造成 `8` 伤害并投掷 `5` 骰；增加 `1×树枝` 伤害；若投出树叶，获得生命源泉；养成 `1×螺旋` 树灵 | `乱花迷眼`：`2 树枝 + 2 螺旋`；施加刺藤；造成 `4` 不可防御伤害 | `WILD_GROWTH_2` 仍沿用旧 `2 树枝 + 3 树叶` 那套“移除树灵加伤/弃生命源泉变不可防御”语义，连主路线和触发条件都对不上 | 需要先重新裁定 `wild-growth-2` 的主路线与分支，再重写升级版结构 | **严重错录 + 实现错** |
| `破碎之拳 II` | `3/4/5` 树枝造成 `5/6/7` 伤害并施加刺藤 | 当前裁图未见明确下挂第二分支 | `SHATTERING_FIST_2` 与当前主路线一致 | 保持现结构 | **主路线当前对齐** |

## 需要撤销的旧结论

- 下列说法已失效：
  - “5 张升级卡描述当前已经按图片重录”
  - “Treant 专属卡当前残余不再是描述录入错误”
  - “录入层当前没有已知残余”
- 失效原因不是测试没跑，而是**卡图本身就显示出同卡多分支，而当前录入只保留了上半主路线**。

## 当前最重要的结构裁定

- `细心呵护 II / 培育`
  - 应是同一基础技能 `tend-care` 的升级后双分支。
- `自然之触 II / 自然之怜`
  - 应是同一基础技能 `nature-touch` 的升级后双分支。
- `复仇枝蔓 II / 苦痛根系`
  - 应是同一基础技能 `vengeful-vines` 的升级后双分支。
- `野性怒吼 II / 乱花迷眼`
  - 应是同一基础技能 `wild-growth` 的升级后双分支。
  - 且当前不仅缺分支，连主路线 trigger / 结算模型都疑似录错。

## 关联证据

- 全量升级重审汇总：`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
