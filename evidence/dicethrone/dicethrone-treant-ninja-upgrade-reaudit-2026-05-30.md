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
| 瞬身 II | 否 | 主路线已对齐 | 2026-06-03 复核确认旧实现漏掉“可重掷至多 2 颗”，现已通过 `trigger.rollLimit = 2` + `handleAbilityActivated` 共享消费补齐，并补合同测试与真实防御 E2E |

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

## 2026-06-03 补记：瞬身 II 漏项根因

- 漏的不是主结算，而是**防御阶段共享合同**里的“还能再投几次”。
- 旧审计把 `BLINK_2` 的结算文案、`customActionId` 和 3 骰入口核到了，但没有把“可重掷至多 2 颗”拆成独立子句验收。
- 旧实施路径也只核了 `diceCount=3` 与最终伤害/烟雾弹，没有核 `handleAbilityActivated -> rollLimit` 这条共享消费链。
- 现已补的硬门禁：
  - 合同层：防御技能若卡面写“可重掷/再投”，必须在触发定义中显式声明 `rollLimit`。
  - 自动化：至少 1 条合同测试断言防御技能激活后 `rollLimit` 正确。
  - 真实入口：至少 1 条在线防御 E2E 证明 UI 中确实还能保留/重投，而不只是最终结算值正确。

## 2026-06-04 补记：忍者重投/奖励骰同类能力补审

### 本轮新增通用维度

- 规则文本必须逐子句拆分，像“可重掷其中 1 颗”“可重掷至多 2 颗”“奖励骰可重投 1 次”都不能继续并入主伤害结论。
- 审计不能只看 `abilities.ts` / i18n / customAction 注册，必须反查共享消费链是否真的吃到了该字段或语义。
- 对象若依赖真实界面继续保留骰子、重投、确认奖励骰或结束防御，`prompt 出现` 只算入口证据，不算真实玩法收口。

### 忍者同类对象回扫矩阵

| 对象 | 规则子句 | 共享消费链 / 实现入口 | 当前证据 | 结论 |
| --- | --- | --- | --- | --- |
| 瞬身 II | `C1 防御掷 3 骰` `C2 可重掷至多 2 颗` `C3 忍刀数量=反击伤害` `C4 手里剑固定 2 伤` `C5 2 面具得 1 烟雾弹` | `BLINK_2.trigger.phaseId=defensiveRoll/diceCount=3/rollLimit=2` -> `ABILITY_ACTIVATED` -> `reduce` 写入 `rollDiceCount/rollLimit` -> 防御 UI / `ROLL_DICE` 校验；结算走 `ninja-blink-2` | L1 已核 trigger 与文案；L2 `ninja-ability-card-contract.test.ts` 已断言 `rollLimit=2` 与结算；L3 已走到真实防御入口，但单页壳层身份与 isolated runtime 抖动仍阻塞稳定截图 | 当前 bug 已修；对象级主链路已补齐，但 L3 仍需稳定化证据 |
| 一往无前 II | `C1 4 手里剑主分支` `C2 投掷 2 骰` `C3 可重掷其中 1 颗` `C4 造成点数和伤害` `C5 最终总和<=6 则不可防御` `C6 刀尖舔血(3 手里剑)改走真实伤害分支` | `GOING_FORWARD_2.variants` -> `ninja-going-forward-2` / `ninja-going-forward-bleed` -> `createBonusDiceWithReroll(maxRerollCount=1, customResolutionId='ninja-going-forward-2')` -> `validateCommand(REROLL_BONUS_DIE)` / `SKIP_BONUS_DICE_REROLL` -> `registerBonusDiceSettlementHandler(GOING_FORWARD_2_SETTLEMENT_ID)` | L1 已有结构合同：双分支、顺序与卡图对应；L2 已由 `ninja-ability-card-contract.test.ts` 新增用例证明 `C3` 的重掷上限为 1、`C5` 收口后会把攻击改成不可防御，且 `C6` 刀尖舔血分支会按单骰结果造成等值真实伤害并直接收口攻击链；L3 仍无真实入口截图链 | 主分支与 bleed 分支都已有对象级 L2 证据；整对象仍未收口，因为真实 UI 入口与 L4 时序证据仍缺 |
| 死亡盛放 II | `C1 投掷 5 骰` `C2 忍刀=1 伤/手里剑=2 伤` `C3 1 面具则不可防御` `C4 2 面具则慢性中毒` `C5 可重掷至多 2 颗` | `DEATH_BLOSSOM_2` -> `ninja-death-blossom-2` -> `createBonusDiceWithReroll(maxRerollCount=2, customResolutionId='ninja-death-blossom-2')` -> `validateCommand(REROLL_BONUS_DIE)` / `SKIP_BONUS_DICE_REROLL` -> `registerBonusDiceSettlementHandler(DEATH_BLOSSOM_2_SETTLEMENT_ID)` | L1 已有结构合同；L2 已由 `ninja-ability-card-contract.test.ts` 新增用例证明 `C5` 的重掷上限为 2，且双面具收口后会同时命中 `C3/C4`：攻击改成不可防御并施加 1 层慢性中毒；L3 仍无真实入口截图链 | 与本次漏项同风险的兄弟对象已补到对象级 L2，但真实入口与整批 L3/L4 仍未收口 |
| 毒刃 II | `C1 投 1 奖励骰` `C2 忍刀=1 慢性中毒` `C3 手里剑/面具=2 慢性中毒` | `POISON_BLADE_2` -> `ninja-poison-blade-2` | 本轮只回扫到它不含“再投/重投上限”子句；风险点不在本次共享 `rollLimit` 合同 | 不属于本次重投漏项家族，但仍保留原总审计里的录入/实现缺口 |

### 本轮补审结论

- 本次确认的直接产品 bug 只落在 `瞬身 II`，且已经由 `trigger.rollLimit = 2` + `ABILITY_ACTIVATED` 共享消费补齐。
- 但按新通用维度回扫后，忍者至少还有两个**同风险兄弟对象**不能继续沿用旧“已审过”口径：
  - `一往无前 II`：主分支与 `刀尖舔血` bleed 分支现已都补到对象级 L2，但真实 UI 入口仍缺证据。
  - `死亡盛放 II`：`可重掷至多 2 颗` 与 `双面具 -> 不可防御 + 慢性中毒` 现已补到对象级 L2，但真实 UI 入口仍缺证据。
- 因此，忍者升级技能的“重投/奖励骰”专项结论现阶段只能写成：
  - `瞬身 II`：bug 已修，L1/L2 达标，L3 入口已到位但证据仍待稳定。
  - `一往无前 II` / `死亡盛放 II`：已从“只有结构证据”推进到“对象级 L2 已验证”，但 L3/L4 仍未补齐，不能继续宣称这一家族已经全面收口。
