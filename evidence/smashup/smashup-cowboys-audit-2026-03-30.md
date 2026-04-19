# Smash Up Cowboys 审计（2026-03-30）

## 审计定位
- 本文档是 `Oops, You Did It Again` 四派系逐派系审计的第 3 轮，覆盖 `Cowboys`。
- 本轮重点审计：决斗、额外打牌、牌库顶查看与排序、临时保护、移动类效果、被展示/翻开的特例触发与基地能力。

## 审计范围
- 派系数据定义：`src/games/smashup/data/factions/cowboys.ts`
- 派系能力实现：`src/games/smashup/abilities/cowboys.ts`
- 共享链路：
  - `src/games/smashup/domain/duel.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/domain/reactionQueue.ts`
  - `src/games/smashup/domain/reactionQueueHandlers.ts`
  - `src/games/smashup/domain/types.ts`
- 相关回归：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `src/games/smashup/__tests__/newBaseAbilities.test.ts`
  - `e2e/smashup/smashup-phase-transition-simple.e2e.ts`

## 规则依据
- `https://smashup.fandom.com/wiki/Cowboys`
- `https://smashup.fandom.com/wiki/Stagecoach`
- `https://smashup.fandom.com/wiki/Dynamite_Surprise`
- `https://www.alderac.com/smash-up-faq/`

## 本轮已确认规则结论

### 结论 1：`Gold in Them Thar Hills` 不是“固定抽一张再给额度”
- 规则与 FAQ 要求：
  - 查看自己牌库顶三张；
  - 选择其中一张抓到手里；
  - 你可以立刻把它作为额外牌打出；
  - 其余牌以你选择的顺序放回牌库顶。
- 旧实现的问题：
  - 没有“抓到手里 / 立刻额外打出”的分支；
  - 剩余牌顺序固定，不能由玩家决定；
  - 行为退化成“抽一张 + 送额外额度”。

### 结论 2：`Form a Posse` 作用于你所有随从，不是局部选择
- FAQ 明确说明它会同时增强并保护你全部随从。
- 现在已按规则改回：
  - 你所有随从本回合 `+1`；
  - 你所有随从本回合内不能被消灭、移动或返回手牌。

### 结论 3：`High Noon` 的额外随从额度绑的是赢家当前基地
- FAQ 明确：若赢家在决斗过程中被移动，额外随从要下在赢家当前所在基地。
- 共享决斗结算现已按赢家当前所在基地写入 `restrictToBase`。

### 结论 4：`Stagecoach` 的“move one or two of your cards”不只包含随从
- FAQ 已明确命中四类对象：
  - 你的随从；
  - 你的泰坦；
  - 你基地上的 `play-on-a-base` 持续行动；
  - 你的埋葬牌。
- 因此仅支持“移动己方随从”的 MVP 版本不符合官方语义。

### 结论 5：`Dynamite Surprise` 还有“在手牌被展示 / 在牌库顶被翻开时可打出”的额外入口
- 该入口不等同于普通 `beforeScoring` special。
- FAQ 还明确区分了 `reveal` 与 `look`：
  - 被另一位玩家展示/翻开时可触发；
  - 只是被看见但没 `reveal` 时不触发。

## 本轮新增已确认修复

### 修复 1：`Gold in Them Thar Hills` 补齐“抓牌 / 额外打出 / 余牌排序”
- 现在流程为：
  - 先看牌库顶三张；
  - 选中目标牌；
  - 若剩余牌超过一张，先选放回牌库顶顺序；
  - 再决定“抓到手里”还是“作为额外牌打出”；
  - 若额外打出的牌需要基地/随从目标，会补对应选择交互。

### 修复 2：`Form a Posse` 改为全体增益 + 全体临时保护
- 它会对你当前全部随从同时产生：
  - `+1` 临时力量；
  - 本回合内的 destroy / move / affect 保护。
- 保护落在共享 `isMinionProtected` 查询链路，使用按回合号自动失效的 metadata。

### 修复 3：`High Noon` 的基地限定额度跟随赢家当前位置
- 额外随从额度不再固定绑死在决斗开始基地。
- 共享决斗结算已改为按赢家当前基地写入。

### 修复 4：`Stagecoach` 补齐泰坦 / 基地持续行动 / 埋葬牌迁移
- 现在可从同一基地搬运：
  - 你控制的随从；
  - 你控制且位于基地上的泰坦；
  - 你基地上的持续行动；
  - 你控制的埋葬牌。
- 当前实现策略：
  - 随从继续走既有 `MINION_MOVED`；
  - 泰坦走 `TITAN_MOVED`；
  - 基地持续行动和埋葬牌在 `cowboys.ts` 中按源基地/目标基地重建 `ongoingActions` 与 `buriedCards`。

### 修复 5：`Dynamite Surprise` 补齐“被展示 / 被翻开”入口
- 保留原本的 `beforeScoring` special。
- 额外新增：
  - 当这张牌在你的手牌被另一位玩家展示时，可直接打出；
  - 当这张牌在你的牌库顶被另一位玩家翻开时，也可直接打出。
- 为此扩展了 inspection/reveal 上下文共享链路：
  - `TriggerContext` / `TriggerInstance` 新增 `inspectionCards / inspectionZone / inspectionTargetPlayerIds / inspectionCausePlayerId`
  - `processDeckInspectionTriggers` 开始同时处理 `REVEAL_HAND`
  - global trigger 区域从固定 `hand/discard` 扩成可配置 `globalZones`
- 触发后的 UI 语义：
  - 持有者可选择跳过；
  - 或直接指定来源玩家一个力量 `4` 或以下随从；
  - 该牌随后进入弃牌堆并消灭目标。

## 回归覆盖
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `cowboys_gold_in_them_thar_hills 可把所选牌抓到手里，并让其余牌按所选顺序回到牌库顶`
  - `cowboys_gold_in_them_thar_hills 选择额外随从时会先选基地再直接打出`
  - `cowboys_form_a_posse 会让你的所有随从本回合 +1 且受保护`
  - `cowboys_stagecoach 可把同一基地上至多两个己方随从移动到另一个基地`
  - `cowboys_stagecoach 也可搬运基地上的持续行动和埋葬牌`
  - `cowboys_stagecoach 也可搬运你控制的泰坦`
  - `cowboys_dynamite_surprise 在你的手牌被另一位玩家展示时可以直接打出`
  - `cowboys_dynamite_surprise 在你的牌库顶被另一位玩家翻开时也可以直接打出`
- `src/games/smashup/__tests__/newBaseAbilities.test.ts`
  - `base_so_so_corral 在打出随从后给出决斗提示并按结果消灭失败者`
- 浏览器链路：
  - `e2e/smashup/smashup-phase-transition-simple.e2e.ts`
  - `Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算`

## 本轮验证
- 领域回归：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts --config temp/smashup/vitest-smashup-node.config.ts --configLoader native`
  - 结果：`2 passed`，`138 passed, 1 skipped`
- 浏览器 E2E：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"`
  - 结果：`1 passed`

## 审计收口结论
- 本轮已覆盖 Cowboys 当前最容易出偏差的共享链路：
  - `duel outcome / extra play timing / deck reorder symmetry / temporary protection`
  - `mixed card movement`
  - `inspection-based special trigger`
- 原先识别出的两项高优先级缺口已收口：
  - `Stagecoach` 不再只限随从；
  - `Dynamite Surprise` 不再遗漏 reveal 入口。
- 当前未再发现新的高优先级规则偏差。

## 当前状态
- 状态：`Cowboys 已完成首轮审计收口`
- 下一步：进入 `Samurai` 审计。
