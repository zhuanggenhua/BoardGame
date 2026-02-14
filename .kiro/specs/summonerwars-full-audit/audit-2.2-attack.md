# 审计 2.2：攻击机制八层链路矩阵

## 权威描述（来自 `rule/召唤师战争规则.md`）

> 用最多3个你控制的不同单位进行攻击。
> - 近战单位 (⚔️)：可以攻击相邻的卡牌
> - 远程单位 (🏹)：可以攻击最多3格直线距离内的卡牌
>   - 遮挡规则：远程攻击路径上的中间格子不能有任何卡牌
>   - 护城墙例外：友方护城墙允许友方远程攻击穿过
> - 掷出等于攻击单位力量值的骰子数量
> - 每个匹配符号 = 1点伤害
> - 不活动惩罚：攻击阶段结束时未指定任何敌方卡牌 → 召唤师受1点伤害

## 独立交互链拆分

### 链1：近战攻击
- 触发：攻击阶段，玩家选择近战单位和相邻敌方目标
- 原子步骤：
  1. 宣告攻击者和目标 → validate 检查阶段、单位归属、hasAttacked、attackCount
  2. 检查近战相邻（曼哈顿距离=1）→ `canAttackEnhanced` 检查 `distance === 1`
  3. 掷骰（力量值个骰子）→ `rollDice(effectiveStrength)`
  4. 计算命中（匹配符号数）→ `countHits(diceResults, 'melee')`
  5. 添加伤害 → `UNIT_DAMAGED` 事件
  6. 检查摧毁 → `emitDestroyWithTriggers`
  7. 标记 hasAttacked + 增加 attackCount → `UNIT_ATTACKED` reducer

### 链2：远程攻击
- 触发：攻击阶段，玩家选择远程单位和直线距离内敌方目标
- 原子步骤：
  1. 宣告攻击者和目标 → validate 检查
  2. 检查远程范围（≤3格直线）→ `distance > range || !isInStraightLine`
  3. 检查路径遮挡 → `isRangedPathClear`（中间格有单位=遮挡，有建筑=遮挡，友方护城墙=穿透）
  4. 掷骰 → `rollDice(effectiveStrength)`
  5. 计算命中 → `countHits(diceResults, 'ranged')`
  6. 添加伤害 → `UNIT_DAMAGED`
  7. 检查摧毁 → `emitDestroyWithTriggers`

### 链3：不活动惩罚
- 触发：攻击阶段结束时，`hasAttackedEnemy === false`
- 原子步骤：
  1. 检查本回合是否攻击过敌方 → `player.hasAttackedEnemy`
  2. 未攻击 → 召唤师受1点伤害 → `UNIT_DAMAGED { reason: 'inaction' }`

### 链4：攻击次数限制
- 触发：每次攻击时
- 原子步骤：
  1. 检查 attackCount < 3 → validate 拒绝超限
  2. 凶残单位绕过限制 → `hasFerocity` 检查
  3. 额外攻击不计入限制 → `extraAttacks > 0` 检查
  4. 每单位每回合攻击一次 → `hasAttacked` 标记

## 自检：原文覆盖完整性 ✅
- "最多3个不同单位" → 链4 ✅
- "近战相邻" → 链1 ✅
- "远程3格直线+遮挡+护城墙" → 链2 ✅
- "掷骰=力量值" → 链1/2 步骤3 ✅
- "匹配符号=伤害" → 链1/2 步骤4 ✅
- "不活动惩罚" → 链3 ✅

## 八层链路矩阵

