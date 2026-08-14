# Dice Throne 树精 / 忍者升级技能重审（2026-05-30）

> 2026-06-05 当前有效口径：本文现在应被视为 Treant / Ninja 升级技能批次级重审主文档，而不是“还有若干升级技能对象级没补完”的旧快照。按当前代码、合同测试与 direct E2E，树精 / 忍者升级技能的实现级 `L2` 已全部补齐，对象级 `L3` 已大幅补齐，关键对象级 `L4` 也已补到可复查层；当前残余主要落在批次级 `L4` 判等治理、外围旧文档统一回写与最终发布口径统一，不能再读成“这批升级技能仍普遍对象级未实现”。

## 2026-06-06 当前真实未收口矩阵

> 本节只回答 Treant / Ninja 升级技能批次当前还剩什么，不再让历史段落里的对象级 blocker 混入现状。

| 英雄 | 当前已收敛到的层级 | 当前真实未收口项 | 不得再外推的旧口径 |
| --- | --- | --- | --- |
| `ninja` / 忍者 | 升级技能实现级 `L2` 已全补齐；对象级 `L3` 已大幅补齐；`一往无前 II`、`死亡盛放 II`、`瞬身 II`、`暗影步 II / 勒杀`、`烟雾阵 II / 九字切`、`影牙 II / 诳惑` 等关键 family `L4` 已补到可复查层 | 剩余收敛为批次级 `L4` 判等治理、旧 rule/evidence 统一回写，以及最终发布口径统一 | 不得再写成“忍者升级技能还有多张未实现”或把 `瞬身 II` 继续定性成“技能没实装” |
| `treant` / 树精 | 升级技能实现级 `L2` 已全补齐；对象级 `L3` 已大幅补齐；`扎根 II`、`破碎之拳 III`、`野蛮生长 II`、`细心呵护 II / 培育`、`自然之触 II / 自然之怜`、`复仇枝蔓 II / 苦痛根系` 等关键 family `L4` 已补到可复查层 | 剩余收敛为批次级 `L4` 判等治理、旧 rule/evidence 统一回写，以及最终发布口径统一 | 不得再写成“树精升级技能还有多张未实现”或把当前状态继续读成“主对象仍停在 L2/对象级 L3 待补” |

当前这份升级技能批次文档仍不能当作“Treant / Ninja 整英雄或四英雄整批已完成”的证明。它证明的是：升级技能对象级主 bug 已明显收敛，剩余已经提升到治理级 residual。

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
- 当前主问题已经从“还有多张升级技能没实现”转成“旧结论失效但没回写、对象级证据层级不一致”。按 2026-06-05 当前代码、合同测试与补记复核，Ninja 与 Treant 的升级技能**实现级 L2 已全部补齐，关键对象级 L4 也已大幅补齐**；剩余缺口主要落在旧文档回写、批次级 `L4` 治理口径与最终矩阵统一。

## 忍者升级技能矩阵

| 升级技能 | 当前是否应为分支技能 | 当前代码是否如此 | 结论 |
|---|---|---|---|
| 一往无前 II / 刀尖舔血 | 是 | 是 | 已按同一基础技能的双分支 `variants` 落地；主分支与 `刀尖舔血` 分支对象级 L3 已补齐，关键阈值/收口 L4 也已补齐；剩批次级治理与旧文档统一收口 |
| 斩击 II | 否 | 是 | `SLASH_2` 已按 `4/6/8` 与“3 同点获得 1 忍术”落地；对象级 direct closeout L3 已补齐，关键攻击快照 L4 已补齐；剩批次级治理与旧文档统一收口 |
| 暗影步 II / 勒杀 | 是 | 是 | 已按同一基础技能的双分支 `variants` 落地；主分支与 `勒杀` 分支对象级 L3 已补齐，关键 nonattack closeout L4 已补齐；剩批次级治理与旧文档统一收口 |
| 烟雾阵 II / 九字切 | 是 | 是 | 已按同一基础技能的双分支 `variants` 落地；主分支与 `九字切` 分支对象级 L3 已补齐，关键 simple-choice / 多目标 L4 已补齐；剩批次级治理与旧文档统一收口 |
| 影牙 II / 诳惑 | 是 | 是 | 已按同一基础技能的双分支 `variants` 落地；主分支与 `诳惑` 分支对象级 direct closeout L3 已补齐，关键 token 响应窗 / 不可防御直结算 L4 已补齐；剩批次级治理与旧文档统一收口 |
| 毒刃 II | 否 | 是 | 图片语义与当前实现一致；`L2` 已补齐双分支结算，在线 `L3` 也已补齐；旧“录入错 + 实现错”结论失效 |
| 死亡盛放 II | 否 | 是 | 奖励骰/面具/重掷语义已按升级版落地；对象级 L3 已补齐，关键面具数量分层 L4 已补齐；剩批次级治理与旧文档统一收口 |
| 瞬身 II | 否 | 主路线已对齐 | 2026-06-03 先补 `rollLimit=2`；2026-06-05 再命中 DiceTray / Dice3D UI 命中层回归；2026-06-06 继续补到 `rerollDieLimit=2`，锁住“第二次错误放行 3 颗全重掷”的共享校验缺口。现已由 `rollLimit + rerollDieLimit + UI 命中层` 三线共同收口 |

### 忍者最关键的结构结论

- `一往无前 II / 刀尖舔血`
  - 是同一技能的两个分支。
  - 当前代码已按该结构落地；剩余问题转为 L4 收口。
- `暗影步 II / 勒杀`
  - 是同一技能的两个分支。
  - 当前代码已按该结构落地；本轮已把主分支与 `勒杀` 分支补到对象级 L3。
- `烟雾阵 II / 九字切`
  - 是同一技能的两个分支。
  - 当前代码已按该结构落地；本轮已把主分支与 `九字切` 分支补到对象级 L3。
- `影牙 II / 诳惑`
  - 是同一技能的两个分支。
  - 当前代码已按该结构落地；本轮已把主分支与 `诳惑` 分支补到对象级 L3。

## 树精升级技能矩阵

| 升级技能 | 当前是否应为分支技能 | 当前代码是否如此 | 结论 |
|---|---|---|---|
| 细心呵护 II / 培育 | 是 | 是 | 已按同一基础技能的双分支 `variants` 落地；主分支与 `培育` 分支对象级 direct closeout L3 已补齐，关键 nonattack closeout L4 已补齐；剩批次级治理与旧文档统一收口 |
| 扎根 II | 否 | 是 | `ROOTED_2` 的 4 骰防御合同、双树叶/双树灵分支与真实防御入口已补到对象级 L3；关键防御收口 L4 已补齐；剩批次级治理与旧文档统一收口 |
| 破碎之拳 III | 否 | 是 | L2 与技能本体对象级 direct closeout L3 已补齐；关键攻击快照 L4 已补齐；剩批次级治理与旧文档统一收口 |
| 自然之触 II / 自然之怜 | 是 | 是 | 已按同一基础技能的双分支 `variants` 落地；主分支与 `自然之怜` 分支对象级 direct closeout L3 已补齐，关键收口 L4 已补齐；剩批次级治理与旧文档统一收口 |
| 复仇枝蔓 II / 苦痛根系 | 是 | 是 | 已按同一基础技能的双分支 `variants` 落地；主分支与 `苦痛根系` 分支对象级 direct closeout L3 已补齐，关键收口 L4 已补齐；剩批次级治理与旧文档统一收口 |
| 野蛮生长 II / 乱花迷眼 | 是 | 是 | 已按同一基础技能的双分支 `variants` 落地；主分支与 `乱花迷眼` 分支对象级 direct closeout L3 已补齐，主分支 `displayOnly -> 养成选择 -> 攻击收口 -> SKIP settlement 清空` 的关键 L4 也已补齐，整对象剩批次口径统一 |
| 破碎之拳 II | 否 | 是 | L2 与技能本体对象级 direct closeout L3 已补齐；当前对象级无新的关键 L4 缺口，剩批次级治理与旧文档统一收口 |

## 失效旧结论与当前阅读门禁

下列文档里曾出现过会误导当前升级技能状态的旧结论，但**不能再把整份文档整体打成失效**；现行阅读口径必须区分“旧正文里哪段失效”与“该文档后续是否已回写出新的现行矩阵”：

- `src/games/dicethrone/rule/ninja录入核对.md`
  - 失效的是更早版本里把若干 Ninja 升级技能写成“录入错 / 实现错 / 对象级 L3/L4 仍待补”的旧结论。
  - 当前应以该文档 **2026-06-05 当前结论** 与批次级 `L4` 判等矩阵为准，不能再把整份 rule 文档视为失效。
- `src/games/dicethrone/rule/ninja卡牌录入核对.md`
  - 失效的是更早版本里把“实现能跑”外推成“升级技能素材语义已录对”的旧摘要。
