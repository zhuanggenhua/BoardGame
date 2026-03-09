# 交互处理器框架层 Bug

## 问题描述

交互处理器返回的 `state` 不会被应用到游戏状态。

## 受影响的卡牌

- card09 (伏击者) - ⏳ 待修复
- card13 (沼泽守卫) - ⏳ 待修复
- card14 (女导师) - ⏳ 待修复
- card15 (发明家) - ✅ 已修复

## 症状

- ✅ 能力激活成功
- ✅ 交互弹窗显示并完成选择
- ❌ 能力效果没有生效（如果依赖返回的 `state`）

## 根本原因

在 `CardiaEventSystem.afterEvents` 中，交互处理器返回的 `state` 不会被应用：

```typescript
// 在 systems.ts 中
if (handler) {
    const result = handler(newState, ...);
    
    if (result) {
        // ❌ result.state 不会被应用
        // 只有 result.events 会被应用
        for (const evt of result.events) {
            newState.core = reduce(newState.core, evt);
        }
    }
}
```

## 修复策略

所有受影响的卡牌都需要采用相同的修复策略：

### 1. 不要依赖返回的 `state`

**错误做法**：
```typescript
registerInteractionHandler(ABILITY_ID, (state, ...) => {
    return {
        state: {
            ...state,
            core: {
                ...state.core,
                someField: newValue,  // ❌ 这个修改不会生效
            },
        },
        events: [],
    };
});
```

**正确做法**：
```typescript
registerInteractionHandler(ABILITY_ID, (state, ...) => {
    return {
        state,  // 不修改 state
        events: [
            {
                type: 'SOME_EVENT',
                payload: { newValue },  // ✅ 通过事件修改状态
            },
        ],
    };
});
```

### 2. 通过事件修改状态

所有状态变更必须通过发射事件来完成：

1. **定义事件类型**（`events.ts`）
2. **添加 Reducer 函数**（`reduce.ts`）
3. **在交互处理器中发射事件**（`abilities/*.ts`）

### 3. 使用 core 字段存储待续状态

如果需要跨交互传递状态，使用 `core` 上的字段：

```typescript
// 在 core-types.ts 中定义
export interface CardiaCore {
    // ... 其他字段 ...
    inventorPending?: {
        playerId: PlayerId;
        timestamp: number;
    };
}

// 在交互处理器中使用
registerInteractionHandler(ABILITY_ID, (state, ...) => {
    const isFirstInteraction = !state.core.inventorPending;
    
    if (isFirstInteraction) {
        return {
            state,
            events: [
                // ... 其他事件 ...
                {
                    type: 'PENDING_SET',
                    payload: { playerId, timestamp },
                },
            ],
        };
    } else {
        return {
            state,
            events: [
                // ... 其他事件 ...
                {
                    type: 'PENDING_CLEARED',
                    payload: { playerId },
                },
            ],
        };
    }
});
```

## Card15 发明家修复示例

Card15 的修复是一个完整的示例，展示了如何正确处理这个框架层 bug。

### 修复步骤

1. **定义事件类型**（`events.ts`）：
   - `INVENTOR_PENDING_SET` - 设置待续标记
   - `INVENTOR_PENDING_CLEARED` - 清理待续标记

2. **添加 Reducer 函数**（`reduce.ts`）：
   - `reduceInventorPendingSet` - 设置 `core.inventorPending`
   - `reduceInventorPendingCleared` - 清理 `core.inventorPending`

3. **修改交互处理器**（`group2-modifiers.ts`）：
   - 第一次交互：发射 `MODIFIER_TOKEN_PLACED` + `INVENTOR_PENDING_SET`
   - 第二次交互：发射 `MODIFIER_TOKEN_PLACED` + `INVENTOR_PENDING_CLEARED`

4. **改进 CardiaEventSystem**（`systems.ts`）：
   - 追踪应用的事件（`appliedEvents`）
   - 检测 `INVENTOR_PENDING_SET` 事件
   - 自动创建第二次交互

详细修复内容见 `CARD15-BUG-FIX-COMPLETE.md`。

## 后续工作

### 1. 系统性审查

搜索所有 `registerInteractionHandler` 调用，检查每个处理器：

```bash
# 搜索所有交互处理器注册
grep -r "registerInteractionHandler" src/games/cardia/domain/
```

### 2. 识别受影响的卡牌

对于每个交互处理器，检查是否返回修改后的 `state`：

```typescript
// ❌ 受影响（返回修改后的 state）
registerInteractionHandler(ABILITY_ID, (state, ...) => {
    return {
        state: { ...state, core: { ...state.core, someField: newValue } },
        events: [],
    };
});

// ✅ 不受影响（只返回事件）
registerInteractionHandler(ABILITY_ID, (state, ...) => {
    return {
        state,
        events: [{ type: 'SOME_EVENT', payload: { newValue } }],
    };
});
```

### 3. 创建修复清单

创建一个清单文档，记录：
- 所有使用交互处理器的卡牌
- 每个卡牌是否受影响
- 修复状态（待修复/进行中/已完成）

### 4. 逐个修复

按照 Card15 的修复模式，逐个修复受影响的卡牌。

## 相关文件

- `src/games/cardia/domain/systems.ts` - CardiaEventSystem
- `src/games/cardia/domain/abilityInteractionHandlers.ts` - 交互处理器注册表
- `src/games/cardia/domain/abilities/group2-modifiers.ts` - Card15 修复示例
- `.kiro/specs/cardia-e2e-test-optimization/CARD15-BUG-FIX-COMPLETE.md` - 详细修复文档
- `.kiro/specs/cardia-e2e-test-optimization/CARD15-FINAL-SUMMARY.md` - 修复总结

## 测试文件

- `e2e/cardia-deck1-card09-ambusher.e2e.ts` - 伏击者测试
- `e2e/cardia-deck1-card13-swamp-guard.e2e.ts` - 沼泽守卫测试
- `e2e/cardia-deck1-card14-governess.e2e.ts` - 女导师测试
- `e2e/cardia-deck1-card15-inventor.e2e.ts` - 发明家测试（已修复）

---

**文档创建时间**：2025-01-XX  
**状态**：Card15 已修复，其他卡牌待修复
