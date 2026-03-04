# Bugfix Requirements Document

## Introduction

Commit 6ea1f9f (POD faction support) 引入了多个回归 bug，主要涉及：
1. 过滤条件误删（如 Killer Queen talent 的 `playedThisTurn` 检查）
2. 字段名错误替换（`powerCounters` → `powerModifier`）
3. ResponseWindowSystem 配置误删（Me First! 响应窗口）

虽然部分问题已在后续提交中修复，但需要对整个提交进行全面审计，确保没有遗漏的回归问题。

## Bug Analysis

### Current Behavior (Defect)

#### 1. 过滤条件缺失

1.1 WHEN Killer Queen talent 选择目标随从时 THEN 系统允许选择非本回合打出的随从

1.2 WHEN Killer Queen talent 选择目标随从时 THEN 系统允许选择 Killer Queen 自己作为目标

1.3 WHEN 其他能力需要过滤特定条件的随从/卡牌时 THEN 系统可能缺少关键过滤条件（如 `playedThisTurn`、`controller` 等）

#### 2. 字段名错误使用

1.4 WHEN 兵蚁 talent 检查是否有力量指示物时 THEN 系统检查 `powerModifier`（临时力量修正）而非 `powerCounters`（永久力量指示物）

1.5 WHEN 雄蜂 protection 检查是否有力量指示物时 THEN 系统检查 `powerModifier` 而非 `powerCounters`

1.6 WHEN 如同魔法收集力量指示物数量时 THEN 系统读取 `powerModifier` 而非 `powerCounters`

1.7 WHEN 我们将震撼你给予临时力量时 THEN 系统基于 `powerModifier` 而非 `powerCounters` 计算数值

1.8 WHEN 承受压力转移力量指示物时 THEN 系统读取和操作 `powerModifier` 而非 `powerCounters`

1.9 WHEN 我们乃最强转移力量指示物时 THEN 系统读取和操作 `powerModifier` 而非 `powerCounters`

#### 3. ResponseWindowSystem 配置缺失

1.10 WHEN 玩家在 Me First! 响应窗口中尝试打出 `beforeScoringPlayable` 随从时 THEN 系统不允许该操作（因为 `su:play_minion` 未在 `allowedCommands` 中）

1.11 WHEN 玩家打出 `beforeScoringPlayable` 随从后 THEN 系统不会自动推进响应窗口（因为 `su:minion_played` 未在 `responseAdvanceEvents` 中）

1.12 WHEN 系统检查是否有可响应内容时 THEN 系统不检查 `beforeScoringPlayable` 随从（因为 `hasRespondableContent` 中缺少相关逻辑）

#### 4. 其他潜在问题

1.13 WHEN commit 6ea1f9f 中修改了任何验证逻辑时 THEN 系统可能缺少关键的前置条件检查

1.14 WHEN commit 6ea1f9f 中修改了任何事件处理逻辑时 THEN 系统可能产生错误的事件或缺少必要的事件

1.15 WHEN commit 6ea1f9f 中修改了任何测试文件时 THEN 测试可能不再覆盖关键场景或断言错误的行为

### Expected Behavior (Correct)

#### 1. 过滤条件完整

2.1 WHEN Killer Queen talent 选择目标随从时 THEN 系统 SHALL 只允许选择本回合打出的随从（`playedThisTurn === true`）

2.2 WHEN Killer Queen talent 选择目标随从时 THEN 系统 SHALL 排除 Killer Queen 自己（`uid !== ctx.cardUid`）

2.3 WHEN 任何能力需要过滤特定条件的随从/卡牌时 THEN 系统 SHALL 包含所有必要的过滤条件，与原始正确版本一致

#### 2. 字段名正确使用

2.4 WHEN 兵蚁 talent 检查是否有力量指示物时 THEN 系统 SHALL 检查 `powerCounters ?? 0`

2.5 WHEN 雄蜂 protection 检查是否有力量指示物时 THEN 系统 SHALL 检查 `powerCounters ?? 0`

2.6 WHEN 如同魔法收集力量指示物数量时 THEN 系统 SHALL 读取 `powerCounters ?? 0`

2.7 WHEN 我们将震撼你给予临时力量时 THEN 系统 SHALL 基于 `powerCounters ?? 0` 计算数值

2.8 WHEN 承受压力转移力量指示物时 THEN 系统 SHALL 读取和操作 `powerCounters`

