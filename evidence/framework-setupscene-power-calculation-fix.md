# E2E 框架 setupScene 力量计算修复

## 问题描述

在 E2E 测试框架的 `setupScene` 函数中，当设置 `phase: 'scoreBases'` 时，需要自动计算 `scoringEligibleBaseIndices`（达到临界点的基地索引）。但力量计算逻辑有 bug，导致基地总力量计算错误，`scoringEligibleBaseIndices` 为空。

## 根本原因

### 错误的力量计算

**位置**：`e2e/framework/GameTestContext.ts` 第 ~620 行

**原代码**：
```typescript
const totalPower = base.minions.reduce((sum: number, m: any) => {
    return sum + (m.power || m.basePower || 0) + (m.powerCounters || 0);
}, 0);
```

**问题**：
1. `buildMinion` 函数构建的随从对象**没有 `power` 字段**
2. 随从对象只有以下字段：
   - `basePower`：基础力量
   - `powerCounters`：力量指示物
   - `powerModifier`：永久力量修正
   - `tempPowerModifier`：临时力量修正
3. 原代码只计算了 `basePower` 和 `powerCounters`，遗漏了 `powerModifier` 和 `tempPowerModifier`

### buildMinion 的实现

**位置**：`e2e/framework/GameTestContext.ts` 第 ~460 行

```typescript
const buildMinion = (minion: SmashUpMinionSceneConfig, ownerId: string, index: number) => {
    const basePower = minion.basePower ?? minion.power ?? 1;
    const builtMinion: any = {
        uid: minion.uid ?? generateUid(minion.defId, index),
        defId: minion.defId,
        owner: minion.owner ?? ownerId,
        controller: minion.controller ?? minion.owner ?? ownerId,
        basePower,  // ← 存储为 basePower，不是 power
        powerCounters: minion.powerCounters ?? 0,
        powerModifier: minion.powerModifier ?? 0,
        tempPowerModifier: minion.tempPowerModifier ?? 0,
        talentUsed: minion.talentUsed ?? false,
        attachedActions: ...,
    };
    return builtMinion;
};
```

**关键点**：
- 输入配置可以使用 `power` 或 `basePower` 字段
- 但输出对象**只有 `basePower` 字段**，没有 `power` 字段
- 因此力量计算不能依赖 `m.power`

## 修复方案

### 正确的力量计算

```typescript
// 计算基地总力量
// minion 的总力量 = basePower + powerCounters + powerModifier + tempPowerModifier
const totalPower = base.minions.reduce((sum: number, m: any) => {
    const minionPower = (m.basePower || 0) + 
                       (m.powerCounters || 0) + 
                       (m.powerModifier || 0) + 
                       (m.tempPowerModifier || 0);
    return sum + minionPower;
}, 0);
```

### 修改文件

- `e2e/framework/GameTestContext.ts`：
  - `setupScene` 函数中的力量计算逻辑（第 ~620 行）

## 影响范围

### 受益场景

所有使用 `setupScene` 设置 `phase: 'scoreBases'` 的 E2E 测试：

1. **响应窗口测试**：
   - 测试 Me First! 窗口的打开和关闭
   - 测试响应窗口中的交互失败场景
   - 测试响应窗口的推进逻辑

2. **计分测试**：
   - 测试基地计分逻辑
   - 测试 beforeScoring/afterScoring 能力
   - 测试计分后的状态变更

3. **复杂场景测试**：
   - 测试多基地同时计分
   - 测试计分时的交互链
   - 测试计分时的响应窗口

### 行为变化

**修复前**：
- `scoringEligibleBaseIndices` 计算错误（可能为空）
- 测试场景无法正确设置计分阶段
- 依赖计分阶段的测试失败

**修复后**：
- `scoringEligibleBaseIndices` 正确计算（包含所有达到临界点的基地）
- 测试场景可以正确设置计分阶段
- 计分相关测试可以正常运行

## 测试验证

### 修复验证

运行响应窗口测试：
```bash
npm run test -- response-window-skip.test.ts
```

**结果**：
- ✅ `重新开始一轮时应跳过没有可响应内容的玩家` - 通过
- ✅ `所有玩家都没有可响应内容时应立即关闭窗口` - 通过
- ❌ `交互失败时应解锁但不推进（当前响应者继续响应）` - 仍然失败（但失败原因已变化）

**新的失败原因**：
- `scoringEligibleBaseIndices` 现在可以正确计算
- 但交互解决后仍然存在（不是 `undefined`）
- 这是交互处理器的问题，不是 `setupScene` 的问题

## 后续工作

### 剩余问题

1. **交互解决逻辑**：
   - `GameTestRunner` 中交互解决的行为需要验证
   - `handleUnderPressureChooseSource` 是否正确返回 `ABILITY_FEEDBACK`
   - 交互队列的处理是否正确

2. **测试策略**：
   - 考虑将单元测试改为 E2E 测试
   - E2E 测试可以更真实地模拟用户操作
   - E2E 测试可以验证 UI 交互和状态变更

### 长期优化

1. **类型安全**：
   - 为 `buildMinion` 的返回类型添加明确的类型定义
   - 避免使用 `any` 类型
   - 确保力量计算逻辑与类型定义一致

2. **文档完善**：
   - 在 `setupScene` 的 JSDoc 中说明力量计算逻辑
   - 在 `buildMinion` 的 JSDoc 中说明字段映射规则
   - 添加示例代码展示如何正确设置随从力量

## 总结

修复了 E2E 框架 `setupScene` 中的力量计算 bug：

- **问题**：只计算 `basePower` 和 `powerCounters`，遗漏 `powerModifier` 和 `tempPowerModifier`
- **修复**：正确计算总力量 = `basePower + powerCounters + powerModifier + tempPowerModifier`
- **影响**：所有使用 `setupScene` 设置计分阶段的测试现在可以正确计算 `scoringEligibleBaseIndices`

这是一个**框架层修复**，适用于所有游戏的所有计分场景测试。