- `src/games/dicethrone/rule/treant录入核对.md`
  - 失效的是更早版本里把若干 Treant 升级技能写成“录入错 / 实现错 / 对象级 L3/L4 仍待补”的旧结论。
  - 当前应以该文档 **2026-06-05 当前结论** 与批次级 `L4` 判等矩阵为准，不能再把整份 rule 文档视为失效。
- `src/games/dicethrone/rule/treant卡牌录入核对.md`
  - 失效的是更早版本里把“实现能跑”外推成“升级技能素材语义已录对”的旧摘要。
- `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md`
  - 失效的是其中把升级技能对象级残余继续写成当前未补的旧行；本文现已回写成“单英雄历史轨迹 + 当前阅读门禁”。
- `evidence/dicethrone/dicethrone-ninja-ability-real-entry-e2e-2026-05-17.md`
  - 失效的是若把该文档外推成“Ninja 升级技能整批已全面收口”的读法；它现在只应作为对象级子证据。
- `evidence/dicethrone/dicethrone-treant-full-audit-2026-05-16.md`
  - 失效的是其中把部分升级技能/对象级残余写成当前未补的旧口径；本文现已回写成“单英雄历史轨迹 + 当前阅读门禁”。

这些旧结论失效的根因，不是文档“没跑 E2E”，而是它们曾把**当前实现能跑通**误判成了**素材语义已录对**，或把历史对象级残余继续保留成当前状态。

## 当前剩余优先级

### 忍者

1. 批次级 `L4` 共享链判等矩阵、最终发布口径与对象级结论统一
2. 旧 Ninja rule/evidence 结论回写

### 树精

1. 批次级 `L4` 共享链判等矩阵、最终发布口径与对象级结论统一
2. 旧 Treant rule/evidence 结论回写

## 当前收口口径

- 通用录入规范与项目录入 workflow 已先补硬。
- 树精与忍者的升级技能审计结论现已冻结成文，但若本文前段旧矩阵与后续补记冲突，一律以后续补记为准。
- 截至 2026-06-05，本文范围内真正剩余的已经不是“还有多张升级技能没实施 / 没补对象级关键 L4”，而是**批次级 `L4` 判等治理、外围旧文档统一回写与最终对外口径统一**。

## 2026-06-06 补记：瞬身 II 仍有一层共享校验漏项

- 2026-06-05 把 `瞬身 II` 重新定性成“UI 命中层回归，而非技能没实装”之后，继续按 D5/D8/D50 回扫真实命令链，又发现一条此前没锁住的共享实现缺口：
  - `BLINK_2.trigger.rollLimit = 2` 只能限制“防御阶段总掷骰次数”，不能限制“第二次最多只允许重掷 2 颗骰子”。
  - 在旧实现里，只要玩家在第二次防御掷骰前不锁任何骰子，就能把 3 颗骰子一起重掷，和卡图“可重掷至多 2 颗”不一致。
- 本轮修复：
  - `src/games/dicethrone/domain/combat/conditions.ts` 为 `phase` trigger 新增 `rerollDieLimit`。
  - `src/games/dicethrone/heroes/ninja/abilities.ts` 给 `BLINK_2` 明确声明 `rerollDieLimit: 2`。
  - `src/games/dicethrone/domain/commandValidation.ts` 在 `defensiveRoll + rollCount > 0` 时新增共享校验：若当前防御技能声明了 `rerollDieLimit`，则第二次掷骰前未锁定骰子数不得超过该上限。
- 新回归：
  - `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts`
  - 新增两条命令级合同：
    - `Blink II` 第二次防御重投前若仍解锁 3 颗骰子，应返回 `defense_reroll_die_limit_exceeded`
    - 锁定 1 颗后，第二次只重投另外 2 颗仍应放行并正确改值
- 当前结论更新：
  - `瞬身 II` 不是“完全没实装”，但直到 2026-06-06 之前，它的“至多 2 颗”这条共享消费合同仍未真正锁死。
  - 现已从“只有 `rollLimit=2` 与 UI 点击链”提升为“`rollLimit=2 + rerollDieLimit=2 + UI 命中层` 三层都锁住”。

## 2026-06-03 补记：瞬身 II 漏项根因

- 漏的不是主结算，而是**防御阶段共享合同**里的“还能再投几次”。
- 旧审计把 `BLINK_2` 的结算文案、`customActionId` 和 3 骰入口核到了，但没有把“可重掷至多 2 颗”拆成独立子句验收。
- 旧实施路径也只核了 `diceCount=3` 与最终伤害/烟雾弹，没有核 `handleAbilityActivated -> rollLimit` 这条共享消费链。
- 现已补的硬门禁：
  - 合同层：防御技能若卡面写“可重掷/再投”，必须在触发定义中显式声明 `rollLimit`。
  - 自动化：至少 1 条合同测试断言防御技能激活后 `rollLimit` 正确。
  - 真实入口：至少 1 条在线防御 E2E 证明 UI 中确实还能保留/重投，而不只是最终结算值正确。

## 2026-06-05 补记：瞬身 II 再失效并非“未实装”，而是 UI 命中层回归