2.9 WHEN 我们乃最强转移力量指示物时 THEN 系统 SHALL 读取和操作 `powerCounters`

#### 3. ResponseWindowSystem 配置完整

2.10 WHEN 玩家在 Me First! 响应窗口中尝试打出 `beforeScoringPlayable` 随从时 THEN 系统 SHALL 允许该操作（`su:play_minion` 在 `allowedCommands` 中）

2.11 WHEN 玩家打出 `beforeScoringPlayable` 随从后 THEN 系统 SHALL 自动推进响应窗口（`su:minion_played` 在 `responseAdvanceEvents` 中，且 `windowTypes` 包含 `'meFirst'`）

2.12 WHEN 系统检查是否有可响应内容时 THEN 系统 SHALL 检查是否有 `beforeScoringPlayable` 随从可打出

#### 4. 其他修复

2.13 WHEN commit 6ea1f9f 中修改了任何验证逻辑时 THEN 系统 SHALL 包含所有必要的前置条件检查，与原始正确版本一致

2.14 WHEN commit 6ea1f9f 中修改了任何事件处理逻辑时 THEN 系统 SHALL 产生正确的事件，与原始正确版本一致

2.15 WHEN commit 6ea1f9f 中修改了任何测试文件时 THEN 测试 SHALL 覆盖所有关键场景并断言正确的行为

### Unchanged Behavior (Regression Prevention)

#### 1. 正确的能力逻辑保持不变

3.1 WHEN 能力在 commit 6ea1f9f 之前工作正常且未被修改时 THEN 系统 SHALL CONTINUE TO 保持原有的正确行为

3.2 WHEN 能力使用正确的字段名（如 `powerCounters`）且未被错误替换时 THEN 系统 SHALL CONTINUE TO 使用正确的字段名

#### 2. 正确的过滤条件保持不变

3.3 WHEN 能力的过滤条件在 commit 6ea1f9f 之前完整且未被误删时 THEN 系统 SHALL CONTINUE TO 使用完整的过滤条件

3.4 WHEN 能力的验证逻辑在 commit 6ea1f9f 之前正确且未被修改时 THEN 系统 SHALL CONTINUE TO 使用正确的验证逻辑

#### 3. 正确的系统配置保持不变

3.5 WHEN ResponseWindowSystem 配置在 commit 6ea1f9f 之前完整且未被误删时 THEN 系统 SHALL CONTINUE TO 使用完整的配置

3.6 WHEN 其他系统配置在 commit 6ea1f9f 之前正确且未被修改时 THEN 系统 SHALL CONTINUE TO 使用正确的配置

#### 4. 测试覆盖保持不变

3.7 WHEN 测试在 commit 6ea1f9f 之前覆盖关键场景且未被修改时 THEN 测试 SHALL CONTINUE TO 覆盖这些关键场景

3.8 WHEN 测试在 commit 6ea1f9f 之前断言正确的行为且未被修改时 THEN 测试 SHALL CONTINUE TO 断言正确的行为

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(change)
  INPUT: change of type GitDiffChange
  OUTPUT: boolean
  
  // 返回 true 当变更引入了回归 bug
  RETURN (
    // 删除了关键过滤条件
    (change.type = 'deletion' AND containsFilterCondition(change.content)) OR
    
    // 错误替换字段名
    (change.type = 'modification' AND 
     change.before.contains('powerCounters') AND 
     change.after.contains('powerModifier')) OR
    
    // 删除了系统配置
    (change.type = 'deletion' AND 
     change.file.contains('game.ts') AND
     containsSystemConfig(change.content)) OR
    
    // 修改了验证/执行逻辑但缺少必要检查
    (change.type = 'modification' AND
     (change.file.contains('validate.ts') OR change.file.contains('execute.ts')) AND
     removedPreconditionCheck(change))
  )
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - 所有回归 bug 已修复
FOR ALL change IN commit_6ea1f9f WHERE isBugCondition(change) DO
  fixed_code ← getCurrentCode(change.file)
  original_code ← getCodeAtCommit('232214d', change.file)
  
  ASSERT (
    // 过滤条件已恢复
    (change.deletedFilterCondition IMPLIES 
     fixed_code.contains(change.deletedFilterCondition)) AND
    
    // 字段名已修正
    (change.wrongFieldName IMPLIES 
     fixed_code.contains('powerCounters') AND 
     NOT fixed_code.contains('powerModifier' in wrong context)) AND
    
    // 系统配置已恢复
    (change.deletedConfig IMPLIES 
     fixed_code.contains(change.deletedConfig)) AND
    
    // 验证逻辑已修正
    (change.removedCheck IMPLIES 
     fixed_code.contains(change.removedCheck))
  )
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - 正确的代码保持不变
FOR ALL change IN commit_6ea1f9f WHERE NOT isBugCondition(change) DO
  current_code ← getCurrentCode(change.file)
  original_code ← getCodeAtCommit('232214d', change.file)
  
  ASSERT current_code = original_code OR isIntentionalImprovement(change)
