# 大杀四方 - 计分后响应窗口实现完成

## 实现时间

2026-03-04

## 问题描述

用户反馈："我们乃最强"（`specialTiming: 'afterScoring'`）在计分**前**的 Me First! 窗口就可以打出，与卡牌描述"在一个基地**计分后**"不符，造成困惑。

## 用户建议

> "直接分两次响应阶段不好吗"

应该有两个独立的响应窗口：
1. **计分前响应窗口**（Before Scoring）：打出 `specialTiming: 'beforeScoring'` 的卡牌
2. **计分后响应窗口**（After Scoring）：打出 `specialTiming: 'afterScoring'` 的卡牌

## 实现方案

### 架构设计

采用两个独立的响应窗口：

```
1. 基地达到 breakpoint
2. 打开 Before Scoring 窗口（原 Me First!）
   - 玩家可以打出 specialTiming: 'beforeScoring' 的卡牌
   - 例如：承受压力、影舞者
3. 所有玩家 pass 后，开始计分
4. 基地计分完成（BASE_SCORED + BASE_CLEARED + BASE_REPLACED）
5. 打开 After Scoring 窗口
   - 玩家可以打出 specialTiming: 'afterScoring' 的卡牌
   - 例如：我们乃最强、重返深海
6. 所有玩家 pass 后，继续下一个基地或结束计分阶段
```

### 关键决策

1. **不延迟 BASE_CLEARED/BASE_REPLACED 事件**：
   - After Scoring 窗口在基地清除和替换**之后**打开
   - 这样 afterScoring 卡牌执行时，基地已经被清除，随从已经进入弃牌堆
   - 符合"计分后"的语义

2. **保留 ARMED 机制**：
   - ARMED 机制仍然存在，但不再主动使用
   - 作为向后兼容的备用方案
   - 未来可以考虑移除

3. **窗口类型重命名**：
   - `'meFirst'` → `'beforeScoring'`（更清晰的语义）
   - 新增 `'afterScoring'`

## 实现细节

### Phase 1: 验证逻辑（`commands.ts`）

```typescript
// Before Scoring 窗口：只能打出 beforeScoring 卡牌
if (responseWindow.windowType === 'beforeScoring' && cardTiming !== 'beforeScoring') {
    return { valid: false, error: '该卡牌只能在计分后打出' };
}

// After Scoring 窗口：只能打出 afterScoring 卡牌
if (responseWindow.windowType === 'afterScoring' && cardTiming !== 'afterScoring') {
    return { valid: false, error: '该卡牌只能在计分前打出' };
}
```

### Phase 2: 辅助函数（`abilityHelpers.ts`）

```typescript
// 打开 Before Scoring 窗口（原 Me First!）
export function openMeFirstWindow(...) {
    return {
        type: RESPONSE_WINDOW_EVENTS.OPENED,
        payload: {
            windowId: `beforeScoring_${triggerContext}_${now}`,
            windowType: 'beforeScoring' as const,
            ...
        },
    };
}

// 打开 After Scoring 窗口（新增）
export function openAfterScoringWindow(...) {
    return {
        type: RESPONSE_WINDOW_EVENTS.OPENED,
        payload: {
            windowId: `afterScoring_${triggerContext}_${now}`,
            windowType: 'afterScoring' as const,
            ...
        },
    };
}
```

### Phase 3: 计分流程（`index.ts` 的 `scoreOneBase`）

```typescript
// 1. beforeScoring 触发器
// 2. 基地能力 beforeScoring
// 3. 计算排名
// 4. BASE_SCORED
// 5. ARMED special 执行（如果有）
// 6. 基地能力 afterScoring
// 7. ongoing afterScoring 触发器

// 8. 检查是否有 afterScoring 交互
if (afterScoringCreatedInteraction) {
    // 延迟发出 BASE_CLEARED/BASE_REPLACED
    // 等交互解决后再发
    return { events, newBaseDeck, matchState: ms };
}

// 9. 发出 BASE_CLEARED + BASE_REPLACED
events.push(...postScoringEvents);

// 10. 检查是否有玩家有 afterScoring 卡牌
const playersWithAfterScoringCards = ...;

if (playersWithAfterScoringCards.length > 0) {
    // 打开 After Scoring 响应窗口
    const afterScoringWindowEvt = openAfterScoringWindow(...);
    events.push(afterScoringWindowEvt);
    return { events, newBaseDeck, matchState: ms };
}

// 11. 无 afterScoring 卡牌：正常返回
return { events, newBaseDeck, matchState: ms };
```

### Phase 4: 游戏配置（`game.ts`）

```typescript
createResponseWindowSystem<SmashUpCore>({
    responseAdvanceEvents: [
        { eventType: 'su:action_played', windowTypes: ['beforeScoring', 'afterScoring'] },
        { eventType: 'su:minion_played', windowTypes: ['beforeScoring'] },
    ],
    hasRespondableContent: (state, playerId, windowType) => {
        // 检查 specialTiming 是否匹配窗口类型
        const cardTiming = def.specialTiming ?? 'beforeScoring';
        if (windowType === 'beforeScoring' && cardTiming !== 'beforeScoring') return false;
        if (windowType === 'afterScoring' && cardTiming !== 'afterScoring') return false;
        ...
    },
}),
```

## 测试计划

### 单元测试（待更新）

需要更新所有测试文件中的 `'meFirst'` → `'beforeScoring'`：
- `src/games/smashup/__tests__/meFirst.test.ts`
- `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
- `src/games/smashup/__tests__/properties/coreProperties.test.ts`
- 等等（约 15 个文件）

### E2E 测试（待创建）

1. **基本流程测试**：
   - 基地计分后，打开 After Scoring 窗口
   - 玩家可以打出 `specialTiming: 'afterScoring'` 的卡牌
   - 玩家不能打出 `specialTiming: 'beforeScoring'` 的卡牌

2. **"我们乃最强"测试**：
   - 基地计分后，打开 After Scoring 窗口
   - 玩家打出"我们乃最强"
   - 选择转移指示物
   - 验证指示物正确转移

3. **多基地计分测试**：
   - 多个基地同时达标
   - 每个基地计分后都打开 After Scoring 窗口
   - 验证窗口顺序正确

## 优点

✅ 语义清晰：计分前打出计分前卡牌，计分后打出计分后卡牌
✅ 符合卡牌描述："在一个基地**计分后**"
✅ 用户体验更好：玩家可以根据计分结果决定是否打出 afterScoring 卡牌
✅ 架构清晰：两个独立的响应窗口，职责明确

## 缺点

❌ 需要更新大量测试文件（约 15 个）
❌ 增加了一个新的响应窗口，流程更复杂
❌ 需要处理多基地计分时的响应窗口顺序

## 后续工作

1. ✅ 核心逻辑实现完成
2. ⚠️ 测试更新（待完成）
3. ⚠️ E2E 测试（待创建）
4. ⚠️ 手动测试（待验证）

## 总结

已完成计分后响应窗口的核心实现，包括：
- 验证逻辑更新
- 辅助函数新增
- 计分流程修改
- 游戏配置更新

待完成测试更新和 E2E 测试验证。

预计剩余工作量：2-3 小时（测试更新）+ 1-2 小时（E2E 测试）= 3-5 小时。
