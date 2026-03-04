# Bugfix Requirements Document

## Introduction

Commit 6ea1f9f（标题："feat: add Smash Up POD faction support"）是一个范围过大的提交，影响了 379 个文件（+4711/-2989 行）。该提交在添加 POD 派系支持的同时，删除了大量未在提交信息中说明的代码，导致多个严重的回归问题。

已确认的严重问题包括：
1. ✅ 狂战士 rage 技能被错误删除（已修复）
2. ❌ 太极回合限制逻辑被删除（未修复）
3. ❌ 响应窗口视角自动切换被删除（未修复）
4. ❌ 变体排序逻辑被删除（未修复）

受影响的模块包括：DiceThrone（106 个文件）、引擎层（10+ 个文件）、框架层（多个文件）、SummonerWars（18 个文件）、SmashUp（119 个文件，已审计完成）、i18n 文件（16 个）、通用组件、Context 层、大厅/社交系统。

本 bugfix spec 的目标是系统性审查所有 379 个文件的变更，识别所有被错误删除的代码，验证所有删除是否有合理理由，确保没有引入回归问题，并修复所有发现的问题。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 审查 commit 6ea1f9f 的变更时 THEN 发现大量代码被删除但未在提交信息中说明原因

1.2 WHEN 运行 DiceThrone 游戏时 THEN 太极回合限制逻辑不生效（原逻辑被删除）

1.3 WHEN 响应窗口触发时 THEN 视角不会自动切换到响应玩家（原逻辑被删除）

1.4 WHEN 查看变体列表时 THEN 变体排序不正确（原排序逻辑被删除）

1.5 WHEN 审查 DiceThrone 测试文件时 THEN 发现多个测试文件被完全删除（monk-coverage.test.ts 127 行、shield-cleanup.test.ts 188 行、viewMode.test.ts 81 行、actionLogFormat.test.ts 45 行）

1.6 WHEN 审查 DiceThrone 功能代码时 THEN 发现 debug-config.tsx（77 行）和 domain/characters.ts（29 行）被删除

1.7 WHEN 审查引擎层代码时 THEN 发现 pipeline.ts（111 行变更）、useEventStreamCursor.ts（107 行变更）、actionLogHelpers.ts（204 行变更）、transport/server.ts（247 行变更）、FlowSystem.ts（7 行删除）等关键文件有大量变更

1.8 WHEN 审查框架层代码时 THEN 发现 GameHUD.tsx（118 行变更）、RematchActions.tsx（177 行变更）、useAutoSkipPhase.ts（24 行变更）等文件有大量变更

1.9 WHEN 审查 SummonerWars 代码时 THEN 发现 18 个文件被修改但未进行系统性审计

1.10 WHEN 审查 i18n 文件时 THEN 发现 16 个国际化文件被修改但未验证翻译完整性

1.11 WHEN 审查通用组件、Context 层、大厅/社交系统时 THEN 发现多个文件被修改但未验证功能完整性

### Expected Behavior (Correct)

2.1 WHEN 审查 commit 6ea1f9f 的变更时 THEN 所有代码删除都应有明确的理由并在提交信息或文档中说明

2.2 WHEN 运行 DiceThrone 游戏时 THEN 太极回合限制逻辑应正常生效（恢复被删除的逻辑或提供替代实现）

2.3 WHEN 响应窗口触发时 THEN 视角应自动切换到响应玩家（恢复被删除的逻辑或提供替代实现）

2.4 WHEN 查看变体列表时 THEN 变体应按正确顺序排列（恢复被删除的排序逻辑或提供替代实现）

2.5 WHEN 审查 DiceThrone 测试文件时 THEN 所有被删除的测试应被恢复或确认删除理由合理（如测试已过时、功能已移除等）

2.6 WHEN 审查 DiceThrone 功能代码时 THEN 所有被删除的功能代码应被恢复或确认删除理由合理

2.7 WHEN 审查引擎层代码时 THEN 所有变更应被验证不会引入回归问题，关键功能应有测试覆盖

2.8 WHEN 审查框架层代码时 THEN 所有变更应被验证不会影响其他游戏的正常运行

2.9 WHEN 审查 SummonerWars 代码时 THEN 所有 18 个文件的变更应被系统性审计，确认无回归问题

2.10 WHEN 审查 i18n 文件时 THEN 所有翻译变更应被验证完整性和正确性

2.11 WHEN 审查通用组件、Context 层、大厅/社交系统时 THEN 所有变更应被验证功能完整性和向后兼容性

