# Smash Up Samurai 审计（2026-03-30）

## 审计定位
- 本文档是 `Oops, You Did It Again` 四派系逐派系审计的第 4 轮，覆盖 `Samurai`。
- 本轮重点审计：自毁换杀、额外出牌奖励、按回合号生效的离场追踪、附着离场触发与基地决斗衍生效果。

## 审计范围
- 派系数据定义：`src/games/smashup/data/factions/samurai.ts`
- 派系能力实现：`src/games/smashup/abilities/samurai.ts`
- 相关回归：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `src/games/smashup/__tests__/newBaseAbilities.test.ts`
  - `e2e/smashup/smashup-phase-transition-simple.e2e.ts`

## 规则依据
- `https://smashup.fandom.com/wiki/Samurai`
- `https://smashup.fandom.com/wiki/Way_of_the_Warrior`
- `https://smashup.fandom.com/wiki/Yokai_Attack!`
- `https://www.alderac.com/smash-up-faq/`

## 本轮已确认规则结论

### 结论 1：`Yokai Attack!` 是 “you may”，而且只有真的消灭成功才给额外额度
- 规则语义不是“必选一只己方随从送掉”。
- 额外随从/行动机会应建立在“所选己方随从确实被消灭”这个事实之上。
- 因此：
  - 可以跳过；
  - 如果选中的是不能被消灭的己方随从，也不应给额外额度。

### 结论 2：`Way of the Warrior` 的抽牌只在“本回合进入弃牌堆”时成立
- 打出时先给目标 `+3`。
- 之后只有当该目标在同一回合从场上进入弃牌堆，才抽 `1`。
- 若被替代去向改放到其他区域，例如：
  - `base_tar_pits` 改放牌库底；
  - `base_temple_of_goju_pod` 的特殊去向；
  则不应误抽。

### 结论 3：`Final Haiku` 不应把刚离场的宿主自己也算进加成
- 触发条件是附着宿主离场。
- 受益对象是“你的其他随从直到回合结束 +2”。
- 因此宿主离场后不能被再次计入 `+2` 目标。

## 本轮新增已确认修复

### 修复 1：`Yokai Attack!` 改为可跳过
- 现在 prompt 会提供显式跳过项。
- 不再把“可选收益”做成强制代价。

### 修复 2：`Yokai Attack!` 的额外额度改为只在真实消灭后发放
- 当前链路改为依赖 `onMinionDestroyed` 触发：
  - `ctx.reason === 'samurai_yokai_attack'`
  - `ctx.destroyerId` 为发动者
- 只有命中真实 `MINION_DESTROYED` 后，才发 `grantExtraMinion` 与 `grantExtraAction`。

### 修复 3：`Way of the Warrior` 改为按回合号追踪“本回合进入弃牌堆”
- 打出时除了 `+3`，还会写入：
  - `samuraiWayOfTheWarriorDrawUntilTurnNumber`
  - `samuraiWayOfTheWarriorDrawPlayerId`
- 后续只有当目标在相同回合号进入弃牌堆时，才抽牌。
- 基地计分弃置也支持，因为 `onMinionDiscardedFromBase` 也已接入同一 trigger。

### 修复 4：`Way of the Warrior` 排除替代去向误抽
- 现已显式排除：
  - `base_tar_pits` 首次离场改放牌库底；
  - `base_temple_of_goju_pod` 的非弃牌堆去向。
- 不再把“离场但没进弃牌堆”误当成抽牌条件成立。

### 修复 5：`Final Haiku` 排除宿主自己
- trigger 构造 `+2` 列表时，已显式过滤 `ctx.triggerMinionUid`。
- 不再出现宿主离场后自己还被发临时力量的错算。

## 回归覆盖
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `samurai_yokai_attack 会消灭己方一个随从并给予额外随从与行动额度`
  - `samurai_yokai_attack 可以跳过而不消灭己方随从`
  - `samurai_yokai_attack 选择不能被消灭的己方随从时不会给额外额度`
  - `samurai_way_of_the_warrior 会让目标本回合进入弃牌堆时抽一张牌`
  - `samurai_way_of_the_warrior 在目标因基地结算进入弃牌堆时也会抽一张牌`
  - `samurai_way_of_the_warrior 在焦油坑把目标改放牌库底时不会抽牌`
  - `samurai_final_haiku 在附着随从离场后给你的随从直到回合结束 +2 力量`
- `src/games/smashup/__tests__/newBaseAbilities.test.ts`
  - `base_shoguns_palace 在本回合首次打出随从到这里后给出决斗提示并让胜者抓两张`
  - `base_shoguns_palace 平局时双方各抓两张牌`
- 浏览器链路：
  - `e2e/smashup/smashup-phase-transition-simple.e2e.ts`
  - `Oops Samurai 额外出牌效果应在浏览器中兑现额外随从与行动额度`

## 本轮验证
- 领域回归：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts --config temp/smashup/vitest-smashup-node.config.ts --configLoader native`
  - 结果：`2 passed`，`138 passed, 1 skipped`
- 浏览器 E2E：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "Oops Samurai 额外出牌效果应在浏览器中兑现额外随从与行动额度"`
  - 结果：`1 passed`

## 审计收口结论
- 本轮已覆盖 Samurai 当前高风险链路：
  - `optional destroy cost`
  - `destroy-success gating`
  - `same-turn discard tracking`
  - `replacement-destination exclusion`
  - `attached-host leave-play filtering`
- 当前未再发现新的高优先级规则偏差。

## 当前状态
- 状态：`Samurai 已完成首轮审计收口`
- 下一步：进入四派系统一汇总审计。
