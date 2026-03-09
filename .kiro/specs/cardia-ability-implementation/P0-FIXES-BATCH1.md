# Cardia P0 问题修复报告（批次 1）

**修复日期**: 2025-01-28  
**修复范围**: P0-1, P0-2, P0-3  
**修复状态**: ✅ 完成

---

## 修复摘要

本次修复解决了审计报告中的 3 个 P0 严重问题：

1. **P0-1**: 修复 `@/engine/primitives/modifier` 导入错误
2. **P0-2**: 修复 `createModifierSelectionInteraction` 未导入错误
3. **P0-3**: 修复 AMBUSHER 和 WITCH_KING 执行器注册验证错误

---

## P0-1: 修复 modifier.ts 导入错误

### 问题描述
4 个测试文件使用了错误的导入路径 `@/engine/primitives/modifier`，导致测试无法运行。

### 根因分析
- `@/` 别名在测试环境中未正确配置
- 其他测试文件使用相对路径 `../../../engine/primitives/modifier` 可以正常工作

### 修复方案
将所有测试文件中的 `@/engine/primitives/modifier` 和 `@/engine/primitives/tags` 改为相对路径：

**修改文件**:
1. `src/games/cardia/__tests__/abilities-group3-ongoing.test.ts`
2. `src/games/cardia/__tests__/abilities-group4-card-ops.test.ts`
3. `src/games/cardia/__tests__/abilities-group5-copy.test.ts`
4. `src/games/cardia/__tests__/abilities-group6-special.test.ts`
5. `src/games/cardia/__tests__/abilities-group7-faction.test.ts`

**修改内容**:
```typescript
// 修改前
import { createModifierStack } from '@/engine/primitives/modifier';
import { createTagContainer } from '@/engine/primitives/tags';

// 修改后
import { createModifierStack } from '../../../engine/primitives/modifier';
import { createTagContainer } from '../../../engine/primitives/tags';
```

### 验证结果
✅ 所有测试文件可以正常导入，测试可以运行

---

## P0-2: 修复 createModifierSelectionInteraction 未导入错误

### 问题描述
`group2-modifiers.ts` 中调用了 `createModifierSelectionInteraction` 函数，但未导入该函数，导致运行时错误。

### 根因分析
- 函数已在 `interactionHandlers.ts` 中实现
- 但 `group2-modifiers.ts` 的 import 语句中缺少该函数

### 修复方案
在 `src/games/cardia/domain/abilities/group2-modifiers.ts` 的 import 语句中添加 `createModifierSelectionInteraction`：

```typescript
// 修改前
import { createCardSelectionInteraction, filterCards } from '../interactionHandlers';

// 修改后
import { createCardSelectionInteraction, filterCards, createModifierSelectionInteraction } from '../interactionHandlers';
```

### 验证结果
✅ `abilities-group2-modifiers.test.ts` 全部 24 个测试通过

---

## P0-3: 修复 AMBUSHER 和 WITCH_KING 执行器注册验证错误

### 问题描述
`verify-executors.test.ts` 测试失败，报告缺少 AMBUSHER 和 WITCH_KING 两个执行器。

### 根因分析
- 这两个能力已从 `group1-resources.ts` 移至 `group7-faction.ts`
- 但测试文件仍然期望在 group1 中找到它们
- 测试文件未导入 `group7-faction.ts`

### 修复方案

**1. 更新 group1 测试列表**

在 `src/games/cardia/__tests__/verify-executors.test.ts` 中：

```typescript
// 修改前
const group1Ids = [
    ABILITY_IDS.SABOTEUR,
    ABILITY_IDS.REVOLUTIONARY,
    ABILITY_IDS.AMBUSHER,      // 已移至 group7
    ABILITY_IDS.WITCH_KING,    // 已移至 group7
    ABILITY_IDS.HEIR,
];

// 修改后
const group1Ids = [
    ABILITY_IDS.SABOTEUR,
    ABILITY_IDS.REVOLUTIONARY,
    ABILITY_IDS.HEIR,
];
```

**2. 添加 group7 测试**

```typescript
it('组 7 能力应该都有执行器', () => {
    const group7Ids = [
        ABILITY_IDS.AMBUSHER,
        ABILITY_IDS.WITCH_KING,
    ];
    
    for (const id of group7Ids) {
        const executor = abilityExecutorRegistry.resolve(id);
        expect(executor).toBeDefined();
    }
});
```

**3. 导入 group7 文件**

```typescript
// 添加导入
import '../domain/abilities/group7-faction';
```

### 验证结果
✅ `verify-executors.test.ts` 全部 3 个测试通过
- ✅ 应该注册所有 32 个能力执行器
- ✅ 组 1 能力应该都有执行器
- ✅ 组 7 能力应该都有执行器

---

## 测试结果总结

### 修复前
```
verify-executors.test.ts: 2 failed / 2 total
abilities-group2-modifiers.test.ts: 1 failed / 24 total
abilities-group3-ongoing.test.ts: 无法运行（导入错误）
abilities-group4-card-ops.test.ts: 无法运行（导入错误）
abilities-group5-copy.test.ts: 无法运行（导入错误）
abilities-group6-special.test.ts: 无法运行（导入错误）
abilities-group7-faction.test.ts: 无法运行（导入错误）
```

### 修复后
```
verify-executors.test.ts: 3 passed / 3 total ✅
abilities-group2-modifiers.test.ts: 24 passed / 24 total ✅
abilities-group3-ongoing.test.ts: 可以运行 ✅
abilities-group4-card-ops.test.ts: 可以运行 ✅
abilities-group5-copy.test.ts: 可以运行 ✅
abilities-group6-special.test.ts: 可以运行 ✅
abilities-group7-faction.test.ts: 可以运行 ✅
```

---

## 剩余 P0 问题

根据审计报告，还有以下 P0 问题需要修复：

### P0-4: 测试辅助函数缺失
- **状态**: 未修复
- **影响**: 集成测试无法运行
- **需要**: 在 `test-helpers.ts` 中实现 `createTestCard`、`createTestPlayedCard`、`TEST_CARDS`

### P0-5/6/7: 核心系统未实现
- **状态**: 需要重新评估
- **说明**: 审计报告声称 `execute.ts`、`reduce.ts`、`validate.ts` 未实现，但实际检查发现这些文件已有大量实现代码
- **下一步**: 运行核心系统测试，确认实际缺失的部分

---

## 下一步行动

1. ✅ 完成 P0-1, P0-2, P0-3 修复
2. ⏭️ 评估 P0-4: 检查哪些测试辅助函数确实缺失
3. ⏭️ 重新评估 P0-5/6/7: 运行核心系统测试，确认实际问题
4. ⏭️ 修复剩余 P0 问题
5. ⏭️ 开始修复 P1 功能正确性问题

---

**修复完成时间**: 2025-01-28 13:00  
**下一批次**: P0-4 测试辅助函数实现
