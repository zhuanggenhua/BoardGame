# Cardia - 代码审查总结

**审查日期**：2026年2月26日  
**审查范围**：Phase 6.2 交互系统集成 + 全面代码审查  
**审查人**：Kiro AI Assistant

---

## 关键发现

### 🔴 P0 阻塞性问题（2个）

#### 1. sourceId 生成不一致 → 交互完全无法工作

**问题**：
- 创建交互时：`sourceId: ctx.sourceCardUid`（卡牌 UID）
- 注册处理器时：`discard_${ABILITY_IDS.APPRENTICE}`（能力 ID）
- 导致 `getInteractionHandler(sourceId)` 返回 `undefined`

**影响**：玩家选择后没有任何效果，交互系统完全失效

**修复**：统一使用 `discard_${ctx.abilityId}` 作为 sourceId

---

#### 2. E2E 测试无法运行

**问题**：
- E2E 测试使用了大量不存在的 `data-testid`
- Board.tsx 未添加这些测试标识符

**影响**：无法验证交互系统是否正常工作

**修复**：在 Board.tsx 中添加所有必需的 `data-testid`

---

### 🟡 P1 核心功能缺陷（3个）

#### 3. 交互 ID 使用 Date.now() 存在碰撞风险

**问题**：同一毫秒内多次调用会生成相同 ID

**修复**：使用 `ctx.sourceCardUid` 或计数器或 `nanoid`

---

#### 4. interactionData 传递链路可能丢失数据

**问题**：
- 创建时直接覆盖 `interaction.data`
- 解决时假设 `continuationContext` 存在

**修复**：使用合并而非覆盖，添加回退逻辑

---

#### 5. Board.tsx 未使用 calculateInfluence

**问题**：UI 直接显示 `card.baseInfluence`，未应用修正和持续效果

**影响**：玩家看到的影响力与实际计算不一致

**修复**：使用 `calculateInfluence(card, core)` 计算最终影响力

---

### 🟢 P2 用户体验/代码质量（3个）

6. executeDiscard 缺少空手牌边界检查
7. 交互处理器类型转换不安全（缺少运行时验证）
8. 混用 ES6 import 和 CommonJS require

---

## 修复建议

### 立即修复（P0）

```typescript
// 1. 修复 sourceId 不匹配
// abilityExecutor.ts
{
    sourceId: `discard_${ctx.abilityId}`,  // ✅ 与注册时一致
    multi: { min: count, max: count },
}

// 2. 添加 data-testid
// Board.tsx
<div data-testid="cardia-phase-indicator">
<div data-testid="cardia-hand-area">
<button data-testid="cardia-skip-ability-btn">
<button data-testid="cardia-end-turn-btn">
```

### 尽快修复（P1）

```typescript
// 3. 修复交互 ID 碰撞
const interaction = createSimpleChoice(
    `discard_${ctx.abilityId}_${ctx.sourceCardUid}`,  // ✅ 使用唯一标识
    // ...
);

// 4. 修复 interactionData 传递
if (payload.targetId) {
    payload.interaction.data = {
        ...payload.interaction.data,  // ✅ 合并而非覆盖
        continuationContext: {
            ...(payload.interaction.data?.continuationContext || {}),
            targetId: payload.targetId,
        },
    };
}

// 5. 修复 UI 影响力显示
const finalInfluence = calculateInfluence(card, core);
<div className="text-2xl font-bold text-white">{finalInfluence}</div>
```

---

## 测试状态

### 单元测试 ✅

- 34/34 测试通过
- 覆盖 validate, execute, reduce 三层

### E2E 测试 ❌

- 无法运行（缺少 data-testid）
- 需要修复后重新测试

### 测试缺口

1. 交互能力未测试（7个能力）
2. 边界情况未测试（空手牌、空弃牌堆）
3. 错误处理未测试（无效 value 格式）

---

## 架构评估

### ✅ 优点

1. 事件驱动架构清晰
2. 注册表模式易于扩展
3. 职责分明（executor → handler）
4. 遵循项目规范

### ⚠️ 缺陷

1. sourceId 契约不一致（P0）
2. UI 层未使用正确的查询函数（P1）
3. 边界检查不完整（P2）
4. 类型安全性不足（P2）

---

## 下一步行动

### ✅ 必须完成（阻塞发布）- 已完成

1. ✅ 修复 sourceId 不匹配（问题 2）- Phase 6.3 完成
2. ✅ 添加 data-testid（问题 8）- Phase 6.3 UI Fixes 完成
3. ⏳ 运行 E2E 测试验证交互功能 - 待 Phase 6.4

### ✅ 应该完成（影响体验）- 已完成

1. ✅ 修复交互 ID 碰撞（问题 1）- Phase 6.3 完成
2. ✅ 修复 interactionData 传递（问题 4）- Phase 6.3 完成
3. ✅ 修复 UI 影响力显示（问题 7）- Phase 6.3 UI Fixes 完成
4. ⏳ 补充交互能力单元测试 - 待 Phase 6.4

### 可以延后（优化改进）

1. 完善边界检查（问题 3）
2. 提升类型安全（问题 5）
3. 统一 import 方式（问题 6）
4. 清理未使用代码（优化 1）
5. 提取重复逻辑（优化 2）
6. 补充文档（优化 3）

---

## 总结

Phase 6.2 交互系统的架构设计良好，**所有 P0 和 P1 问题已在 Phase 6.3 修复完成**：

### ✅ 已修复（Phase 6.3）
1. **sourceId 不匹配**：统一使用 `${action}_${abilityId}` 模式
2. **交互 ID 碰撞**：改用语义化 ID `${action}_${abilityId}_${sourceCardUid}`
3. **interactionData 传递**：改用合并模式，添加 targetId 回退
4. **E2E 测试 data-testid**：添加所有必需的测试标识符
5. **UI 影响力显示**：使用 `calculateInfluence()` 计算最终影响力

### ⏳ 待完成（Phase 6.4）
- 运行 E2E 测试验证交互功能
- 补充交互能力单元测试
- 处理 P2 优化问题（可选）

所有单元测试通过（34/34），代码质量良好，可以进入 E2E 测试阶段。

---

**审查完成时间**：2026年2月26日 21:45  
**修复完成时间**：2026年2月26日 21:44  
**详细报告**：`CODE-REVIEW-REPORT.md`  
**修复报告**：`PHASE6.3-FIXES-COMPLETE.md`, `PHASE6.3-UI-FIXES-COMPLETE.md`
