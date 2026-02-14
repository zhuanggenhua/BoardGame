# 审计 4.1：复活死灵（revive_undead）

## 第零步：锁定权威描述

**来源**：`public/locales/zh-CN/game-summonerwars.json` → `abilities.revive_undead.description`
> 每回合一次，在你的召唤阶段，你可以对本单位造成2点伤害，以从你的弃牌堆中拿取一张亡灵单位并且放置到本单位相邻的区格。

**补充来源**：`src/games/summonerwars/rule/召唤师战争规则.md`
- 相邻性：共享一条边，对角线不算相邻
- 弃置规则：被摧毁的卡牌进入弃牌堆
- 亡灵判定：阵营为 necromancer 的单位

## 第一步：拆分独立交互链

### 交互链 A：复活死灵主流程（多步交互）

**触发条件**：召唤阶段，玩家主动激活，弃牌堆有亡灵单位
**原子步骤**：
1. 「每回合一次」→ usesPerTurn: 1，abilityUsageCount 追踪
2. 「在你的召唤阶段」→ requiredPhase: 'summon'
3. 「你可以」→ 玩家主动激活（点击召唤师触发），非自动执行 ✅
4. 「对本单位造成2点伤害」→ 发射 UNIT_DAMAGED(position=召唤师, damage=2, reason='revive_undead')
5. 「从你的弃牌堆中拿取一张亡灵单位」→ 弹出 CardSelectorOverlay，过滤亡灵单位
6. 「放置到本单位相邻的区格」→ 高亮召唤师相邻空格，玩家选择位置
7. 「放置」→ 发射 UNIT_SUMMONED(fromDiscard=true)，reduce 从弃牌堆移除卡牌并放置到棋盘

### 自检

| 原文片段 | 覆盖链 |
|----------|--------|
| 每回合一次 | A-1 |
| 在你的召唤阶段 | A-2 |
| 你可以 | A-3 |
| 对本单位造成2点伤害 | A-4 |
| 从你的弃牌堆中拿取一张亡灵单位 | A-5 |
| 放置到本单位相邻的区格 | A-6, A-7 |

✅ 原文每句话均被覆盖。

## 第二步：八层链路检查

### 交互链 A：复活死灵主流程

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `abilities.ts` L274-349: id='revive_undead', trigger='activated', usesPerTurn=1, requiredPhase='summon', interactionChain 定义两步（selectCard→selectPosition），customValidator 检查亡灵判定+相邻+空格 |
| 注册层 | ✅ | `executors/necromancer.ts` L14: `abilityExecutorRegistry.register('revive_undead', ...)` 已注册，payloadContract: { required: ['targetCardId', 'targetPosition'] } |
| 执行层 | ✅ | `executors/necromancer.ts` L14-38: 先发射 UNIT_DAMAGED(damage=2, reason='revive_undead')，再从弃牌堆查找卡牌并发射 UNIT_SUMMONED(fromDiscard=true)。`execute/abilities.ts` 在执行器前发射 ABILITY_TRIGGERED 用于 usageCount 追踪。**限定条件全程约束**：亡灵判定在 customValidator 中检查（isUndeadCard），相邻+空格也在 customValidator 中检查 ✅ |
| 状态层 | ✅ | `reduce.ts`: UNIT_DAMAGED → 增加 damage 标记；UNIT_SUMMONED(fromDiscard=true) → 从弃牌堆移除卡牌 + 放置到棋盘；ABILITY_TRIGGERED → 增加 abilityUsageCount。`postProcessDeathChecks` 自动处理自伤致死场景 |
| 验证层 | ✅ | `abilityValidation.ts`: 通用验证（单位存在、所有权、技能拥有、阶段、使用次数）→ customValidator（targetCardId 存在、卡牌在弃牌堆、isUndeadCard、相邻、空格）。`abilityHelpers.ts` canActivateAbility 中有快速检查（弃牌堆有亡灵单位） |
| UI层 | ✅（已修复） | `useCellInteraction.ts`: 召唤阶段点击召唤师→检查 revive_undead 技能→检查弃牌堆有亡灵→进入 selectCard 步骤。`Board.tsx` CardSelectorOverlay 显示弃牌堆亡灵单位（**已修复为使用 isUndeadCard**）。`StatusBanners.tsx` 显示两步提示（selectCard/selectPosition）。取消按钮可退出 |
| i18n层 | ✅ | zh-CN 和 en 均有完整条目：abilities.revive_undead.name/description、cardSelector.reviveUndead、statusBanners.ability.reviveUndead.selectCard/selectPosition、abilityButtons.reviveUndead |
| 测试层 | ✅ | `abilities-necromancer-execute.test.ts`: 正向测试（自伤2+召唤+状态验证）+ 负向测试（弃牌堆无亡灵时验证拒绝）。`abilities-advanced.test.ts`: 完整流程测试（命令→事件→状态变更全链路）。`validate.test.ts`: 单位不存在/非己方/无技能的验证拒绝 |

