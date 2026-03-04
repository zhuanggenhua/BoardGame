# Phase 2: DiceThrone Module Audit - 详细实现计划

## Overview

Phase 2 专注于系统性审查 DiceThrone 模块的 106 个文件变更，包括测试文件删除、功能代码删除、Board.tsx 大量变更等。

优先级：High
预计时间：4-6 小时
依赖：Phase 1 完成

## Audit Scope

### Deleted Test Files (4 个文件，441 行)

1. **monk-coverage.test.ts** (127 行)
2. **shield-cleanup.test.ts** (188 行)
3. **viewMode.test.ts** (81 行)
4. **actionLogFormat.test.ts** (45 行)

### Deleted Feature Files (2 个文件，106 行)

1. **debug-config.tsx** (77 行)
2. **domain/characters.ts** (29 行)

### Major Changes

1. **Board.tsx** (161 行变更)
2. **其他 99 个文件** (需逐一审查)

## Audit Methodology

### Step 1: Deleted Test Files Analysis

**For each deleted test file**:

1. **查看原始内容**
   ```bash
   git show 6ea1f9f^:src/games/dicethrone/tests/<filename>
   ```

2. **分析测试覆盖**
   - 测试覆盖了哪些功能？
   - 这些功能是否仍然存在？
   - 是否有其他测试覆盖相同功能？

3. **决策**
   - **恢复测试**：如果功能仍存在且无其他测试覆盖
   - **重写测试**：如果功能重构需要新测试
   - **确认删除**：如果功能已移除或有充分测试覆盖

4. **记录结果**
   ```markdown
   ## monk-coverage.test.ts
   - **Status**: [恢复/重写/确认删除]
   - **Reason**: [详细原因]
   - **Action**: [具体行动]
   - **Test Coverage**: [覆盖情况]
   ```

### Step 2: Deleted Feature Files Analysis

**For each deleted feature file**:

1. **查看原始内容**
   ```bash
   git show 6ea1f9f^:src/games/dicethrone/<filepath>
   ```

2. **分析功能用途**
   - 文件提供了什么功能？
   - 是否有其他代码依赖此文件？
   - 功能是否被迁移到其他位置？

3. **搜索引用**
   ```bash
   grepSearch "import.*<filename>" --includePattern "**/dicethrone/**/*.ts"
   grepSearch "<exported-function-name>" --includePattern "**/dicethrone/**/*.ts"
   ```

4. **决策**
   - **恢复文件**：如果功能仍需要且无替代实现
   - **更新引用**：如果功能已迁移到新位置
   - **确认删除**：如果功能已废弃

### Step 3: Board.tsx Major Changes Analysis

**Analysis Steps**:

1. **查看具体变更**
   ```bash
   git diff 6ea1f9f^..6ea1f9f -- src/games/dicethrone/Board.tsx
   ```

2. **分类变更**
   - 新增功能（+行）
   - 删除功能（-行）
   - 重构代码（±行）

3. **影响分析**
   - 是否影响游戏逻辑？
   - 是否影响 UI 显示？
   - 是否影响性能？

4. **测试验证**
   - 运行现有 E2E 测试
   - 手动测试关键功能
   - 检查是否有回归问题

### Step 4: Other Files Systematic Review

**For each of the remaining 99 files**:

1. **快速分类**
   - 小变更（<10 行）：快速审查
   - 中等变更（10-50 行）：详细审查
   - 大变更（>50 行）：深度审查

2. **审查清单**
   - [ ] 变更是否与 POD 派系相关？
   - [ ] 是否删除了功能代码？
   - [ ] 是否有测试覆盖？
   - [ ] 是否影响其他模块？

3. **记录发现**
   - 使用统一格式记录到 `tmp/phase2-audit-<category>.md`
   - 标记需要进一步调查的文件

## Detailed Audit Plan

### monk-coverage.test.ts (127 行)

**Purpose**: 测试 Monk 角色的技能覆盖和行为

