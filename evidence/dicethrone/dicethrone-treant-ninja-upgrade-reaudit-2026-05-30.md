# Dice Throne 树精 / 忍者升级技能重审（2026-05-30）

## 范围

- 英雄：树精、忍者
- 目标：只审**全部升级技能**，回答三件事：
  1. 当前升级技能是否按完整卡图录入。
  2. 同一卡内上下分支是否应该做成同一基础技能的 `variants`。
  3. 当前问题属于数据录入错误、实现错误，还是两者同时存在。

## 真相源与方法

### 主真相源

- 忍者：`public/assets/i18n/zh-CN/dicethrone/images/ninja/Ablilitycards.png`
- 树精：`public/assets/i18n/zh-CN/dicethrone/images/treant/abilitycards.png`

### 裁图证据

- 忍者：
  - `temp/ninja-upgrade-crops/goingforward2_precise.png`
  - `temp/ninja-upgrade-crops/slash2_precise2.png`
  - `temp/ninja-upgrade-crops/shadowstep2_precise.png`
  - `temp/ninja-upgrade-crops/smokescreen2.png`
  - `temp/ninja-upgrade-crops/shadowfang2.png`
  - `temp/ninja-upgrade-crops/poisonblade2_precise.png`
  - `temp/ninja-upgrade-crops/deathblossom2_full.png`
  - `temp/ninja-upgrade-crops/blink2_precise.png`
- 树精：
  - `temp/treant-upgrade-crops/tendcare2.png`
  - `temp/treant-upgrade-crops/rooted2.png`
  - `temp/treant-upgrade-crops/shatteringfist2.png`
  - `temp/treant-upgrade-crops/shatteringfist3.png`
  - `temp/treant-upgrade-crops/naturetouch2_precise.png`
  - `temp/treant-upgrade-crops/vengefulvines2_precise.png`
  - `temp/treant-upgrade-crops/wildgrowth2_precise.png`

### 对照实现

- 忍者：
  - `src/games/dicethrone/heroes/ninja/abilities.ts`
  - `src/games/dicethrone/heroes/ninja/cards.ts`
  - `src/games/dicethrone/domain/customActions/ninja.ts`
- 树精：
  - `src/games/dicethrone/heroes/treant/abilities.ts`
  - `src/games/dicethrone/heroes/treant/cards.ts`
  - `src/games/dicethrone/domain/customActions/treant.ts`

### 结构裁定规则

- 一张升级卡替换一个基础技能，`targetAbilityId` 仍指向基础技能。
- 如果同一卡内存在上下两个能力块，它们默认先判定为**同一基础技能升级后的多个分支**，即升级后能力定义内部的 `variants`。
- E2E 只能证明“当前实现怎么表现”，不能反向证明“卡图语义录对了”。

## 总结论

- 这不是“个别技能数值差一点”的问题，而是一次**通用录入方法失守**：
  - 没先保留完整单卡主裁图。
  - 没先裁定同一卡内上下能力块是 `variants` 还是独立对象。
  - 没先对照同系统成熟实现，就把升级卡硬录成单一路线。
- 忍者升级技能的问题最重：`8` 张升级技能里，除 `瞬身 II` 外，`7` 张都已直接坐实存在录入错误；其中多张同时也是实现错误。
- 树精升级技能也不是“录入层已无残余”：至少 `4` 张升级技能已直接坐实存在缺分支或主路线错位。

## 忍者升级技能矩阵