### 链1+2：攻击机制（近战+远程）

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `canAttack`/`canAttackEnhanced` 正确区分近战(distance=1)和远程(≤3格直线+遮挡) |
| 注册层 | ✅ | 攻击不是技能，无需注册到 abilityRegistry。`canAttackEnhanced` 被 validate/execute 正确引用 |
| 执行层 | ✅ | `execute.ts` DECLARE_ATTACK：rollDice → countHits → UNIT_DAMAGED → emitDestroyWithTriggers。限定条件全程约束 |
| 状态层 | ✅ | `reduce.ts` UNIT_ATTACKED：标记 hasAttacked=true、attackCount+1、hasAttackedEnemy。UNIT_DAMAGED：damage 累加 |
| 验证层 | ✅ | `validate.ts`：检查阶段=attack、单位归属、hasAttacked、attackCount≤3（ferocity/extraAttacks 例外）、canAttackEnhanced、守卫强制 |
| UI层 | ✅ | `useCellInteraction.ts` 使用 `getValidAttackTargetsEnhanced` 高亮合法目标 |
| i18n层 | ✅ | 攻击相关错误信息已中文化（"不是攻击阶段"、"已攻击"、"攻击次数已用完"等） |
| 测试层 | ✅ | `ranged-blocking.test.ts`(16测试)覆盖遮挡/护城墙穿透；`validate.test.ts` 覆盖攻击验证；`flow.test.ts` 覆盖攻击流程+不活动惩罚 |

### 链3：不活动惩罚

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | 规则："攻击阶段结束时未指定任何敌方卡牌 → 召唤师受1点伤害" |
| 注册层 | N/A | 不是技能，无需注册 |
| 执行层 | ⚠️ | **双重实现**：`flowHooks.ts` onPhaseExit 和 `execute.ts` END_PHASE 都实现了不活动惩罚。实际运行时 UI 使用 `FLOW_COMMANDS.ADVANCE_PHASE`（走 flowHooks 路径），`SW_COMMANDS.END_PHASE` 仅在测试中使用。不会导致双重惩罚，但属于代码冗余 |
| 状态层 | ✅ | `reduce.ts` UNIT_DAMAGED 正确累加伤害；TURN_CHANGED 重置 hasAttackedEnemy |
| 验证层 | ✅ | `hasAttackedEnemy` 仅在攻击敌方时设为 true（治疗攻击友方不计入） |
| UI层 | ✅ | 无需特殊 UI |
| i18n层 | ✅ | 无需特殊文案 |
| 测试层 | ✅ | `flowHooks.test.ts` 覆盖3个场景（未攻击→惩罚、已攻击→无惩罚、无召唤师→无惩罚）；`flow.test.ts` 集成测试覆盖 |

### 链4：攻击次数限制

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `MAX_ATTACKS_PER_TURN = 3` |
| 注册层 | N/A | 常量，无需注册 |
| 执行层 | ✅ | `UNIT_ATTACKED` reducer 正确递增 attackCount（额外攻击不递增） |
| 状态层 | ✅ | `attackCount` 在 TURN_CHANGED 时重置为0 |
| 验证层 | ✅ | validate 检查 `attackCount >= 3` 时拒绝（ferocity/extraAttacks 例外） |
| UI层 | ✅ | `hasAvailableActions` 正确检查 normalAttackAvailable/ferocityAvailable/extraAttackAvailable |
| i18n层 | ✅ | "本回合攻击次数已用完" |
| 测试层 | ✅ | `validate.test.ts` 覆盖攻击次数限制和凶残绕过 |

## 发现的问题

### 问题1：不活动惩罚双重实现（低严重度）
- **严重度**: low
- **类别**: code_quality
- **位置**: `execute.ts:707-720` 和 `flowHooks.ts:120-133`
- **描述**: 不活动惩罚在两处实现：`flowHooks.ts` 的 `onPhaseExit`（UI 实际使用的 ADVANCE_PHASE 路径）和 `execute.ts` 的 `END_PHASE` 命令处理（仅测试使用）。不会导致双重惩罚，但属于代码冗余。
- **修复方案**: 保持现状。`execute.ts` 的 END_PHASE 路径被测试使用，移除会破坏测试。两条路径行为一致，不影响正确性。

### 总结
攻击机制实现与规则文档完全一致，无 critical/high 问题。近战相邻、远程3格直线+遮挡+护城墙穿透、骰子匹配、不活动惩罚、攻击次数限制均正确实现。测试覆盖充分。