## 第三步：grep 消费点

`revive_undead` 出现在以下文件中：
- ✅ `domain/abilities.ts` — 定义层
- ✅ `domain/executors/necromancer.ts` — 执行层
- ✅ `domain/abilityHelpers.ts` — 可用性检查
- ✅ `ui/useCellInteraction.ts` — UI 交互入口
- ✅ `ui/useGameEvents.ts` — 阶段切换时清除 abilityMode
- ✅ `ui/StatusBanners.tsx` — 状态提示
- ✅ `Board.tsx` — CardSelectorOverlay
- ✅ `audio.config.ts` — 音效映射
- ✅ `config/factions/necromancer.ts` — 召唤师卡牌定义
- ✅ `tutorial.ts` — 教学步骤
- ✅ `__tests__/` — 多个测试文件

无消费层缺失。

## 第四步：交叉影响检查

1. **自伤致死**：如果召唤师已有 10+ 伤害（life=12），自伤2点会导致召唤师死亡。`postProcessDeathChecks` 会自动生成 UNIT_DESTROYED 事件，游戏结束。✅ 正确行为
2. **不屈不挠（GOBLIN_RELENTLESS）**：复活的单位是从弃牌堆召唤，不涉及不屈不挠
3. **交缠颂歌**：如果召唤师被交缠，复活死灵技能仍然是基础技能，不受影响
4. **葬火（NECRO_FUNERAL_PYRE）**：自伤不触发葬火（葬火监听 UNIT_DESTROYED，不是 UNIT_DAMAGED）

## 第五步：数据查询一致性

- `useCellInteraction.ts` L524: `getUnitAbilities(clickedUnit, core)` ✅ 走统一入口
- `Board.tsx` CardSelectorOverlay 过滤: **已修复为 `isUndeadCard(c)`** ✅

## 发现与修复

| # | 严重度 | 描述 | 位置 | 修复 |
|---|--------|------|------|------|
| 1 | low | Board.tsx CardSelectorOverlay 中 revive_undead 的亡灵过滤使用内联字符串匹配而非 `isUndeadCard()` 工具函数 | Board.tsx L889 | ✅ 已修复：导入 `isUndeadCard` 并替换内联过滤 |

## 审计反模式检查

| # | 反模式 | 检查结果 |
|---|--------|----------|
| 1 | "可以/可选"效果自动执行 | ✅ 玩家主动点击召唤师触发，有 CardSelectorOverlay 选卡 + 位置选择，可取消 |
| 2 | 测试只断言事件发射 | ✅ 测试同时断言事件 + 最终状态（damage、board unit、discard） |
| 3 | `as any` 绕过类型检查 | ⚠️ 测试中 `(e.payload as any).reason` — 仅在测试断言中使用，不影响生产代码 |
| 4 | 测试层标 ✅ 但只有事件断言 | ✅ 测试覆盖命令→事件→状态变更全链路 |
| 5 | 消费点绕过统一查询入口 | ✅ 已修复 Board.tsx 内联过滤 |
| 6 | 对其他单位的技能查询 | N/A（revive_undead 不查询其他单位技能） |
| 7 | 纵向通过就判定已实现 | ✅ 已做横向一致性检查 |
| 8 | 限定条件使用不携带约束的全局机制 | ✅ 亡灵判定在 customValidator 中全程约束 |
| 9 | UI 层直接读底层字段 | ✅ 已修复 Board.tsx |

## 结论

复活死灵（revive_undead）实现与权威描述完全一致。八层链路全部通过。发现并修复了1个低严重度代码质量问题（Board.tsx 内联过滤→isUndeadCard）。857个测试全部通过，无回归。