- 2026-06-05 重新执行真实防御 E2E 时，`瞬身 II` 一度再次报红；这次不能再沿用 2026-06-03 的“实现缺 `rollLimit`”归因，因为合同层与 reducer 层已先有绿证据。
- 复跑命令：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-defense-selection.e2e.ts "忍者瞬身 II 应在真实防御掷骰界面支持保留 1 颗并重投另外 2 颗"`
- 红点分层结论：
  - 真实 UI 点击 `die-button-0` 后，状态里 `die0.isKept=false`，但相邻骰子会被锁住，说明点击命中目标发生偏移。
  - 同一时刻若由 harness 直接发送 `TOGGLE_DIE_LOCK(dieId=0)`，则 `die0` 可以正常锁定，说明 `ABILITY_ACTIVATED -> rollLimit -> command validation -> reducer` 这条实现链已通。
  - 因此本次失效根因不在技能定义、不在防御 resolver，也不在“重投能力没实施”，而在 DiceTray 真实点击命中链。
- 产品修复：
  - `src/games/dicethrone/ui/DiceTray.tsx` 已把 `Dice3D` 包进 `pointer-events-none` 容器，剥离 3D 视觉层对真实点击的截获，让命中统一回到 `die-button-*` 包裹层。
- 修后复跑：
  - 同一命令复跑结果：`1 passed`
- 当前口径：
  - `瞬身 II` 这次问题已从“实现漏项”纠偏为“UI 命中层回归”。
  - 旧“技能没实装 / 防御重投没实施”的说法对 2026-06-05 当前代码状态已不成立。

## 2026-06-04 补记：忍者重投/奖励骰同类能力补审

### 本轮新增通用维度

- 规则文本必须逐子句拆分，像“可重掷其中 1 颗”“可重掷至多 2 颗”“奖励骰可重投 1 次”都不能继续并入主伤害结论。
- 审计不能只看 `abilities.ts` / i18n / customAction 注册，必须反查共享消费链是否真的吃到了该字段或语义。
- 对象若依赖真实界面继续保留骰子、重投、确认奖励骰或结束防御，`prompt 出现` 只算入口证据，不算真实玩法收口。

### 忍者同类对象回扫矩阵

| 对象 | 规则子句 | 共享消费链 / 实现入口 | 当前证据 | 结论 |
| --- | --- | --- | --- | --- |
| 瞬身 II | `C1 防御掷 3 骰` `C2 可重掷至多 2 颗` `C3 忍刀数量=反击伤害` `C4 手里剑固定 2 伤` `C5 2 面具得 1 烟雾弹` | `BLINK_2.trigger.phaseId=defensiveRoll/diceCount=3/rollLimit=2/rerollDieLimit=2` -> `ABILITY_ACTIVATED` -> `reduce` 写入 `rollDiceCount/rollLimit` -> 防御 UI / `ROLL_DICE` 校验；结算走 `ninja-blink-2` | L1 已核 trigger 与文案；L2 现已由 `ninja-ability-card-contract.test.ts` 同时断言 `rollLimit=2`、第二次不能放行 3 颗全重掷、以及锁 1 颗后仍可重投另外 2 颗并正确改值；L3 已由 `e2e/dicethrone/dicethrone-defense-selection.e2e.ts` 稳定跑通“首次防御掷骰 -> 保留 1 颗 -> 重投另外 2 颗 -> 确认并结束防御 -> 收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-defense-selection.e2e\忍者瞬身-II-应在真实防御掷骰界面支持保留-1-颗并重投另外-2-颗\ninja-blink-2-defense-first-roll.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-defense-selection.e2e\忍者瞬身-II-应在真实防御掷骰界面支持保留-1-颗并重投另外-2-颗\ninja-blink-2-defense-second-roll.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-defense-selection.e2e\忍者瞬身-II-应在真实防御掷骰界面支持保留-1-颗并重投另外-2-颗\ninja-blink-2-defense-closeout.png` | 当前 bug 已修；对象级主链路现已补到稳定 L3，整批剩余缺口转为 L4 收口 |
| 一往无前 II | `C1 4 手里剑主分支` `C2 投掷 2 骰` `C3 可重掷其中 1 颗` `C4 造成点数和伤害` `C5 最终总和<=6 则不可防御` `C6 刀尖舔血(3 手里剑)改走真实伤害分支` | `GOING_FORWARD_2.variants` -> `ninja-going-forward-2` / `ninja-going-forward-bleed` -> `createBonusDiceWithReroll(maxRerollCount=1, customResolutionId='ninja-going-forward-2')` -> `validateCommand(REROLL_BONUS_DIE)` / `SKIP_BONUS_DICE_REROLL` -> `registerBonusDiceSettlementHandler(GOING_FORWARD_2_SETTLEMENT_ID)` | L1 已有结构合同：双分支、顺序与卡图对应；L2 已由 `ninja-ability-card-contract.test.ts` 覆盖 `C3` 的重掷上限为 1、`C5` 在总和 `<=6` 时会把攻击改成不可防御、总和 `>6` 时保持可防御，以及 `C6` 刀尖舔血分支会按单骰结果造成等值真实伤害并直接收口攻击链；L3 已补主分支真实入口：`e2e/dicethrone/dicethrone-ninja-bonus-reroll.e2e.ts` 现已稳定跑通“真实槽位 -> 变体选择 -> 奖励骰 -> 1 次重投到上限 -> closeout”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-bonus-reroll.e2e\一往无前-II-主分支应从真实槽位进入奖励骰界面，并在-1-次重投后达到上限\ninja-going-forward-2-main-variant-choice.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-bonus-reroll.e2e\一往无前-II-主分支应从真实槽位进入奖励骰界面，并在-1-次重投后达到上限\ninja-going-forward-2-main-limit-reached.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-bonus-reroll.e2e\一往无前-II-主分支应从真实槽位进入奖励骰界面，并在-1-次重投后达到上限\ninja-going-forward-2-main-after-closeout.png`；`C6` bleed 分支现也已补对象级 L3：`e2e/dicethrone/dicethrone-ninja-bonus-reroll.e2e.ts` 已稳定跑通“真实槽位 -> 变体选择 -> 刀尖舔血奖励骰特写 -> 真实伤害收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-bonus-reroll.e2e\一往无前-II-的刀尖舔血分支应从真实槽位进入分支选择，并按单骰结果造成真实伤害后收口\ninja-going-forward-2-bleed-variant-choice.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-bonus-reroll.e2e\一往无前-II-的刀尖舔血分支应从真实槽位进入分支选择，并按单骰结果造成真实伤害后收口\ninja-going-forward-2-bleed-overlay.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-bonus-reroll.e2e\一往无前-II-的刀尖舔血分支应从真实槽位进入分支选择，并按单骰结果造成真实伤害后收口\ninja-going-forward-2-bleed-after-closeout.png` | 主分支与 bleed 分支都已补到对象级 L3；奖励骰总和 `<=6 / >6` 的 L4 合同边界已补，整对象剩余缺口收敛到更高阶组合分支与批次口径统一 |
| 死亡盛放 II | `C1 投掷 5 骰` `C2 忍刀=1 伤/手里剑=2 伤` `C3 1 面具则不可防御` `C4 2 面具则慢性中毒` `C5 可重掷至多 2 颗` | `DEATH_BLOSSOM_2` -> `ninja-death-blossom-2` -> `createBonusDiceWithReroll(maxRerollCount=2, customResolutionId='ninja-death-blossom-2')` -> `validateCommand(REROLL_BONUS_DIE)` / `SKIP_BONUS_DICE_REROLL` -> `registerBonusDiceSettlementHandler(DEATH_BLOSSOM_2_SETTLEMENT_ID)` | L1 已有结构合同；L2 已由 `ninja-ability-card-contract.test.ts` 覆盖 `C5` 的重掷上限为 2，以及 `0/1/2` 面具数量的收口分层：`0 面具` 保持可防御、`1 面具` 仅改成不可防御、`2 面具` 同时命中不可防御与 1 层慢性中毒；L3 已补真实入口：`e2e/dicethrone/dicethrone-ninja-bonus-reroll.e2e.ts` 已稳定跑通“真实槽位 -> 奖励骰 -> 2 次重投到上限 -> closeout”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-bonus-reroll.e2e\死亡盛放-II-应从真实槽位进入奖励骰界面，并在-2-次重投后达到上限\ninja-death-blossom-2-overlay-initial.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-bonus-reroll.e2e\死亡盛放-II-应从真实槽位进入奖励骰界面，并在-2-次重投后达到上限\ninja-death-blossom-2-limit-reached.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-bonus-reroll.e2e\死亡盛放-II-应从真实槽位进入奖励骰界面，并在-2-次重投后达到上限\ninja-death-blossom-2-after-closeout.png`；closeout 后权威状态代表链为对手 HP `30 -> 25`、`delayed_poison = 1`、`pendingAttack/pendingDamage = null` | 对象级主链路已补到 L3；面具数量分层的 L4 合同边界已补，整批剩余缺口继续收敛到更高阶组合分支与批次口径统一 |
| 毒刃 II | `C1 小顺子` `C2 投 1 奖励骰` `C3 忍刀=1 慢性中毒` `C4 手里剑/面具=2 慢性中毒` `C5 造成 9 点伤害` | `POISON_BLADE_2` -> `ninja-poison-blade-2` -> `handlePoisonBlade2` -> `BONUS_DICE_REROLL_REQUESTED(displayOnly)` -> `SKIP_BONUS_DICE_REROLL` / 奖励骰结算后继续攻击 closeout | 2026-07-04 回图复核后，本行旧 `5` 伤害口径失效；L2 当前由 `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 锁定 2 条完整攻击收口用例：`忍刀 -> delayed_poison=1 + HP 30->21` 与 `手里剑/面具 -> delayed_poison=2 + HP 30->21`；若树精 `rooted` 防御链介入并防止 3 点伤害，9 点攻击应收口为 `对手 HP 30->24`，不再沿用旧 `30->28` 结论 | 旧 `5` 伤害、旧 `HP 30->25`、旧 `HP 30->28` 均为历史失效证据；当前以正式卡图、`POISON_BLADE_2` 9 伤害实现和 2026-07-04 合同测试为准 |

### 本轮补审结论

- 本次确认的直接产品 bug 只落在 `瞬身 II`，且直到 2026-06-06 才真正补齐到 `trigger.rollLimit = 2 + rerollDieLimit = 2` 的共享消费层。
- 但按新通用维度回扫后，忍者这一家族仍不能继续沿用旧“已审过”口径，因为虽然对象级 L3 已补齐，**整批 L4 与跨对象收口还未完成**：
  - `一往无前 II`：主分支与 `刀尖舔血` bleed 分支现都已补到对象级 L3。
  - `死亡盛放 II`：对象级主链路现已补到 L3。
  - `瞬身 II`：对象级真实防御重投链现已补到稳定 L3。
- `毒刃 II` 在 2026-07-04 回图复核中确认旧证据失效：
  - 当前正式卡图口径为“小顺子 -> 投 1 骰 -> 忍刀 1 毒 / 手里剑或面具 2 毒 -> 造成 9 伤害”。
  - 当前实现 `POISON_BLADE_2` 已同步为 `damage(9)`，中英文文案与合同测试也已同步。
  - 旧文档中基于 5 伤害推导的 `HP 30->25`、树精 `rooted` 防御链后的 `HP 30->28` 均为历史失效证据；无防御收口应为 `HP 30->21`，若树精防止 3 点伤害则应为 `HP 30->24`。
- 因此，忍者升级技能的“重投/奖励骰”专项结论现阶段只能写成：
  - `瞬身 II`：bug 已修，L1/L2/L3 达标。
  - `一往无前 II`：主分支与 bleed 分支都已从“只有结构证据”推进到“对象级 L3 已验证”。
  - `死亡盛放 II`：已从“只有结构证据”推进到“对象级 L3 已验证”。
  - `毒刃 II`：L1/L2/L3 已达标。
  - 但整批 L4、跨对象代表链判等与最终“全面审计完成”口径仍未补齐，不能继续宣称这一家族已经全面收口。

### 2026-06-04 继续补记：本地 direct E2E 已补对象级 L3

- 新增 direct E2E 文件：`e2e/dicethrone/dicethrone-ninja-bonus-reroll.e2e.ts`
- 验证命令：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-ninja-bonus-reroll.e2e.ts`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-defense-selection.e2e.ts "忍者瞬身 II 应在真实防御掷骰界面支持保留 1 颗并重投另外 2 颗"`
  - `npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts --configLoader native --maxWorkers 1`
- 结果：
  - 奖励骰 direct E2E：`3 passed`
  - 防御重投 direct E2E：`1 passed`
  - 合同测试：旧批次 `17 passed`；2026-06-05 奖励骰 family、直结算 / postDamage family、simple-choice / nonattack closeout family 的 L4 合同补记后，`ninja-ability-card-contract.test.ts` 已提升为 `29 passed`

