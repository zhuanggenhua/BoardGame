# 实施计划：大杀四方（SmashUp）全维度审计（D1-D33）

## 概述

基于 `.spec/knowledge/standards/testing-audit.md` D1-D33 全维度框架，对 SmashUp 基础版 8 派系 + 全部基地卡进行系统性审计。

**第一阶段（已完成）**：D1 文本一致性 + D3 注册覆盖静态审计。
**第二阶段（本计划）**：补全缺失的运行时行为维度（D1子项/D2/D5/D8/D11-D15/D18-D19/D24/D31/D33）。

审计方法：人工代码审查 + GameTestRunner 行为测试互补。每个维度组完成后输出独立审计报告到 `docs/audit/smashup/`。

---

## 第一阶段任务（已完成，保留记录）

- [x] 1. 审计基础设施搭建
  - [x] 1.1 创建 Wiki 描述快照数据文件（`wikiSnapshots.ts`）
  - [x] 1.2 创建审计工具函数模块（`auditUtils.ts`）
  - [x] 1.3 创建审计结果输出格式化工具
  - _Requirements: 1, 2_

- [x] 2. 核心属性测试（Property 1-3, 6, 9）
  - [x] 2.1 Property 1: 能力标签执行器全覆盖
  - [x] 2.2 Property 2: 持续效果注册覆盖
  - [x] 2.3 Property 3: 描述关键词→注册表行为一致性
  - [x] 2.4 Property 6: 交互链完整性
  - [x] 2.5 Property 9: 疯狂牌终局惩罚正确性
  - _Requirements: 1, 2_

- [x] 3. 基础版 8 派系逐卡文本审计
  - [x] 3.1 外星人（Aliens）— `docs/audit/smashup/phase1-aliens.md`
  - [x] 3.2 恐龙（Dinosaurs）— `docs/audit/smashup/phase1-dinosaurs.md`
  - [x] 3.3 忍者（Ninjas）— `docs/audit/smashup/phase1-ninjas.md`
  - [x] 3.4 海盗（Pirates）— `docs/audit/smashup/phase1-pirates.md`
  - [x] 3.5 机器人（Robots）— `docs/audit/smashup/phase1-robots.md`
  - [x] 3.6 巫师（Wizards）— `docs/audit/smashup/phase1-wizards.md`
  - [x] 3.7 丧尸（Zombies）— `docs/audit/smashup/phase1-zombies.md`
  - [x] 3.8 捣蛋鬼（Tricksters）— `docs/audit/smashup/phase1-tricksters.md`
  - _Requirements: 1, 2_

- [x] 4. 第一阶段发现汇总
  - 3 个 i18n 文本错误（已修复）
  - 2 个逻辑 bug（待修复：`trickster_pay_the_piper` 随机弃牌 vs 选择弃牌、`robot_microbot_archive` 缺少 alpha 联动）
  - 1 个边界情况（`trickster_mark_of_sleep` 目标范围）

---

## 第二阶段任务（缺失维度补全）

### 任务组 5：D1 子项 — 实体筛选范围语义审计

- [x] 5.1 grep 所有 `abilities/*.ts` 中的 `.filter(`/`.find(`/`for...of` 实体收集操作，建立筛选操作清单
- [x] 5.2 对每个筛选操作，提取对应卡牌描述中的范围限定词（位置/归属/类型/来源/排除），逐个比对
- [x] 5.3 重点审查高风险卡牌：`base_tortuga`（亚军移动范围）、`alien_crop_circles`（全基地 vs 单基地）、`pirate_full_sail`（移动目标范围）、`zombie_they_keep_coming`（弃牌堆来源范围）
- [x] 5.4 输出筛选范围审计矩阵到 `docs/audit/smashup/phase2-filter-scope.md`
- _Requirements: 3_

### 任务组 6：D5 — 交互语义完整性审计

- [x] 6.1 grep 所有 `createSimpleChoice` 调用，提取 `multi` 配置，与描述语义比对（"任意数量"/"选择一个"/"最多N个"）
- [x] 6.2 grep 所有 `grantExtraMinion`/`grantExtraAction` 调用，检查 payload 约束条件（`sameNameOnly`/`restrictToBase`/`powerMax`）与描述是否一致
- [x] 6.3 审查描述为"授予额度"语义的能力是否误用 `createSimpleChoice` 弹窗（应用 `grantExtra*`）
- [x] 6.4 审查 `targetType` 声明的卡牌，检查非目标选项（done/skip/cancel）的 UI 可达性
- [x] 6.5 跨派系比对同类型交互模式（"选随从→逐张选手牌"）的 `targetType`/`displayMode`/停止按钮 value key 一致性
- [x] 6.6 输出交互语义审计报告到 `docs/audit/smashup/phase2-interaction-semantics.md`
- _Requirements: 4_