### Unchanged Behavior (Regression Prevention)

3.1 WHEN SmashUp 游戏运行时 THEN 所有功能应继续正常工作（已通过 1212/1212 测试验证）

3.2 WHEN 其他未被 commit 6ea1f9f 修改的模块运行时 THEN 所有功能应继续正常工作

3.3 WHEN 运行已有的自动化测试时 THEN 所有测试应继续通过（除非测试本身有问题）

3.4 WHEN 用户使用已有功能时 THEN 用户体验应保持一致，不应出现功能缺失或行为变化

3.5 WHEN 开发者查看代码时 THEN 代码结构和架构应保持清晰，不应因删除而导致理解困难

## Bug Condition Derivation

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type FileChange
  OUTPUT: boolean
  
  // 当文件变更满足以下任一条件时，视为潜在 bug：
  // 1. 删除了功能代码但未在提交信息中说明
  // 2. 删除了测试文件但未确认测试已过时
  // 3. 修改了引擎层/框架层代码但未验证影响范围
  // 4. 修改了多个游戏的共享代码但未进行跨游戏测试
  RETURN (X.linesDeleted > 0 AND NOT documented(X.reason))
      OR (X.isTestFile AND X.deleted AND NOT confirmed(X.obsolete))
      OR (X.isEngineLayer AND X.modified AND NOT verified(X.impact))
      OR (X.isSharedCode AND X.modified AND NOT tested(X.crossGame))
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - 审计完整性
FOR ALL X WHERE isBugCondition(X) DO
  auditResult ← auditFileChange'(X)
  ASSERT auditResult.reviewed = true
    AND (auditResult.restored OR auditResult.reasonDocumented)
    AND (NOT auditResult.isRegression)
END FOR

// Property: Fix Checking - 功能恢复
FOR ALL deletedFeature IN [太极回合限制, 响应窗口视角切换, 变体排序] DO
  result ← testFeature'(deletedFeature)
  ASSERT result.works = true
    AND result.behaviorMatchesOriginal = true
END FOR

// Property: Fix Checking - 测试覆盖
FOR ALL criticalChange IN engineLayerChanges DO
  coverage ← getTestCoverage'(criticalChange)
  ASSERT coverage.hasTests = true
    AND coverage.testsPass = true
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - 已有功能不受影响
FOR ALL module IN [SmashUp, DiceThrone, SummonerWars, 引擎层, 框架层] DO
  FOR ALL feature IN module.features WHERE NOT modified(feature) DO
    ASSERT behavior_after(feature) = behavior_before(feature)
  END FOR
END FOR

// Property: Preservation Checking - 测试通过率
FOR ALL testSuite IN existingTests WHERE NOT deleted(testSuite) DO
  ASSERT testSuite.passRate_after >= testSuite.passRate_before
END FOR
```

## Audit Scope

### Phase 1: Critical Issues (已确认问题修复)
- 太极回合限制逻辑恢复
- 响应窗口视角自动切换恢复
- 变体排序逻辑恢复

### Phase 2: DiceThrone Module (106 个文件)
- 测试文件删除审计（monk-coverage.test.ts、shield-cleanup.test.ts、viewMode.test.ts、actionLogFormat.test.ts）
- 功能代码删除审计（debug-config.tsx、domain/characters.ts）
- Board.tsx 变更审计（161 行变更）
- 其他 DiceThrone 文件变更审计

### Phase 3: Engine Layer (10+ 个文件)
- pipeline.ts（111 行变更）
- useEventStreamCursor.ts（107 行变更）
- actionLogHelpers.ts（204 行变更）
- transport/server.ts（247 行变更）
- FlowSystem.ts（7 行删除）
- 其他引擎层文件变更审计

### Phase 4: Framework Layer
- GameHUD.tsx（118 行变更）
- RematchActions.tsx（177 行变更）
- useAutoSkipPhase.ts（24 行变更）
- 其他框架层文件变更审计

### Phase 5: SummonerWars Module (18 个文件)
- 系统性审计所有 18 个文件的变更
- 验证无回归问题

### Phase 6: Other Modules
- i18n 文件（16 个）翻译完整性验证
- 通用组件变更审计
- Context 层变更审计
- 大厅/社交系统变更审计

### Phase 7: Cross-Module Integration Testing
- 跨游戏功能测试
- 引擎层变更影响范围测试
- 框架层变更向后兼容性测试

### Phase 8: Documentation and Cleanup
- 记录所有审计发现
- 更新相关文档
- 清理临时审计文件