### 本轮新增反思 / 审计方法缺口

- `一往无前 II` 暴露出旧审计的一个真实漏项：**不能把“玩家板槽位可点”直接等价成“攻击已创建”**。这张卡的真实入口链路是“槽位点击 -> 变体选择 -> 主分支/bleed 分支 -> 奖励骰 / 真实伤害收口”，旧口径漏了“变体选择”这一段，因此之前的所谓入口证据不成立。
- `一往无前 II` 与 `死亡盛放 II` 共同暴露出另一条缺口：**奖励骰 closeout 后不能继续盯着中间态字段**。在本地 harness 下，`pendingAttack.sourceAbilityId / isDefendable / bonusDamage` 会在攻击真正收口后被清空；正确的 L3/L4 证据应该回到最终权威状态，例如对手 HP、`delayed_poison`、`pendingAttack/pendingDamage` 是否清空。2026-06-05 已进一步把这条缺口固化成 L4 合同：`一往无前 II` 需同时证明 `<=6` 与 `>6` 的可防御分层，`死亡盛放 II` 需同时证明 `0/1/2` 面具数量对应的三档收口。
- 这也是为什么本轮前半段虽然已经补了 L2，却还不能叫“全面审计完成”：旧审计没有把“变体选择”和“最终收口态”拆成独立验收子句。

### 2026-06-04 继续补记：忍者分支型升级技能对象级补审

#### 失效旧结论回写

- 本文 2026-05-30 初版中，`暗影步 II / 勒杀`、`烟雾阵 II / 九字切` 两行写成“当前代码不是这样做的 / 录入错 + 实现错”。
- 该结论对 **2026-06-04 当前代码状态** 已不再成立：
  - `SHADOW_STEP_2` 现已是 `shadow-step-2-main / shadow-step-2-strangle` 双分支结构。
  - `SMOKE_SCREEN_2` 现已是 `smoke-screen-2-main / smoke-screen-2-kuji-kiri` 双分支结构。
- 本轮补的是**对象级 L2/L3 证据**，不是新增实现；因此这两条应从“结构缺失/未实现”降级为“旧审计结论失效，当前对象级证据先前不足，现已补到 L3”。

#### 对象级矩阵

| 对象 | 规则子句 | 实现入口 / 消费链 | 当前证据 | 结论 |
| --- | --- | --- | --- | --- |
| 暗影步 II 主分支 | `C1 4 面具` `C2 获得 1 烟雾弹` `C3 施加 2 慢性中毒` `C4 造成 5 点不可防御伤害` | `SHADOW_STEP_2.variants[shadow-step-2-main]` -> `grantToken(self, smoke_bomb, 1)` + `grantToken(opponent, delayed_poison, 2)` + `damage(5, unblockable)` | L2：`src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 已锁定主分支结算；L3：`e2e/dicethrone/dicethrone-ninja-variant-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 变体选择 -> closeout”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-variant-closeout.e2e\暗影步-II-主分支应从真实槽位进入变体选择，并按-5-点不可防御伤害-+-2-慢性中毒收口\ninja-shadow-step-2-main-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-variant-closeout.e2e\暗影步-II-主分支应从真实槽位进入变体选择，并按-5-点不可防御伤害-+-2-慢性中毒收口\ninja-shadow-step-2-main-variant-choice.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-variant-closeout.e2e\暗影步-II-主分支应从真实槽位进入变体选择，并按-5-点不可防御伤害-+-2-慢性中毒收口\ninja-shadow-step-2-main-after-closeout.png` | 对象级主分支已补到 L3 |
| 勒杀 | `C1 3 面具` `C2 获得 3 忍术` `C3 对 1 名对手施加 2 慢性中毒` `C4 不造成攻击伤害，直接收口` | `SHADOW_STEP_2.variants[shadow-step-2-strangle]` -> `grantToken(self, ninjutsu, 3)` + `grantToken(opponent, delayed_poison, 2)` + `ninja-nonattack-closeout` | L2：`ninja-ability-card-contract.test.ts` 已断言不产生 `DAMAGE_DEALT`，且最终是 `ninjutsu=3 / delayed_poison=2 / isDefendable=false`；L3：`e2e/dicethrone/dicethrone-ninja-variant-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 变体选择 -> 勒杀收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-variant-closeout.e2e\暗影步-II-的勒杀分支应从真实槽位进入变体选择，并在不造成攻击伤害的前提下收口\ninja-shadow-step-2-strangle-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-variant-closeout.e2e\暗影步-II-的勒杀分支应从真实槽位进入变体选择，并在不造成攻击伤害的前提下收口\ninja-shadow-step-2-strangle-variant-choice.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-variant-closeout.e2e\暗影步-II-的勒杀分支应从真实槽位进入变体选择，并在不造成攻击伤害的前提下收口\ninja-shadow-step-2-strangle-after-closeout.png` | 勒杀分支已补到对象级 L3 |
| 烟雾阵 II 主分支 | `C1 1 忍刀 + 2 手里剑 + 1 面具` `C2 1 名玩家获得 1 烟雾弹和 3 忍术` `C3 对 1 名对手施加 1 慢性中毒` `C4 直接收口` | `SMOKE_SCREEN_2.variants[smoke-screen-2-main]` -> `ninja-smoke-screen-2` -> `CHOICE_REQUESTED` -> `NINJA_SMOKE_SCREEN_2_CHOICE_ID` -> `grantToken + delayedPoison + closeoutNonAttackVariant` | L2：`ninja-ability-card-contract.test.ts` 已改用真实 `choiceResolvedEventHandler` followup 路径，断言 `smoke_bomb=1 / ninjutsu=3 / delayed_poison=1 / isDefendable=false`；L3：`e2e/dicethrone/dicethrone-ninja-variant-closeout.e2e.ts` 已稳定跑通真实槽位收口，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-variant-closeout.e2e\烟雾阵-II-主分支应从真实槽位收口到-1-烟雾弹-+-3-忍术-+-1-慢性中毒\ninja-smoke-screen-2-main-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-variant-closeout.e2e\烟雾阵-II-主分支应从真实槽位收口到-1-烟雾弹-+-3-忍术-+-1-慢性中毒\ninja-smoke-screen-2-main-after-closeout.png` | 主分支已补到对象级 L3 |
| 九字切 | `C1 3 手里剑 + 2 面具` `C2 对 2 名对手各造成 4 点真实伤害` `C3 可选择同 1 名对手两次` `C4 直接收口` | `SMOKE_SCREEN_2.variants[smoke-screen-2-kuji-kiri]` -> `ninja-smoke-screen-kuji-kiri` -> `CHOICE_REQUESTED` -> `NINJA_SMOKE_SCREEN_KUJI_KIRI_CHOICE_ID` -> `createUnblockableDamageEvents ×2` -> `closeoutNonAttackVariant` | L2：`ninja-ability-card-contract.test.ts` 已按“同一名对手两次”分支断言对手 HP `30 -> 22` 且 `isDefendable=false`；L3：`e2e/dicethrone/dicethrone-ninja-variant-closeout.e2e.ts` 已稳定跑通真实槽位收口，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-variant-closeout.e2e\烟雾阵-II-的九字切分支应从真实槽位收口到同一名对手两次-4-点真实伤害\ninja-smoke-screen-2-kuji-kiri-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-variant-closeout.e2e\烟雾阵-II-的九字切分支应从真实槽位收口到同一名对手两次-4-点真实伤害\ninja-smoke-screen-2-kuji-kiri-after-closeout.png` | 九字切分支已补到对象级 L3 |

#### 验证命令

- `npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts --configLoader native --maxWorkers 1`
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-ninja-variant-closeout.e2e.ts`

#### 结果

- `ninja-ability-card-contract.test.ts`：`17 passed`
- `dicethrone-ninja-variant-closeout.e2e.ts`：`4 passed`

#### 本轮新增方法论回写

- `烟雾阵 II` 家族暴露出新的审计缺口：**`simple-choice / CHOICE_RESOLVED` 不能只 forged 一个 reducer 事件就当“分支效果已验证”**。这类对象真正的业务链是 `SYS_INTERACTION_RESOLVED -> CHOICE_RESOLVED -> choiceResolvedEventHandler followup -> 最终权威状态`；只测 reducer 最多证明锚点校验或通用 token/status 增量，不能替代 followup handler 真正生效。
- 因此本轮已经把通用门禁补硬到 `.spec/knowledge/standards/testing-audit.md`：凡对象效果依赖 `choiceResolvedEventHandler`，L2 必须走真实 choice 锚点链或显式调用注册 handler，L3 仍需真实弹窗点击后的最终收口证据。

### 2026-06-04 继续补记：Ninja direct closeout 已补对象级 L3