END FOR
```

## Audit Scope

### 文件范围

需要审计 commit 6ea1f9f 中所有修改的 SmashUp 相关文件：

1. **能力文件**（`src/games/smashup/abilities/*.ts`）
   - 检查所有过滤条件是否完整
   - 检查所有字段名是否正确（`powerCounters` vs `powerModifier`）
   - 检查所有验证逻辑是否完整

2. **游戏配置**（`src/games/smashup/game.ts`）
   - 检查 ResponseWindowSystem 配置是否完整
   - 检查其他系统配置是否正确

3. **领域层**（`src/games/smashup/domain/*.ts`）
   - 检查类型定义是否正确
   - 检查工具函数是否正确

4. **测试文件**（`src/games/smashup/__tests__/*.ts`）
   - 检查测试覆盖是否完整
   - 检查测试断言是否正确

### 审计维度

对每个修改的文件，检查以下维度：

1. **过滤条件完整性**
   - 是否删除了 `playedThisTurn`、`controller`、`uid !== xxx` 等关键过滤条件？
   - 过滤条件是否与原始正确版本一致？

2. **字段名正确性**
   - 是否将 `powerCounters` 错误替换为 `powerModifier`？
   - 是否将其他字段名错误替换？

3. **系统配置完整性**
   - ResponseWindowSystem 的 `allowedCommands` 是否完整？
   - ResponseWindowSystem 的 `responseAdvanceEvents` 是否完整？
   - ResponseWindowSystem 的 `hasRespondableContent` 是否完整？

4. **验证逻辑完整性**
   - 是否删除了必要的前置条件检查？
   - 验证逻辑是否与原始正确版本一致？

5. **事件处理正确性**
   - 是否产生了错误的事件？
   - 是否缺少必要的事件？

6. **测试覆盖完整性**
   - 测试是否覆盖所有关键场景？
   - 测试断言是否正确？

## Verification Strategy

### 1. Git Diff 分析

```bash
# 获取 commit 6ea1f9f 的完整 diff
git show 6ea1f9f --stat
git show 6ea1f9f -- 'src/games/smashup/**/*.ts'

# 对比原始正确版本（commit 232214d 之前）
git diff 232214d^..6ea1f9f -- 'src/games/smashup/**/*.ts'
```

### 2. 关键词搜索

```bash
# 搜索所有使用 powerModifier 的地方（应该是 powerCounters）
grep -r "powerModifier" src/games/smashup/abilities/

# 搜索所有过滤条件（检查是否缺少 playedThisTurn）
grep -r "playedThisTurn" src/games/smashup/abilities/

# 搜索 ResponseWindowSystem 配置
grep -r "allowedCommands" src/games/smashup/game.ts
grep -r "responseAdvanceEvents" src/games/smashup/game.ts
```

### 3. 测试验证

```bash
# 运行所有 SmashUp 测试
npm test -- smashup

# 运行特定测试文件
npm test -- newFactionAbilities.test.ts
npm test -- meFirst.test.ts
```

### 4. 手动验证

对于每个发现的问题：
1. 确认问题确实存在（对比原始正确版本）
2. 确认问题已修复或需要修复
3. 编写或更新测试覆盖该问题
4. 运行测试确认修复有效

## Success Criteria

审计完成的标准：

1. ✅ 所有 commit 6ea1f9f 中修改的 SmashUp 文件已审查
2. ✅ 所有发现的回归 bug 已记录
3. ✅ 所有回归 bug 的修复状态已确认（已修复/需要修复）
4. ✅ 所有需要修复的 bug 已修复
5. ✅ 所有相关测试已通过
6. ✅ 没有遗漏的回归问题