**Investigation**:
```bash
# 查看原始测试
git show 6ea1f9f^:src/games/dicethrone/tests/monk-coverage.test.ts > tmp/monk-coverage-original.test.ts

# 搜索 Monk 相关代码
grepSearch "monk" --includePattern "**/dicethrone/**/*.ts" --caseSensitive=false

# 检查是否有其他 Monk 测试
grepSearch "describe.*Monk" --includePattern "**/dicethrone/**/*.test.ts"
```

**Decision Criteria**:
- 如果 Monk 角色仍在游戏中 → 恢复或重写测试
- 如果 Monk 角色已移除 → 确认删除
- 如果有其他测试覆盖 Monk → 确认删除并记录

**Action**:
- [ ] 查看原始测试内容
- [ ] 确认 Monk 角色状态
- [ ] 检查测试覆盖情况
- [ ] 做出决策并执行
- [ ] 记录结果到 `tmp/phase2-monk-test.md`

### shield-cleanup.test.ts (188 行)

**Purpose**: 测试护盾清理逻辑

**Investigation**:
```bash
# 查看原始测试
git show 6ea1f9f^:src/games/dicethrone/tests/shield-cleanup.test.ts > tmp/shield-cleanup-original.test.ts

# 搜索护盾相关代码
grepSearch "shield" --includePattern "**/dicethrone/**/*.ts" --caseSensitive=false

# 检查护盾清理逻辑
grepSearch "cleanupShield" --includePattern "**/dicethrone/**/*.ts"
```

**Decision Criteria**:
- 如果护盾机制仍存在 → 恢复或重写测试
- 如果护盾清理逻辑已重构 → 重写测试
- 如果护盾机制已移除 → 确认删除

**Action**:
- [ ] 查看原始测试内容
- [ ] 确认护盾机制状态
- [ ] 检查清理逻辑实现
- [ ] 做出决策并执行
- [ ] 记录结果到 `tmp/phase2-shield-test.md`

### viewMode.test.ts (81 行)

**Purpose**: 测试视角模式切换

**Investigation**:
```bash
# 查看原始测试
git show 6ea1f9f^:src/games/dicethrone/tests/viewMode.test.ts > tmp/viewMode-original.test.ts

# 搜索视角相关代码
grepSearch "viewMode" --includePattern "**/*.ts"

# 检查视角切换逻辑
grepSearch "setViewMode" --includePattern "**/*.ts"
```

**Decision Criteria**:
- 如果视角切换功能仍存在 → 恢复或重写测试
- 如果视角切换已重构 → 重写测试
- 如果视角切换已移除 → 确认删除（但这可能与 Phase 1 Issue 2 相关）

**Action**:
- [ ] 查看原始测试内容
- [ ] 确认视角切换功能状态
- [ ] 检查与 Phase 1 Issue 2 的关系
- [ ] 做出决策并执行
- [ ] 记录结果到 `tmp/phase2-viewmode-test.md`

### actionLogFormat.test.ts (45 行)

**Purpose**: 测试行动日志格式化

**Investigation**:
```bash
# 查看原始测试
git show 6ea1f9f^:src/games/dicethrone/tests/actionLogFormat.test.ts > tmp/actionLogFormat-original.test.ts

# 搜索日志格式化代码
grepSearch "formatActionLog" --includePattern "**/dicethrone/**/*.ts"
grepSearch "actionLog" --includePattern "**/dicethrone/**/*.ts"
```

**Decision Criteria**:
- 如果日志格式化逻辑仍存在 → 恢复或重写测试
- 如果日志格式化已重构 → 重写测试
- 如果日志格式化已移除 → 确认删除

**Action**:
- [ ] 查看原始测试内容
- [ ] 确认日志格式化逻辑状态
- [ ] 检查格式化实现
- [ ] 做出决策并执行
- [ ] 记录结果到 `tmp/phase2-actionlog-test.md`

### debug-config.tsx (77 行)

**Purpose**: 调试配置面板