- 新增 direct E2E 文件：`e2e/dicethrone/dicethrone-ninja-direct-closeout.e2e.ts`
- 验证命令：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-ninja-direct-closeout.e2e.ts`
- 结果：
  - `dicethrone-ninja-direct-closeout.e2e.ts`：`3 passed`

#### 失效旧结论回写

- 本文 2026-05-30 初版中，`斩击 II` 与 `影牙 II / 诳惑` 仍写成“对象级 L2 已补齐，真实 closeout L3/L4 仍待补”。
- 该结论对 **2026-06-05 当前代码状态** 已不再成立：这两组对象的 direct closeout 已补到对象级 L3，关键 L4 也已补齐；剩余缺口转为批次级治理与旧文档统一，而不是“仍未打到真实收口”。

#### 对象级矩阵

| 对象 | 规则子句 | 实现入口 / 消费链 | 当前证据 | 结论 |
| --- | --- | --- | --- | --- |
| 斩击 II | `C1 3/4/5 忍刀分别造成 4/6/8 点伤害` `C2 若投出 3 个相同数字则获得 1 忍术` | `SLASH_2` -> `damage(4/6/8)` + `postDamage` 读取攻击骰快照授予 `ninjutsu` | L2：`src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 与 `src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts` 已锁定 `4/6/8` 伤害、`3` 同点授予 `1` 忍术且读取攻击骰快照；L3：`e2e/dicethrone/dicethrone-ninja-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 攻击收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-direct-closeout.e2e\斩击-II-应从真实槽位收口到-4-点伤害-+-1-忍术\ninja-slash-2-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-direct-closeout.e2e\斩击-II-应从真实槽位收口到-4-点伤害-+-1-忍术\ninja-slash-2-after-closeout.png` | 对象级已补到 L3，关键攻击快照 L4 已补齐；剩批次级治理与旧文档统一收口 |
| 影牙 II 主分支 | `C1 大顺子` `C2 获得 1 烟雾弹` `C3 获得 2 忍术` `C4 造成 8 点伤害` | `SHADOW_FANG_2.variants[shadow-fang-2-main]` -> `grantToken(smoke_bomb, 1)` + `grantToken(ninjutsu, 2)` + `damage(8)` | L2：`src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 已锁定主分支结算；L3：`e2e/dicethrone/dicethrone-ninja-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 变体选择 -> 主分支收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-direct-closeout.e2e\影牙-II-主分支应从真实槽位收口到-8-点伤害-+-1-烟雾弹-+-2-忍术\ninja-shadow-fang-2-main-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-direct-closeout.e2e\影牙-II-主分支应从真实槽位收口到-8-点伤害-+-1-烟雾弹-+-2-忍术\ninja-shadow-fang-2-main-after-closeout.png` | 主分支已补到对象级 L3 |
| 诳惑 | `C1 2 忍刀 + 2 面具` `C2 获得 1 烟雾弹` `C3 造成 2 点不可防御伤害` | `SHADOW_FANG_2.variants[shadow-fang-2-deceive]` -> `grantToken(smoke_bomb, 1)` + `damage(2, unblockable)` | L2：`src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 已锁定分支结算；L3：`e2e/dicethrone/dicethrone-ninja-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 变体选择 -> 诳惑收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-direct-closeout.e2e\影牙-II-的诳惑分支应从真实槽位收口到-2-点不可防御伤害-+-1-烟雾弹\ninja-shadow-fang-2-deceive-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-direct-closeout.e2e\影牙-II-的诳惑分支应从真实槽位收口到-2-点不可防御伤害-+-1-烟雾弹\ninja-shadow-fang-2-deceive-after-closeout.png` | 诳惑分支已补到对象级 L3 |

### 2026-06-04 继续补记：Treant 四组升级技能 direct closeout 已补对象级 L3

- 新增 direct E2E 文件：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts`
- 验证命令：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts`
- 结果：
  - `dicethrone-treant-upgrade-direct-closeout.e2e.ts`：`8 passed`

#### 失效旧结论回写

- 本文 2026-05-30 初版中，`细心呵护 II / 培育`、`自然之触 II / 自然之怜`、`复仇枝蔓 II / 苦痛根系`、`野蛮生长 II / 乱花迷眼` 仍写成“对象级 L2 已补齐，技能本体对象级 L3/L4 仍待补”。
- 该结论对 **2026-06-05 当前代码状态** 已不再成立：上述四组对象的主分支与替代分支都已补到对象级 direct closeout L3，关键 L4 也已补齐；剩余缺口收敛为批次级治理与旧文档统一。

#### 对象级矩阵

| 对象 | 规则子句 | 实现入口 / 消费链 | 当前证据 | 结论 |
| --- | --- | --- | --- | --- |
| 细心呵护 II 主分支 | `C1 抽 1` `C2 养成 4 次` `C3 自己获得 1 生命源泉` `C4 对手获得 1 刺藤` | `TEND_CARE_2.variants[tend-care-2-main]` -> `draw(1)` + `cultivate(4)` + `grantToken(self, life_sap, 1)` + `grantToken(opponent, thorn, 1)` | L2：`src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` 已锁定主分支结算；L3：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 主分支收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\细心呵护-II-主路线应从真实槽位收口到抽-1-+-4-次养成-+-自己获得生命源泉-+-对手获得刺藤\treant-tend-care-2-main-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\细心呵护-II-主路线应从真实槽位收口到抽-1-+-4-次养成-+-自己获得生命源泉-+-对手获得刺藤\treant-tend-care-2-main-after-closeout.png` | 主分支已补到对象级 L3 |
| 培育 | `C1 养成 6 次` | `TEND_CARE_2.variants[tend-care-2-cultivate]` -> `cultivate(6)` | L2：`treant-ability-card-contract.test.ts` 已锁定分支结算；L3：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 培育收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\细心呵护-II-的培育分支应从真实槽位收口到-6-次养成\treant-tend-care-2-cultivate-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\细心呵护-II-的培育分支应从真实槽位收口到-6-次养成\treant-tend-care-2-cultivate-after-closeout.png` | 培育分支已补到对象级 L3 |
| 自然之触 II 主分支 | `C1 养成 2 树灵` `C2 造成 6 点不可防御伤害` `C3 每有 1 个树灵 +1 伤害` | `NATURE_TOUCH_2.variants[nature-touch-2-main]` -> `natureTouchCultivate(...)` + `damage(6, unblockable)`；后续由养成后的树灵总数写入 `pendingAttack.bonusDamage` | L2：`treant-ability-card-contract.test.ts` 已锁定主分支结算，明确覆盖“先养成 2 树灵，再按养成后的树灵总数增加不可防御伤害”；L3：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 主分支收口”，当前这条样例从 `1 幼种 + 1 木苗` 起手并选择 `幼种 3 / 木苗 1`，因此样例收口结果落为 `10` 点不可防御伤害；这里的 `10` 只证明该起手树灵分布下的样例最终态，不是把技能主语义改写成“固定 10 伤害”。关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\自然之触-II-主路线应从真实槽位收口到-10-点不可防御伤害\treant-nature-touch-2-main-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\自然之触-II-主路线应从真实槽位收口到-10-点不可防御伤害\treant-nature-touch-2-main-after-closeout.png` | 主分支已补到对象级 L3 |
| 自然之怜 | `C1 治疗 1` `C2 获得 1 CP` `C3 抽 1` `C4 养成 1 次` | `NATURE_TOUCH_2.variants[nature-touch-2-mercy]` -> `heal(1)` + `gainCp(1)` + `draw(1)` + `cultivate(1)` | L2：`treant-ability-card-contract.test.ts` 已锁定分支结算；L3：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 自然之怜收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\自然之触-II-的自然之怜分支应从真实槽位收口到治疗-+1-CP-+-抽-1-+-1-次养成\treant-nature-touch-2-mercy-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\自然之触-II-的自然之怜分支应从真实槽位收口到治疗-+1-CP-+-抽-1-+-1-次养成\treant-nature-touch-2-mercy-after-closeout.png` | 自然之怜分支已补到对象级 L3 |
| 复仇枝蔓 II 主分支 | `C1 造成 8 点伤害` `C2 对手获得 1 刺藤` | `VENGEFUL_VINES_2.variants[vengeful-vines-2-main]` -> `damage(8)` + `grantToken(opponent, thorn, 1)` | L2：`treant-ability-card-contract.test.ts` 已锁定主分支结算；L3：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 主分支收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\复仇枝蔓-II-主路线应从真实槽位收口到-8-点伤害-+-1-刺藤\treant-vengeful-vines-2-main-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\复仇枝蔓-II-主路线应从真实槽位收口到-8-点伤害-+-1-刺藤\treant-vengeful-vines-2-main-after-closeout.png` | 主分支已补到对象级 L3 |
| 苦痛根系 | `C1 每有 1 个树灵造成 1 点真实伤害` | `VENGEFUL_VINES_2.variants[vengeful-vines-2-pain]` -> `damageByTreants(3, unblockable)`；运行时按当前树灵总数换算真实伤害 | L2：`treant-ability-card-contract.test.ts` 已锁定分支结算；L3：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 苦痛根系收口”，当前这条样例以 `1 幼种 + 1 木苗 + 1 神性树灵` 起手，因此样例收口结果落为 `3` 点真实伤害；这里的 `3` 只证明该样例当时的树灵总数，不是把技能主语义改写成“固定 3 点真实伤害”。关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\复仇枝蔓-II-的苦痛根系分支应从真实槽位收口到按树灵总数造成-3-点真实伤害\treant-vengeful-vines-2-pain-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\复仇枝蔓-II-的苦痛根系分支应从真实槽位收口到按树灵总数造成-3-点真实伤害\treant-vengeful-vines-2-pain-after-closeout.png` | 苦痛根系分支已补到对象级 L3 |
| 野蛮生长 II 主分支 | `C1 造成 8 点伤害并投掷 5 骰` `C2 每个树枝 +1 伤害` `C3 若投出树叶则自己获得 1 生命源泉` `C4 每个树灵养成 1 次树灵` | `WILD_GROWTH_2.variants[wild-growth-2-main]` -> `customEffect('treant-wild-growth-2-main')` + `damage(8)`；后续由 `handleWildGrowth2Main` 读取 5 颗奖励骰，分别写入 `BONUS_DAMAGE_ADDED / TOKEN_GRANTED / cultivate choice` | L2：`treant-ability-card-contract.test.ts` 已锁定主分支结算，包括“仅 1 个树灵时自动养成 1 次”“2 个树灵时弹出 2 次养成选择”“`displayOnly` 奖励骰链真实收口”等合同；L3：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 主分支收口”，当前这条样例截图使用 `randomValues=[1,4,6,6,2]`，因此样例结果落为 `10` 点伤害 + `1` 生命源泉 + `2` 次养成，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\野蛮生长-II-主路线应从真实槽位收口到-10-点伤害-+-生命源泉-+-2-次养成\treant-wild-growth-2-main-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\野蛮生长-II-主路线应从真实槽位收口到-10-点伤害-+-生命源泉-+-2-次养成\treant-wild-growth-2-main-after-closeout.png`；L4：同文件合同已显式断言 `displayOnly 5 骰 -> CHOICE_RESOLVED -> resolveAttack(...includePreDefense=false) -> SKIP_BONUS_DICE_REROLL` 后最终 `pendingBonusDiceSettlement=undefined / pendingAttack=null / pendingDamage=undefined / defenderHp=40 / self life_sap=1 / seedling=2`，这里的 `defenderHp=40` 对应的也是该样例骰面结果，而不是规则主语义被改写成“固定 10 伤害” | 主分支已补到关键 L4，整对象剩批次口径统一 |
| 乱花迷眼 | `C1 造成 4 点不可防御伤害` `C2 对手获得 1 刺藤` | `WILD_GROWTH_2.variants[wild-growth-2-dazzle]` -> `damage(4, unblockable)` + `grantToken(opponent, thorn, 1)` | L2：`treant-ability-card-contract.test.ts` 已锁定分支结算；L3：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 乱花迷眼收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\野蛮生长-II-的乱花迷眼分支应从真实槽位收口到-4-点不可防御伤害-+-1-刺藤\treant-wild-growth-2-dazzle-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\野蛮生长-II-的乱花迷眼分支应从真实槽位收口到-4-点不可防御伤害-+-1-刺藤\treant-wild-growth-2-dazzle-after-closeout.png` | 乱花迷眼分支已补到对象级 L3 |

