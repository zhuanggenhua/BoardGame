# Commit 6ea1f9f 综合审计设计文档

## Overview

本设计文档定义了对 commit 6ea1f9f（"feat: add Smash Up POD faction support"）的系统性审计方法。该提交影响了 379 个文件（+4711/-2989 行），在添加 POD 派系支持的同时删除了大量未说明的代码，导致多个严重的回归问题。

审计目标：
- 识别所有被错误删除的代码
- 验证所有删除是否有合理理由
- 修复已确认的 3 个严重问题（太极回合限制、响应窗口视角切换、变体排序）
- 确保没有引入其他回归问题
- 恢复必要的测试覆盖

审计策略：
- 优先修复已确认的严重问题
- 使用 git show/diff 对比原始代码
- 使用 grepSearch 查找相关代码引用
- 使用 GameTestRunner 和 E2E 测试验证修复
- 记录所有审计发现到 tmp/ 目录

## Glossary

- **Bug_Condition (C)**: 文件变更满足以下任一条件：删除了功能代码但未说明、删除了测试文件但未确认过时、修改了引擎层/框架层代码但未验证影响、修改了共享代码但未进行跨游戏测试
- **Property (P)**: 审计完整性 - 所有潜在问题都被审查并处理（恢复或记录理由）；功能恢复 - 已确认的严重问题被修复并通过测试；测试覆盖 - 关键变更有测试覆盖
- **Preservation**: 已有功能不受影响 - SmashUp（已验证 1212/1212 测试通过）、其他模块的未修改功能保持原有行为
- **Audit Phase**: 审计阶段 - 将 379 个文件分为 8 个阶段逐步审计
- **Critical Issue**: 严重问题 - 已确认的功能缺失或回归（太极回合限制、响应窗口视角切换、变体排序）
- **Code Restoration**: 代码恢复 - 使用 git show 提取原始代码并恢复到当前代码库
- **Impact Analysis**: 影响分析 - 使用 grepSearch 查找代码引用，评估变更的影响范围
- **Test Verification**: 测试验证 - 使用 GameTestRunner 和 E2E 测试验证修复的正确性

## Bug Details

### Fault Condition

该 bug 在以下情况下触发：

1. **代码删除未说明**：commit 6ea1f9f 删除了大量代码（2989 行），但提交信息只说明了"add Smash Up POD faction support"，未说明删除的原因
2. **测试文件被删除**：多个测试文件被完全删除（monk-coverage.test.ts 127 行、shield-cleanup.test.ts 188 行、viewMode.test.ts 81 行、actionLogFormat.test.ts 45 行）
3. **功能代码被删除**：关键功能代码被删除（太极回合限制、响应窗口视角切换、变体排序、debug-config.tsx、domain/characters.ts）
4. **引擎层大量变更**：引擎层关键文件有大量变更（pipeline.ts 111 行、useEventStreamCursor.ts 107 行、actionLogHelpers.ts 204 行、transport/server.ts 247 行）
5. **跨模块影响未验证**：变更影响多个游戏（DiceThrone、SummonerWars、SmashUp）但未进行跨游戏测试

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type FileChange
  OUTPUT: boolean
  
  RETURN (input.linesDeleted > 0 AND NOT documented(input.reason))
      OR (input.isTestFile AND input.deleted AND NOT confirmed(input.obsolete))
      OR (input.isEngineLayer AND input.modified AND NOT verified(input.impact))
      OR (input.isSharedCode AND input.modified AND NOT tested(input.crossGame))
