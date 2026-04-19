# 🚨 关键发现：功能性删除被误判为代码清理

**发现时间**: 2026-03-04  
**严重程度**: 高

---

## 问题描述

用户质疑："所有删除都已经恢复？没有把删除当清理代码？"

经过重新审计，发现我**确实把功能性删除误判为代码清理**。

---

## 具体案例

### 案例 1: `addPermanentPower` 函数被删除

**文件**: `src/games/smashup/domain/abilityHelpers.ts`

**POD 提交删除内容**:
```typescript
-/** 生成永久力量修正事件（非指示物，不可移动/转移） */
-export function addPermanentPower(
-    minionUid: string,
-    baseIndex: number,
-    amount: number,
-    reason: string,
-    now: number
-): PermanentPowerAddedEvent {
-    return {
-        type: SU_EVENTS.PERMANENT_POWER_ADDED,
-        payload: { minionUid, baseIndex, amount, reason },
-        timestamp: now,
-    };
-}
```

**当前 HEAD 状态**: ✅ 函数存在（第 222-232 行）

**使用情况**: ✅ 被 `miskatonic.ts` 使用
```typescript
// src/games/smashup/abilities/miskatonic.ts:564
events.push(addPermanentPower(minionUid, baseIndex, count * 2, 'miskatonic_mandatory_reading', timestamp));
```

**我的原判断**: ❌ "删除行数较多但经审计确认为合理的代码重构"

**正确判断**: ✅ 这是功能性删除，但代码已在后续提交中恢复（类似 P1 的 4 个误报）

---

## 审计方法论问题

### 我犯的错误

1. **只看 POD 提交的 diff，没有验证当前 HEAD 状态**
   - P1 审计时犯过这个错误，导致 4 个误报
   - 现在发现 P0 审计时也犯了同样的错误

2. **过度信任"删除行数较多"的判断**
   - 看到删除 16 行，就假设是"代码重构"
   - 没有检查删除的函数是否被其他代码使用

3. **没有搜索函数调用**
   - 应该用 `grepSearch` 搜索 `addPermanentPower` 的使用情况
   - 应该检查当前 HEAD 是否有这个函数

### 正确的审计流程

对于每个删除的函数/类型/常量：

1. **检查当前 HEAD 状态**: 函数是否存在？
2. **搜索使用情况**: 是否有代码调用这个函数？
3. **判断删除类型**:
   - 当前 HEAD 不存在 + 有代码使用 = ❌ 需要恢复
   - 当前 HEAD 存在 + 有代码使用 = ✅ 已恢复（误报）
   - 当前 HEAD 不存在 + 无代码使用 = ✅ 代码清理

---

## 需要重新审计的文件

基于这个发现，以下文件需要重新审计：

### P0 "需关注"文件（6 个）

1. ✅ `smashup/domain/abilityHelpers.ts` (-16 行) - 已发现 `addPermanentPower` 误判
2. ⚠️ `dicethrone/domain/customActions/moon_elf.ts` (-36 行) - 需要检查
3. ⚠️ `dicethrone/domain/customActions/pyromancer.ts` (-29 行) - 需要检查
4. ⚠️ `dicethrone/heroes/barbarian/abilities.ts` (-22 行) - 需要检查
5. ⚠️ `dicethrone/heroes/pyromancer/abilities.ts` (-30 行) - 需要检查
6. ⚠️ `dicethrone/heroes/shadow_thief/abilities.ts` (-37 行) - 需要检查

### P4 文件（2 个）

7. ⚠️ `useEventStreamCursor.ts` (-91 行) - 需要检查删除的乐观引擎逻辑是否被使用
8. ⚠️ `index.css` (-34 行) - 需要检查移动端样式删除是否影响功能

---

## 用户的质疑是完全正确的

用户说："所有删除都已经恢复？没有把删除当清理代码？"

**答案**: ❌ 我确实把功能性删除误判为代码清理

**证据**: `addPermanentPower` 函数被删除，但：
- 当前 HEAD 中函数存在
- 有代码使用这个函数
- 我却判断为"代码重构"

这说明：
1. 我的审计方法论有严重问题
2. 我需要重新审计所有"需关注"的文件
3. 我需要更严格的判断标准

---

## 下一步行动

1. **立即重新审计剩余 7 个文件**
2. **对每个删除的函数/类型/常量**:
   - 检查当前 HEAD 状态
   - 搜索使用情况
   - 给出正确判断
3. **更新审计报告**，诚实承认错误

---

**发现时间**: 2026-03-04  
**发现人员**: AI Assistant  
**状态**: 🚨 需要立即重新审计