### 2026-06-05 继续补记：Treant 剩余升级技能缺行补齐

#### 对象级矩阵

| 对象 | 规则子句 | 实现入口 / 消费链 | 当前证据 | 结论 |
| --- | --- | --- | --- | --- |
| 扎根 II | `C1 防御掷 4 骰` `C2 树枝/树灵防伤` `C3 双树叶养成 1` `C4 双树灵选择 1 名玩家获得生命源泉` | `ROOTED_2.trigger.phaseId=defensiveRoll/diceCount=4` -> `treant-rooted-defense` -> `CHOICE_REQUESTED(treant-rooted-resolve)` -> 防御收口 | L2：`src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` 已覆盖 4 骰、防伤、4 人生命源泉目标全集、伪造 choice value 拒绝，以及防御收口后的 `pendingAttack=null / pendingDamage=undefined / pendingBonusDiceSettlement.displayOnly=true / pendingBonusDiceSettlement.sourceAbilityId='rooted' / lastResolvedAttackDamage=2`；L3：`e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts` 已稳定跑通“升级扎根后进入真实防御链路”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精升级扎根后应在真实防御链路中发动4骰扎根II\03-rooted-2-before-defense-advance.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精升级扎根后应在真实防御链路中发动4骰扎根II\04-rooted-2-choice-modal-after-roll.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精升级扎根后应在真实防御链路中发动4骰扎根II\06-rooted-2-after-resolve.png` | 对象级已补到 L3，关键防御收口态已补到 L4 子句，整对象剩更高阶批次口径统一 |
| 破碎之拳 II | `C1 对手获得 1 刺藤` `C2 3/4/5 树枝分别造成 5/6/7 点伤害` | `SHATTERING_FIST_2.variants[shattering-fist-2-3/4/5]` -> `grantToken(opponent, thorn, 1)` + `damage(5/6/7)` | L2：`src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` 已锁定“施加刺藤 + 5/6/7 伤害”；L3：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 技能本体收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\破碎之拳-II-应从真实槽位收口到-7-点伤害-+-1-刺藤\treant-shattering-fist-2-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\破碎之拳-II-应从真实槽位收口到-7-点伤害-+-1-刺藤\treant-shattering-fist-2-after-closeout.png` | 对象级已补到 L3；当前对象级无新的关键 L4 缺口，剩批次级治理与旧文档统一收口 |
| 破碎之拳 III | `C1 对手获得 1 刺藤` `C2 若投出 3 个相同数字则养成 1` `C3 3/4/5 树枝分别造成 5/6/7 点伤害` | `SHATTERING_FIST_3.variants[shattering-fist-3-3/4/5]` -> `grantToken(opponent, thorn, 1)` + `treant-shattering-fist-3-cultivate` + `damage(5/6/7)` | L2：`src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` 已覆盖三同点养成 1、非三同点不弹养成、伪造不可能养成结果拒绝；2026-06-05 新增红测已进一步证明：当 `pendingAttack.attackDiceValues=[2,2,2,4,5]` 而当前活跃骰被改成非三同点时，旧实现不会弹养成，说明它曾错误读取 live `getActiveDice(state)`。现已改为读取攻击快照 helper，绿测确认“快照三同点仍弹养成、快照非三同点即使活跃骰伪造成三同点也不弹”；L3：`e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 已稳定跑通“真实槽位 -> 养成选择 -> 技能本体收口”，关键截图见 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\破碎之拳-III-应从真实槽位收口到养成-1-+-7-点伤害-+-1-刺藤\treant-shattering-fist-3-before-click.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-upgrade-direct-closeout.e2e\破碎之拳-III-应从真实槽位收口到养成-1-+-7-点伤害-+-1-刺藤\treant-shattering-fist-3-after-closeout.png` | 对象级已补到 L3，关键“攻击快照 vs 当前活跃骰”L4 子句已锁住，整对象剩更高阶批次口径统一 |

### 2026-06-05 继续补记：L4 共享链判等矩阵

> 本表基于当前代码链路检查，而不是旧 evidence 口头外推。判等标准按 `testing-audit.md` 的“共享链路仅配置不同”门禁执行：只有 handler / resolver / interaction family / 清理语义一致，且差异只剩静态配置时，才允许复用 L3/L4。