### 任务组 7：D8 — 时序正确性审计

- [x] 7.1 grep 所有 `afterScoring`/`beforeScoring` trigger 回调，检查是否误用 `ctx.playerId` 作为卡牌 owner
- [x] 7.2 grep 所有 `onMinionPlayed`/`onCardPlayed` 回调中的计数器检查，验证是否使用 post-reduce 阈值（`=== 1` 而非 `=== 0`）
- [x] 7.3 检查 `onMinionPlayed` 回调是否使用权威计数器（`minionsPlayedPerBase`）而非派生状态（`base.minions.length`）
- [ ] 7.4 编写 GameTestRunner 行为测试 `audit-timing-triggers.test.ts`：
  - 非当前回合玩家拥有的 afterScoring trigger 是否正确触发
  - 首次打出随从的 onMinionPlayed 是否正确判定
- [x] 7.5 输出时序审计报告到 `docs/audit/smashup/phase2-timing.md`
- _Requirements: 5_

### 任务组 8：D8 子项 — 写入-消费窗口对齐审计

- [x] 8.1 画出 SmashUp 完整阶段时间线，标注每个临时状态的写入时机、消费窗口、清理时机
- [x] 8.2 检查所有 `grantExtraMinion`/`grantExtraAction` 的写入时机是否在 playCards 阶段消费窗口之前或之内
- [x] 8.3 重点检查基地能力（`base_homeworld`、`base_secret_grove` 等）的额度授予时机
- [x] 8.4 输出写入-消费窗口审计报告到 `docs/audit/smashup/phase2-write-consume.md`
- _Requirements: 6_

### 任务组 9：D11/D12/D13 — 额度写入-消耗对称性审计

- [x] 9.1 追踪 `LIMIT_MODIFIED` 事件从 payload → reducer case → 写入字段的完整链路
- [x] 9.2 追踪 `PLAY_MINION`/`PLAY_ACTION` 在 reducer 中的消耗分支，验证消耗条件与写入条件对称
- [x] 9.3 验证 `baseLimitedMinionQuota` 和 `minionLimit` 并存时的消耗优先级
- [x] 9.4 检查 `HAND_SHUFFLED_INTO_DECK` 等复用事件类型的操作范围是否与所有调用方 payload 语义对齐
- [ ] 9.5 编写 GameTestRunner 行为测试 `audit-quota-symmetry.test.ts`：
  - 只有基地限定额度时消耗正确
  - 基地限定额度与全局额度并存时消耗优先级正确
  - 基地限定额度消耗后不影响全局额度剩余量
- [x] 9.6 输出额度审计报告到 `docs/audit/smashup/phase2-quota.md`
- _Requirements: 7_

### 任务组 10：D14 — 回合清理完整性审计

- [x] 10.1 列出所有在回合中被写入的临时字段（`minionsPlayed`/`actionsPlayed`/`baseLimitedMinionQuota`/`extraMinionPowerMax`/`sameNameMinionRemaining` 等）
- [x] 10.2 验证每个临时字段在 `TURN_STARTED` 或 `TURN_ENDED` 中有对应的清理/重置
- [ ] 10.3 编写 GameTestRunner 行为测试 `audit-turn-cleanup.test.ts`：回合 1 授予额外额度 → 回合 2 验证额度已清零
- _Requirements: 8_

### 任务组 11：D15 — UI 状态同步审计

- [x] 11.1 检查 Board.tsx 中"剩余随从次数"的计算是否聚合了所有额度来源
- [x] 11.2 检查 `deployableBaseIndices` 的计算是否根据 `playConstraint`/`restrictToBase` 等约束正确过滤
- [x] 11.3 检查力量指示物（`powerModifier`）的 UI 渲染条件是否直接读取 reducer 写入的字段
- [x] 11.4 输出 UI 同步审计报告到 `docs/audit/smashup/phase2-ui-sync.md`
- _Requirements: 9_

### 任务组 12：D18/D19 — 否定路径与组合场景审计

