# 大杀四方 - 计分后重新计分规则

## 规则描述

用户反馈："计分后触发的，在计分后哪怕达不到临界值也要算分哦"

## 规则理解

### 当前理解

**afterScoring 卡牌在 BASE_SCORED 之后、BASE_CLEARED 之前执行**：

```
1. 基地达到 breakpoint
2. 打开 Before Scoring 窗口
   ├─ 玩家打出 beforeScoring 卡牌
   └─ 所有玩家 pass
3. 基地计分（BASE_SCORED）
   ├─ beforeScoring 触发器
   ├─ 基地能力 beforeScoring
   ├─ 计算排名
   └─ BASE_SCORED 事件
4. 打开 After Scoring 响应窗口
   ├─ 玩家打出 afterScoring 卡牌（如"我们乃最强"）
   ├─ 卡牌效果可能影响该基地的力量（转移指示物）
   └─ 所有玩家 pass
5. 检查基地力量是否变化
   ├─ 如果变化，重新计分该基地（即使没有达到临界值）
   └─ 如果没有变化，使用原计分结果
6. BASE_CLEARED + BASE_REPLACED
7. 继续下一个基地或结束计分阶段
```

### 关键点

1. **afterScoring 响应窗口在 BASE_CLEARED 之前打开**：
   - 此时基地还没有被清除
   - 随从还在基地上
   - 玩家可以看到基地上的随从并选择目标

2. **afterScoring 卡牌可以影响该基地的力量**：
   - 例如"我们乃最强"转移指示物
   - 转移后，基地上的力量分布可能改变

3. **力量变化后需要重新计分**：
   - 即使基地没有达到临界值，也要重新计分
   - 因为已经在计分流程中了，力量变化可能影响排名

4. **重新计分的结果替换原计分结果**：
   - 重新计算排名
   - 重新分配 VP
   - 发出新的 BASE_SCORED 事件（或更新原事件）

## 实现方案

### 方案 1：记录初始力量，响应窗口关闭后对比（推荐）

```typescript
// 在打开 afterScoring 响应窗口前，记录基地上每个玩家的力量
const initialPowers = new Map<PlayerId, number>();
for (const m of base.minions) {
    const prev = initialPowers.get(m.controller) ?? 0;
    initialPowers.set(m.controller, prev + getEffectivePower(core, m, baseIndex));
}

// 将初始力量存储到响应窗口的 continuationContext 中
// 响应窗口关闭后，在 onPhaseExit 中对比力量是否变化
```

### 方案 2：响应窗口关闭后总是重新计分（简单但可能不必要）

```typescript
// 响应窗口关闭后，总是重新计分该基地
// 优点：简单，不需要对比力量
// 缺点：即使力量没有变化也会重新计分，可能产生重复的 BASE_SCORED 事件
```

### 方案 3：使用事件驱动，监听力量变化事件（复杂）

```typescript
// 监听 POWER_COUNTER_ADDED/REMOVED 等事件
// 如果检测到力量变化，标记需要重新计分
// 优点：精确，只在真正变化时重新计分
// 缺点：复杂，需要追踪多种事件类型
```

## 推荐方案

**方案 1：记录初始力量，响应窗口关闭后对比**

### 实现步骤

1. **在 `scoreOneBase` 中打开 afterScoring 响应窗口前**：
   ```typescript
   // 记录初始力量
   const initialPowers = new Map<PlayerId, number>();
   for (const m of base.minions) {
       const prev = initialPowers.get(m.controller) ?? 0;
       initialPowers.set(m.controller, prev + getEffectivePower(core, m, baseIndex));
   }
   
   // 存储到 sys 状态中（用于响应窗口关闭后对比）
   // 注意：不能存到响应窗口的 continuationContext 中，因为响应窗口不是交互
   // 需要在 sys 中添加一个新字段：afterScoringInitialPowers
   ```

2. **在 `onPhaseExit` 中响应窗口关闭后**：
   ```typescript
   // 检查是否刚关闭了 afterScoring 响应窗口
   if (state.sys.afterScoringInitialPowers) {
       // 对比当前力量与初始力量
       const currentPowers = new Map<PlayerId, number>();
       for (const m of base.minions) {
           const prev = currentPowers.get(m.controller) ?? 0;
           currentPowers.set(m.controller, prev + getEffectivePower(core, m, baseIndex));
       }
       
       // 检查是否有变化
       let powerChanged = false;
       for (const [pid, initialPower] of state.sys.afterScoringInitialPowers.entries()) {
           const currentPower = currentPowers.get(pid) ?? 0;
           if (currentPower !== initialPower) {
               powerChanged = true;
               break;
           }
       }
       
       // 如果力量变化，重新计分
       if (powerChanged) {
           // 重新计算排名
           // 发出新的 BASE_SCORED 事件（或更新原事件）
       }
       
       // 清理状态
       state.sys.afterScoringInitialPowers = undefined;
   }
   ```

## 问题与疑问

### 问题 1：重新计分时是否需要重新触发 afterScoring 能力？

**答案**：不需要。afterScoring 能力只在第一次计分时触发一次。重新计分只是重新计算排名和分配 VP。

### 问题 2：重新计分时是否需要发出新的 BASE_SCORED 事件？

**答案**：需要。重新计分后，排名和 VP 可能改变，需要发出新的 BASE_SCORED 事件通知 UI 更新。

但是这样会导致一个问题：ActionLog 会显示两次计分结果。

**解决方案**：
- 方案 A：发出 BASE_SCORED_UPDATED 事件，表示计分结果更新
- 方案 B：发出新的 BASE_SCORED 事件，ActionLog 只显示最后一次
- 方案 C：不发出新事件，直接修改 core 中的 VP，ActionLog 显示第一次计分结果

**推荐**：方案 B，发出新的 BASE_SCORED 事件，ActionLog 只显示最后一次计分结果。

### 问题 3：如果多个基地同时计分，每个基地都有 afterScoring 响应窗口，如何处理？

**答案**：按顺序处理。每个基地计分后，打开 afterScoring 响应窗口，响应窗口关闭后检查是否需要重新计分，然后继续下一个基地。

## 待确认的规则细节

1. **afterScoring 卡牌是否可以影响其他基地？**
   - 例如"我们乃最强"可以转移指示物到其他基地的随从吗？
   - 如果可以，其他基地是否也需要重新计分？

2. **重新计分时是否需要重新触发 beforeScoring 能力？**
   - 应该不需要，beforeScoring 能力只在第一次计分前触发

3. **重新计分时是否需要重新打开 afterScoring 响应窗口？**
   - 应该不需要，afterScoring 响应窗口只打开一次

## 下一步工作

1. 确认规则细节（查阅官方规则书或 Wiki）
2. 实现方案 1（记录初始力量，响应窗口关闭后对比）
3. 添加重新计分逻辑
4. 创建 E2E 测试验证

## 总结

afterScoring 响应窗口应该在 BASE_SCORED 之后、BASE_CLEARED 之前打开，允许玩家打出 afterScoring 卡牌影响该基地的力量。响应窗口关闭后，检查力量是否变化，如果变化则重新计分该基地（即使没有达到临界值）。