| 对象 | 共享链名称 | 代表对象 | 是否满足“仅配置不同” | 判等依据 | 当前残余 |
| --- | --- | --- | --- | --- | --- |
| 一往无前 II 主分支 | 奖励骰重投攻击加伤链 | — | 否 | 走 `createBonusDiceWithReroll + GOING_FORWARD_2_SETTLEMENT_ID`，且额外依赖“总和 `<=6` 改不可防御、`>6` 保持可防御”的阈值分层；与其他奖励骰对象不是同一收口语义 | 对象级 L3 已齐，阈值分层 L4 合同已补；剩余主要是更高阶组合分支与批次口径统一 |
| 刀尖舔血 | 单骰展示后直接真实伤害链 | — | 否 | 单骰 display-only 后直接造成真实伤害并 `nonattack closeout`；与 `毒刃 II`、`死亡盛放 II` 的后续链不同 | 已有对象级 L3，保留对象级 L4 |
| 死亡盛放 II | 奖励骰重投攻击加伤链 | — | 否 | 同样走 `createBonusDiceWithReroll`，但 settlement 读取 5 骰面具/忍刀/手里剑计数，并按 `0/1/2` 面具数量分层追加“无额外 / 不可防御 / 不可防御 + 慢性中毒” | 对象级 L3 已齐，面具数量分层 L4 合同已补；剩余主要是更高阶组合分支与批次口径统一 |
| 毒刃 II | display-only 奖励骰后继续攻击链 | — | 否 | 奖励骰只负责施加慢性中毒，攻击伤害仍走原攻击链与防御链收口，不属于 `nonattack closeout` 或 `attackBonus` 同构对象 | 已有对象级 L3，保留对象级 L4 |
| 瞬身 II | 防御重投 + 选择收口链 | — | 否 | `defensiveRoll + rollLimit=2 + rerollDieLimit=2 + ninja-blink-2` 属防御专用 family；除 UI 命中层外，还额外依赖第二次防御掷骰前“不能放行 3 颗全重掷”的共享命令校验 | 已有对象级 L3，保留对象级 L4 |
| 暗影步 II 主分支 | 标准 token + 不可防御伤害直结算链 | 诳惑 | 是 | 都不走 custom handler / 选择窗 / bonus settlement；仅通过标准 `grantToken/damage(unblockable)` 列表进入同一攻击清理管线，差异只剩 token 数量与伤害值 | 可复用标准直结算 family 的 L4，已无额外对象级差异 |
| 诳惑 | 标准 token + 不可防御伤害直结算链 | 诳惑 | 是 | 作为代表对象，已补对象级 L3，且无额外分支/清理差异 | 作为代表对象保留 |
| 影牙 II 主分支 | 标准 token + 普通伤害直结算链 | 影牙 II 主分支 | 是 | 与同类标准 effect list 共享攻击清理管线，不经过 custom handler；当前批内无更简单对象能替代其“两次 grantToken + 伤害”组合 | 作为代表对象保留 |
| 斩击 II | 直接伤害 + postDamage 快照链 | — | 否 | 额外依赖 `postDamage` 读取攻击骰快照授予忍术；不是纯标准 damage family | 已有对象级 L3，保留对象级 L4 |
| 勒杀 | 非攻击直收口链 | — | 否 | `ninja-nonattack-closeout` 无伤害直收口，且无 UI 选择窗；与 `烟雾阵 II` 主分支的 `CHOICE_RESOLVED` followup 不同 | 已有对象级 L3，保留对象级 L4 |
| 烟雾阵 II 主分支 / 九字切 | simple-choice -> choiceResolved -> nonattack closeout | — | 否 | 两个分支同属 `SMOKE_SCREEN_2` 家族，但一个是玩家+对手双目标 token 链，一个是双次真实伤害链；差异不止配置项 | 已有对象级 L3，保留对象级 L4 |
| 细心呵护 II 主分支 / 培育 | 养成选择 family | — | 否 | 一个走 `tendCareResolve(4)` 的多目标 + 养成链，一个走 `treant-tend-care-2-cultivate` 的纯养成链；不同 interaction family | 已有对象级 L3，保留对象级 L4 |
| 扎根 II | 防御选择链 | — | 否 | `defensiveRoll + treant-rooted-defense + rooted choice` 是防御 family；升级版新增 4 骰合同，不属于仅配置差异 | 已有对象级 L3，保留对象级 L4 |
| 破碎之拳 II | 标准 token + 普通伤害直结算链 | 影牙 II 主分支（仅治理层 family 参考） | 是 | 两者都不走 custom handler / 选择窗 / bonus settlement；共用标准 `grantToken + damage` 攻击清理管线，差异只剩静态伤害值与 token 数量 | 已补对象级 L3；L4 可按该直结算 family 复用 |
| 破碎之拳 III | token + 条件养成选择 + 普通伤害链 | — | 否 | 新增“三同点才弹养成”的条件 choice，且本轮已证明该条件必须读取 `pendingAttack.attackDiceValues` 快照而不是 live active dice；差异明显多于静态配置项 | 已补对象级 L3，关键快照 L4 已补，保留更高阶批次 L4 |
| 自然之触 II 主分支 / 自然之怜 | 直伤 / 多效果后养成 family | — | 否 | 主分支是标准不可防御伤害；分支是“治疗 + CP + 抽牌 + 养成 1”后 closeout，不能互相复用 | 已有对象级 L3，保留对象级 L4 |
| 复仇枝蔓 II 主分支 / 乱花迷眼 | 标准 token + 伤害直结算链 | 复仇枝蔓 II 主分支 | 是 | 两者都不走 custom handler / 选择窗 / bonus settlement；共用标准 `grantToken(opponent, thorn, 1) + damage(*)` 管线，差异仅剩伤害值与 `unblockable` 静态标记 | 可复用该标准直结算 family 的 L4 |
| 苦痛根系 | 树灵总数转直伤后 nonattack closeout | — | 否 | 读取树灵总数后造成真实伤害并 `nonattack closeout`，不是标准 attack closeout family | 已有对象级 L3，保留对象级 L4 |
| 野蛮生长 II 主分支 | display-only 5 骰后继续攻击 / 可能养成链 | — | 否 | 奖励骰展示、加伤、生命源泉与养成 choice 同时存在，family 独立 | 对象级关键 L4 已补，剩余仅是批次口径统一 |

### 2026-06-05 继续补记：斩击 II / 影牙 II family 的关键 L4 合同

- 验证命令：
  - `npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts --configLoader native --maxWorkers 1`
- 结果：
  - `ninja-ability-card-contract.test.ts`：`29 passed`

#### 本轮新增 L4 结论