- [x] 12.1 编写 GameTestRunner 否定路径测试 `audit-negation-combination.test.ts`：
  - 基地限定额度消耗后 `minionsPlayed` 不变
  - 正常额度消耗后 `baseLimitedMinionQuota` 不变
  - 在非限定基地打随从不消耗基地限定额度
- [x] 12.2 编写组合场景测试：
  - 母星（全局 minionLimit+1, 力量≤2）+ 神秘花园（baseLimitedMinionQuota+1）同时生效
  - 两个不同派系的 ongoing trigger 在同一时机触发
- _Requirements: 10_

### 任务组 13：D31 — 效果拦截路径完整性审计

- [x] 13.1 列出所有调用 `filterProtectedMinionDestroyEvents`/`filterProtectedMinionMoveEvents` 的位置
- [x] 13.2 列出所有产生 `MINION_DESTROYED`/`MINION_MOVED` 事件的路径（直接命令/交互解决/trigger 回调/基地能力/计分清场）
- [x] 13.3 比对两个清单，标记未调用过滤函数的事件产生路径
- [ ] 13.4 编写 GameTestRunner 行为测试 `audit-protection-paths.test.ts`：受保护随从在所有消灭路径下均不被消灭
- [x] 13.5 输出拦截路径审计报告到 `docs/audit/smashup/phase2-protection-paths.md`
- _Requirements: 11_

### 任务组 14：D33 — 跨派系同类能力实现路径一致性审计

- [x] 14.1 按能力类型分组：消灭随从/抽牌/移动随从/力量修正/额外出牌/弃牌堆回收/返回手牌/打出限制
- [x] 14.2 对每组内所有卡牌的实现路径进行比对：事件类型 | 注册模式 | 副作用处理
- [x] 14.3 标记不合理差异为 ⚠️ 待修复
- [x] 14.4 输出跨派系一致性审计报告到 `docs/audit/smashup/phase2-cross-faction.md`
- _Requirements: 12_

### 任务组 15：D24 — Handler 共返状态一致性审计

- [x] 15.1 grep 所有 handler 中同时包含非空 `events` 数组和 `queueInteraction` 的 return 语句
- [x] 15.2 追踪返回的 events 会改变 `state.core` 的哪些字段，以及新 interaction 的选项从哪个字段构建
- [x] 15.3 标记选项数据来源字段被 events 影响且选项构建未考虑 events 效果的情况
- [x] 15.4 重点检查丧尸派系的"弃牌后从弃牌堆选"模式
- [x] 15.5 输出共返状态审计报告到 `docs/audit/smashup/phase2-handler-coreturn.md`
- _Requirements: 13_

### 任务组 16：D2 子项 — 打出约束与额度授予约束审计

- [x] 16.1 grep 所有 ongoing 行动卡的 i18n effectText，匹配条件性打出描述，检查对应 `ActionCardDef` 是否有 `playConstraint` 字段
- [x] 16.2 检查 `commands.ts` 中 ongoing 行动卡验证逻辑是否检查 `def.playConstraint`
- [x] 16.3 检查 `Board.tsx` 的 `deployableBaseIndices` 计算是否根据 `playConstraint` 过滤不可选基地
- [x] 16.4 检查所有 `grantExtraMinion` 调用点，交叉对比卡牌描述中的约束条件与 payload 完整性
- [x] 16.5 输出打出约束审计报告到 `docs/audit/smashup/phase2-play-constraints.md`
- _Requirements: 14_

---

## 第二阶段汇总任务

- [x] 17. 汇总所有第二阶段审计发现
  - [x] 17.1 合并所有维度审计报告中的 ❌/⚠️ 项
  - [x] 17.2 按严重程度排序（❌ 逻辑错误 > ⚠️ 不一致 > 💡 改进建议）
  - [x] 17.3 输出第二阶段汇总报告到 `docs/audit/smashup/phase2-summary.md`
  - [x] 17.4 将确认后的修复项转为独立 spec 或直接修复
    - ✅ #1 吹笛人的代价：第一阶段已修复
    - ✅ #2 微型机存储者 alpha 联动：已修复 `robots.ts` registerTrigger
    - ✅ #3 沉睡印记只选对手：确认正确，无需修改
    - ✅ #4 TURN_STARTED 清理：代码已包含 `baseLimitedSameNameRequired: undefined`
    - ✅ #5 闪电攻击选项刷新：已有 `optionsGenerator` 自动刷新