END FUNCTION
```

### Examples

- **太极回合限制被删除**：DiceThrone 太极角色的回合限制逻辑被删除，导致玩家可以无限次使用技能
- **响应窗口视角切换被删除**：响应窗口触发时不再自动切换到响应玩家视角，导致用户体验下降
- **变体排序被删除**：变体列表排序逻辑被删除，导致变体显示顺序混乱
- **测试文件被删除**：monk-coverage.test.ts（127 行）被删除，导致 Monk 角色的测试覆盖缺失
- **引擎层变更未验证**：pipeline.ts 有 111 行变更，但未验证是否影响其他游戏的命令执行流程

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- SmashUp 游戏的所有功能应继续正常工作（已通过 1212/1212 测试验证）
- DiceThrone 游戏的所有未被修改的功能应继续正常工作
- SummonerWars 游戏的所有未被修改的功能应继续正常工作
- 引擎层的核心功能（命令执行、事件流、状态管理）应继续正常工作
- 框架层的通用组件（GameHUD、RematchActions）应继续支持所有游戏

**Scope:**
所有未被 commit 6ea1f9f 修改的代码应完全不受影响。这包括：
- 其他游戏模块（TicTacToe 等）
- 未被修改的引擎层功能
- 未被修改的框架层组件
- 未被修改的通用工具函数

## Hypothesized Root Cause

基于 bug 描述和代码审查，最可能的问题原因是：

1. **范围过大的重构**：提交试图同时完成多个目标（添加 POD 派系 + 代码清理 + 架构调整），导致删除了不应删除的代码
   - 可能使用了自动化工具（如 IDE 的"删除未使用代码"功能）
   - 可能在合并多个分支时丢失了部分代码

2. **测试覆盖不足**：删除代码时未运行完整的测试套件
   - DiceThrone 的测试文件被删除，导致无法发现回归问题
   - 跨游戏测试未执行，导致引擎层变更的影响未被发现

3. **代码审查不充分**：提交前未进行充分的代码审查
   - 379 个文件的变更量过大，难以人工审查
   - 提交信息未说明删除的原因，导致审查者无法判断删除是否合理

4. **功能迁移不完整**：某些功能可能被重构到新位置，但旧代码被删除后新代码未正确实现
   - 太极回合限制可能被移到新的系统，但新系统未正确实现
   - 响应窗口视角切换可能被移到新的组件，但新组件未正确调用

## Correctness Properties

Property 1: Fault Condition - 审计完整性

_For any_ 文件变更 X 满足 isBugCondition(X) 的条件，审计流程 SHALL 确保该变更被审查，并且要么恢复被删除的代码，要么记录删除的合理理由。

**Validates: Requirements 2.1, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11**

Property 2: Fault Condition - 功能恢复

_For any_ 已确认的严重问题（太极回合限制、响应窗口视角切换、变体排序），修复后的代码 SHALL 恢复原有功能，并且行为与原始代码一致。

**Validates: Requirements 2.2, 2.3, 2.4**

Property 3: Fault Condition - 测试覆盖

_For any_ 引擎层或框架层的关键变更，SHALL 存在自动化测试验证该变更的正确性，并且所有测试 SHALL 通过。

**Validates: Requirements 2.7, 2.8**

Property 4: Preservation - 已有功能不受影响

_For any_ 未被 commit 6ea1f9f 修改的功能，修复后的代码 SHALL 保持该功能的原有行为，不引入新的回归问题。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Phase 1: Critical Issues (Priority: Highest)

**目标**：修复已确认的 3 个严重问题

**Changes Required**：

**Issue 1: 太极回合限制逻辑恢复**

- **File**: `src/games/dicethrone/domain/characters.ts` 或相关文件
- **Method**: 使用 `git show 6ea1f9f^:src/games/dicethrone/...` 查看删除前的代码
- **Steps**:
  1. 使用 grepSearch 搜索 "太极" 或 "taichi" 或 "turn limit" 定位相关代码
  2. 使用 git show 查看 6ea1f9f 之前的实现
  3. 对比当前代码，确认逻辑是否被删除
  4. 恢复被删除的回合限制逻辑
  5. 使用 GameTestRunner 编写测试验证修复

**Issue 2: 响应窗口视角自动切换恢复**
- **File**: `src/components/game/framework/` 或 `src/engine/systems/ResponseWindowSystem.ts`
- **Method**: 使用 git diff 对比变更
- **Steps**:
  1. 使用 grepSearch 搜索 "responseWindow" 和 "视角" 或 "perspective" 或 "viewMode"
  2. 使用 git show 查看 6ea1f9f 之前的实现
  3. 确认视角切换逻辑是否被删除
  4. 恢复被删除的视角切换逻辑
  5. 使用 E2E 测试验证修复

**Issue 3: 变体排序逻辑恢复**
- **File**: 大厅或游戏选择相关组件
- **Method**: 使用 git diff 对比变更
- **Steps**:
  1. 使用 grepSearch 搜索 "variant" 和 "sort" 定位相关代码
  2. 使用 git show 查看 6ea1f9f 之前的排序逻辑
  3. 确认排序逻辑是否被删除
  4. 恢复被删除的排序逻辑
  5. 手动测试验证修复

**详细实现计划见**: `design-phase1.md`

### Phase 2-8: Systematic Audit

**详细实现计划见**:
- `design-phase2.md` - DiceThrone Module Audit
- `design-phase3.md` - Engine Layer Audit
- `design-phase4.md` - Framework Layer Audit
- `design-phase5.md` - SummonerWars Module Audit
- `design-phase6.md` - Other Modules Audit
- `design-phase7.md` - Cross-Module Integration Testing
- `design-phase8.md` - Documentation and Cleanup

## Testing Strategy

### Validation Approach

审计策略遵循三阶段方法：

1. **Exploratory Fault Condition Checking**: 识别所有潜在问题（使用 git diff 和代码审查）
2. **Fix Checking**: 验证修复的正确性（使用 GameTestRunner 和 E2E 测试）
3. **Preservation Checking**: 验证已有功能不受影响（使用现有测试套件）

**详细测试策略见**: `design-testing.md`

## Tools and Methods

### Git Commands

- `git show 6ea1f9f^:<file>` - 查看文件在 commit 之前的版本
- `git diff 6ea1f9f^..6ea1f9f -- <file>` - 查看文件的具体变更
- `git log --oneline --follow -- <file>` - 查看文件的提交历史

### Code Search

- `grepSearch` - 搜索代码引用和相关实现
- `readCode` - 读取代码结构和签名
- `readFile` - 读取完整文件内容

### Testing Tools

- `GameTestRunner` - 游戏逻辑单元测试
- `Playwright E2E` - 端到端集成测试
- `npm run test:e2e` - 运行 E2E 测试套件

### Documentation

- `tmp/` 目录 - 记录所有审计发现
- Markdown 格式 - 便于版本控制和协作

**详细工具使用指南见**: `design-tools.md`