**Investigation**:
```bash
# 查看原始文件
git show 6ea1f9f^:src/games/dicethrone/debug-config.tsx > tmp/debug-config-original.tsx

# 搜索调试配置引用
grepSearch "debug-config" --includePattern "**/*.tsx"
grepSearch "DebugConfig" --includePattern "**/*.tsx"
```

**Decision Criteria**:
- 如果调试功能仍需要 → 恢复文件
- 如果调试功能已迁移 → 更新引用
- 如果调试功能已废弃 → 确认删除

**Action**:
- [ ] 查看原始文件内容
- [ ] 搜索引用
- [ ] 确认调试功能需求
- [ ] 做出决策并执行
- [ ] 记录结果到 `tmp/phase2-debug-config.md`

### domain/characters.ts (29 行)

**Purpose**: 角色定义（可能与 Phase 1 Issue 1 相关）

**Investigation**:
```bash
# 查看原始文件
git show 6ea1f9f^:src/games/dicethrone/domain/characters.ts > tmp/characters-original.ts

# 搜索角色定义引用
grepSearch "characters" --includePattern "**/dicethrone/**/*.ts"
grepSearch "CHARACTERS" --includePattern "**/dicethrone/**/*.ts"
```

**Decision Criteria**:
- 如果角色定义仍需要 → 恢复文件（可能已在 Phase 1 处理）
- 如果角色定义已迁移 → 更新引用
- 如果角色定义已废弃 → 确认删除

**Action**:
- [ ] 查看原始文件内容
- [ ] 检查与 Phase 1 Issue 1 的关系
- [ ] 搜索引用
- [ ] 做出决策并执行
- [ ] 记录结果到 `tmp/phase2-characters.md`

## Testing Strategy

### Unit Tests

对于恢复或重写的测试文件：
- 使用 GameTestRunner 验证游戏逻辑
- 确保测试覆盖关键功能
- 确保测试通过

### E2E Tests

对于 Board.tsx 和其他 UI 变更：
- 运行现有 E2E 测试套件
- 手动测试关键用户流程
- 验证无回归问题

### Integration Tests

对于跨模块影响：
- 测试 DiceThrone 与引擎层的交互
- 测试 DiceThrone 与框架层的交互
- 验证功能完整性

## Documentation

### Audit Report Structure

```markdown
# Phase 2 Audit Report - DiceThrone Module

## Summary
- Total Files Reviewed: 106
- Files Restored: X
- Files Confirmed Deleted: Y
- Issues Found: Z

## Deleted Test Files
### monk-coverage.test.ts
- Status: [恢复/重写/确认删除]
- Reason: [详细原因]
- Action Taken: [具体行动]

[... 其他测试文件 ...]

## Deleted Feature Files
### debug-config.tsx
- Status: [恢复/更新引用/确认删除]
- Reason: [详细原因]
- Action Taken: [具体行动]

[... 其他功能文件 ...]

## Major Changes
### Board.tsx
- Changes: [变更摘要]
- Impact: [影响分析]
- Testing: [测试结果]

## Other Files
[按类别分组的审查结果]

## Recommendations
[改进建议]
```

### Output Files

- `tmp/phase2-audit-report.md` - 主审计报告
- `tmp/phase2-monk-test.md` - Monk 测试分析
- `tmp/phase2-shield-test.md` - 护盾测试分析
- `tmp/phase2-viewmode-test.md` - 视角测试分析
- `tmp/phase2-actionlog-test.md` - 日志测试分析
- `tmp/phase2-debug-config.md` - 调试配置分析
- `tmp/phase2-characters.md` - 角色定义分析
- `tmp/phase2-board-changes.md` - Board.tsx 变更分析
- `tmp/phase2-other-files.md` - 其他文件审查结果

## Success Criteria

- [ ] 所有 106 个文件已审查
- [ ] 所有删除的测试文件已处理
- [ ] 所有删除的功能文件已处理
- [ ] Board.tsx 变更已验证
- [ ] 所有测试已通过
- [ ] 审计报告已完成

## Next Steps

完成 Phase 2 后，进入 Phase 3（Engine Layer Audit），审查引擎层的关键变更。