| 对象 | 新补 L4 子句 | 当前证据 | 结论 |
| --- | --- | --- | --- |
| 斩击 II | `C2 若投出 3 个相同数字则获得 1 忍术` 不仅要证明“能得 1 忍术”，还要证明 **只读取攻击快照，不读取当前活跃骰面** | `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 已新增双场景合同：① `pendingAttack.attackDiceValues = [2,2,2,4,5]` 且当前活跃骰改成非三同点时，仍授予 `1` 忍术；② `pendingAttack.attackDiceValues = [1,2,3,4,5]` 且当前活跃骰伪造为三同点时，不授予忍术 | `斩击 II` 的关键 L4 已从“只有对象级 L3”推进到“共享 `postDamage` 快照合同已锁住”；剩余以批次统一口径为主 |
| 影牙 II 主分支 | `C4 造成 8 点伤害` 不能只证明最终伤害，还要证明 **先进入攻击方自己的 `beforeDamageDealt` token 响应窗，再由 `SKIP_TOKEN_RESPONSE` 收口** | `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 已新增合同：主分支生成 `TOKEN_RESPONSE_REQUESTED`，此时 `defenderHp=30 / pendingDamage.currentDamage=8 / pendingDamage.responseType='beforeDamageDealt' / responderId='0'`，随后 `SKIP_TOKEN_RESPONSE` 后才收口为 `defenderHp=22 / pendingDamage=null` | `影牙 II` 主分支的关键 L4 已从“只有对象级 L3”推进到“响应窗分流合同已锁住”；剩余以批次统一口径为主 |
| 诳惑 | `C3 造成 2 点不可防御伤害` 必须证明 **不会错误打开 token 响应窗**，而是直接以不可防御伤害收口 | `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 已新增合同：分支不生成 `TOKEN_RESPONSE_REQUESTED`，直接 `DAMAGE_DEALT(unblockable=true)`，且 `pendingDamage=null` | `诳惑` 作为“标准 token + 不可防御伤害直结算链”代表对象，其关键 L4 边界已补齐；剩余以批次统一口径为主 |

### 2026-06-05 继续补记：Treant 同批能力的快照 / 收口 L4 补审

- 验证命令：
  - `npx vitest run src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts --configLoader native --maxWorkers 1`
- 结果：
  - `treant-ability-card-contract.test.ts`：`90 passed`

#### 本轮新增 L4 结论

| 对象 | 新补 L4 子句 | 当前证据 | 结论 |
| --- | --- | --- | --- |
| 细心呵护 II / 培育 | `C1 养成 6 次后直接收口` 不能只证明“真实入口最终能结束”，还要证明 **`autoResolve(single outcome)` 与 `choiceResolved(multi outcome)` 两条路径都会显式走 nonattack closeout**，不会把攻击链错误留在 `isDefendable=true` | `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` 现已新增红绿回归：旧实现下，`培育` 分支在 `CHOICE_RESOLVED` 后仍保留 `pendingAttack.isDefendable=true`，继续 `resolveAttack(...includePreDefense=false)` 时还能错误进入防御链；修复后合同显式断言：`pendingAttack.isDefendable=false / pendingDamage=undefined`，随后 `resolveAttack` 不再生成 `ATTACK_DEFENSE_RESOLVED` 或防御骰事件，只产生 `ATTACK_RESOLVED(totalDamage=0)`。对应实现已补两处：① `handleTendCare2Cultivate` 的“无候选/单候选自动执行”路径追加 `closeoutNonAttackVariant`；② `treant-tend-care-2-cultivate` 的 `resolveCultivateOnlyChoice(..., { closeout: true })` 让多候选 `CHOICE_RESOLVED` 路径也同步收口 | 这不是单纯“补证据”，而是真实实现漏项；`培育` 分支现已从“L3 看似可玩但 L4 漏收口”推进到“nonattack closeout 双路径合同已锁住” |
| 破碎之拳 III | `C2 若投出 3 个相同数字则养成 1` 不能只证明“会弹养成”，还要证明 **只读取攻击快照，不读取当前活跃骰面** | `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` 已新增红绿对照合同：① `pendingAttack.attackDiceValues=[2,2,2,4,5]` 且当前活跃骰改成非三同点时，修复后仍会弹养成；② `pendingAttack.attackDiceValues=[1,2,3,4,5]` 且当前活跃骰伪造成三同点时，修复后不会误弹养成。对应实现已从 `getActiveDice(state)` 改为共享攻击快照 helper | `破碎之拳 III` 的关键 L4 已从“只有对象级 L3”推进到“跨阶段快照合同已锁住”；剩余以批次统一口径为主 |
| 扎根 II | `C4 双树灵选择 1 名玩家获得生命源泉` 不能只证明选择窗与血量结果，还要证明 **防御收口后攻击链确实结束，且不会残留 `pendingDamage`**；同时要区分“领域层 displayOnly 奖励骰快照仍保留”与“攻击链未收口”不是一回事 | `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` 现已显式断言：双树灵分支 resolve 后继续 `resolveAttack(...includePreDefense=false)` 收口，最终 `pendingAttack=null / pendingDamage=undefined / pendingBonusDiceSettlement.displayOnly=true / lastResolvedAttackDamage=2 / defenderHp=48` | `扎根 II` 的关键防御收口态已补到 L4 子句；剩余以更高阶 family 统一口径为主 |
| 苦痛根系 | `C1 按树灵总数造成真实伤害后直接收口` 不能机械要求“收口态一定表现成 `pendingAttack.isDefendable=false`”；必须先判定**所在 seam 的真实收口形式** | `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` 现已补 contract：`resolveAttack(...includePreDefense=true)` 后不生成 `ATTACK_DEFENSE_RESOLVED`、不生成 `TOKEN_RESPONSE_REQUESTED`、对手 HP `50 -> 47`、`pendingDamage=undefined`，且当前领域 seam 会在 `ATTACK_RESOLVED` 后直接得到 `pendingAttack=null`。这次说明旧“只盯 `isDefendable=false`”属于 seam 选错，不是新的实现 bug | `苦痛根系` 的关键 L4 已从“只证明直伤数值”推进到“收口 seam 已澄清”；后续同类 nonattack/direct closeout 不得再混淆 `pendingAttack=null` 与 `pendingAttack.isDefendable=false` 这两种合法收口态 |
| 野蛮生长 II 主分支 | `displayOnly 5 骰 + 奖励加伤 + 生命源泉 + 养成 choice` 不能只证明中间态 `bonusDamage / pendingBonusDiceSettlement.displayOnly / CHOICE_REQUESTED`，还要证明 **真实收口顺序** 是 `CHOICE_RESOLVED -> 攻击伤害落地 -> SKIP_BONUS_DICE_REROLL -> settlement 清空`，且展示态不会残留成最终权威状态 | `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` 现已新增合同：`[1,4,6,6,2]` 骰面下先得到 `pendingBonusDiceSettlement.displayOnly=true` 与 2 次养成选择；选择 `s2_a0_d0` 后继续 `resolveAttack(...includePreDefense=false)`，中间权威态为 `defenderHp=40 / life_sap=1 / seedling=2 / pendingAttack=null / pendingDamage=undefined / pendingBonusDiceSettlement.displayOnly=true`；随后经真实 `execute({ core, sys }, SKIP_BONUS_DICE_REROLL)` 收口，最终 `pendingBonusDiceSettlement=undefined`，其余权威状态保持不变 | `野蛮生长 II` 的关键 L4 已从“只有对象级 L3”推进到“displayOnly 展示链真实收口已锁住”；剩余以批次统一口径与旧文档回写为主 |

#### 本轮新增方法论回写

- 本轮再次证实：**“当前活跃态”不是跨阶段判定的真相源**。只要条件文本写的是“若投出 / 本次攻击 / 本次防御掷出”，而消费点已经跨到 `postDamage`、防御后续窗口或其他收口阶段，就必须优先读取事务快照，而不是 `getActiveDice(state)` 之类 live 状态。
- 这次不是只修 `破碎之拳 III` 单卡，而是沿同一 seam 反查了 Treant 同文件兄弟对象：
  - `细心呵护 II / 培育` 已补“auto-resolve 与 choice-resolve 两条路径都必须 closeout”的真实实现缺口；
  - `扎根 II` 已补“防御收口后的 pending 清理”证据；
  - `苦痛根系` 已补“当前 seam 的合法收口态是 `pendingAttack=null`，不是强行要求 `isDefendable=false`”的裁定；
  - `treant.ts` 内与本轮对象直接相关的“相同数字判定” seam 已收敛到共享攻击快照 helper，不再残留同类 live active dice 读取点。

### 2026-06-05 继续补记：暗影步 II / 烟雾阵 II family 的关键 L4 合同

- 验证命令：
  - `npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts --configLoader native --maxWorkers 1`
- 结果：
  - `ninja-ability-card-contract.test.ts`：`29 passed`

#### 本轮新增 L4 结论

| 对象 | 新补 L4 子句 | 当前证据 | 结论 |
| --- | --- | --- | --- |
| 勒杀 | `C4 不造成攻击伤害，直接收口` 不能只证明 `isDefendable=false`，还要证明 **不生成 `DAMAGE_DEALT`、不打开 `TOKEN_RESPONSE_REQUESTED`、不残留 `pendingDamage`** | `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 现已显式断言：`events` 中无 `DAMAGE_DEALT`、无 `TOKEN_RESPONSE_REQUESTED`，最终 `pendingDamage=null / 对手 HP 保持 30 / pendingAttack.isDefendable=false` | `ninja-nonattack-closeout` family 的首条关键 L4 已补；`勒杀` 现可作为该 nonattack family 的对象级代表证据之一 |
| 烟雾阵 II 主分支 | `C2/C3` 不能只证明 2 人局单一目标，还要证明 **4 人局完整“任一玩家 × 任一对手”目标矩阵**，且 followup 收口后无 `pendingDamage` | `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 已新增 4 人局合同：`options` 长度为 `8`，并验证“令3号玩家获得烟雾弹与3忍术；对4号玩家施加慢性中毒”可正确路由为 `P3 smoke_bomb=1 / ninjutsu=3 / P4 delayed_poison=1 / pendingDamage=null / pendingAttack.isDefendable=false` | `SMOKE_SCREEN_2` 主分支已从“只覆盖 2 人局样本”推进到“多目标矩阵 L4 已锁住”；剩余以 family 统一口径为主 |
| 九字切 | `C2/C3` 不能只证明“同一名对手两次”，还要证明 **4 人局可选两个不同对手**，且在团队模式下命中的是 **共享队伍血量合同** | `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 已新增 4 人局合同：`options` 长度为 `3`，可选“对2号与4号玩家各造成 4 点真实伤害”；followup 后 `players['1'].hp=22 / players['3'].hp=22 / teamHealth.B=22 / pendingDamage=null / pendingAttack.isDefendable=false`，证明两次真实伤害最终落在 B 队共享血量而非两个独立 HP 槽 | `九字切` 的关键 L4 已从“只有同目标二连击样本”推进到“多对手 + 团队共享血量合同已锁住”；剩余以 family 统一口径为主 |
| 烟雾阵 II family | `CHOICE_RESOLVED` followup 不能接受 forged value 越界路由 | `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts` 已新增 forged 合同：`ninja-smoke-screen-2-choice` 与 `ninja-smoke-screen-kuji-kiri-choice` 在 `value=99` 越界时都返回空事件，不会错误把效果路由到不存在的玩家/对手 | `simple-choice -> choiceResolved -> nonattack closeout` family 的越界 value 边界已补；该 family 的关键 L4 已显著收敛 |

#### 当前剩余范围

- 忍者升级技能当前残余已不再是“某个对象还没实施/没补关键 L4”，而是：
  - 批次级 `L4 共享链判等矩阵` 与最终发布口径统一
  - 旧 rule / evidence 文档里仍可能残留的过时句子继续回写
- 树精升级技能当前残余也已从“对象级高风险 family 待补”收敛为：
  - 批次级 `L4 共享链判等矩阵`、代表链复用边界与最终发布口径统一
  - 旧 Treant rule / evidence 文档里仍可能残留的过时句子继续回写
- 因此，**树精 / 忍者升级技能整批仍未达到“全面审计完成”**。但当前残余已经进一步收窄为**批次级 L4 治理口径与旧文档统一收口**，而不再是“忍者/树精还有多个对象级关键 L4 未补”。在这些批次级残余清掉前，仍不能对外表述成“已全面审计收口”。