| 升级技能 | 当前是否应为分支技能 | 当前代码是否如此 | 结论 |
|---|---|---|---|
| 一往无前 II / 刀尖舔血 | 是 | 否 | `GOING_FORWARD_2` 仍是单一路线，主路线也错；**录入错 + 实现错** |
| 斩击 II | 否 | 不完整 | 数值与附加效果都错；**录入错 + 实现错** |
| 暗影步 II / 勒杀 | 是 | 否 | 缺 `勒杀`，主路线伤害也错；**录入错 + 实现错** |
| 烟雾阵 II / 九字切 | 是 | 否 | 缺 `九字切`；**录入错 + 实现错** |
| 影牙 II / 诳惑 | 是 | 否 | 缺 `诳惑`，主路线也错；**录入错 + 实现错** |
| 毒刃 II | 否 | 否 | 奖励骰语义被录成固定不可防御；**录入错 + 实现错** |
| 死亡盛放 II | 否 | 否 | 直接复用基础版，面具/重掷语义都错；**录入错 + 实现错** |
| 瞬身 II | 否 | 大体是 | 主路线接近；仍需单独核“重掷至多 2 颗”是否被共享流程覆盖 |

### 忍者最关键的结构结论

- `一往无前 II / 刀尖舔血`
  - 是同一技能的两个分支。
  - 当前代码不是这样做的。
- `暗影步 II / 勒杀`
  - 是同一技能的两个分支。
  - 当前代码不是这样做的。
- `烟雾阵 II / 九字切`
  - 是同一技能的两个分支。
  - 当前代码不是这样做的。
- `影牙 II / 诳惑`
  - 是同一技能的两个分支。
  - 当前代码不是这样做的。

## 树精升级技能矩阵

| 升级技能 | 当前是否应为分支技能 | 当前代码是否如此 | 结论 |
|---|---|---|---|
| 细心呵护 II / 培育 | 是 | 否 | 缺 `培育`；**录入错 + 实现错** |
| 扎根 II | 否 | 是 | 当前主路线与卡图一致；暂未见新增分支问题 |
| 破碎之拳 III | 否 | 是 | 当前主路线与卡图一致 |
| 自然之触 II / 自然之怜 | 是 | 否 | 缺 `自然之怜`；**录入错 + 实现错** |
| 复仇枝蔓 II / 苦痛根系 | 是 | 否 | 缺 `苦痛根系`；**录入错 + 实现错** |
| 野性怒吼 II / 乱花迷眼 | 是 | 否 | 缺 `乱花迷眼`，主路线 trigger 和结算模型也疑似对错对象；**严重错录 + 实现错** |
| 破碎之拳 II | 否 | 是 | 当前主路线与卡图一致 |

## 失效文档

下列旧文档里的升级技能“已对齐 / 已收口”结论已失效，不能继续当作真相源：

- `src/games/dicethrone/rule/ninja录入核对.md`
- `src/games/dicethrone/rule/ninja卡牌录入核对.md`
- `src/games/dicethrone/rule/treant录入核对.md`
- `src/games/dicethrone/rule/treant卡牌录入核对.md`
- `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md`
- `evidence/dicethrone/dicethrone-ninja-ability-real-entry-e2e-2026-05-17.md`
- `evidence/dicethrone/dicethrone-treant-full-audit-2026-05-16.md`

原因不是这些文档“没跑 E2E”，而是它们把**当前实现能跑通**误判成了**素材语义已录对**。

## 修复优先级

### 忍者

1. `一往无前 II / 刀尖舔血`
2. `暗影步 II / 勒杀`
3. `烟雾阵 II / 九字切`
4. `影牙 II / 诳惑`
5. `毒刃 II`
6. `死亡盛放 II`
7. `斩击 II`
8. `瞬身 II` 的共享重掷合同核对

### 树精

1. `野性怒吼 II / 乱花迷眼`
2. `细心呵护 II / 培育`
3. `自然之触 II / 自然之怜`
4. `复仇枝蔓 II / 苦痛根系`
5. 其余主路线保持回归

## 当前收口口径

- 通用录入规范与项目录入 workflow 已先补硬。
- 树精与忍者的升级技能审计结论现已冻结成文。
- 下一步不能再拿旧 L3 代表链当正确性证明，而要按这份矩阵逐张修 `abilities.ts` / `customActions` / 回归测试。
