# DiceThrone 交互系统迁移 - 设计文档

## 1. 架构设计

### 1.1 核心原则

1. **单一数据源**：交互状态只存在于 `sys.interaction`
2. **引擎层管理**：生命周期由 `InteractionSystem` 自动管理
3. **声明式配置**：交互通过配置对象创建，不需要手动管理状态
4. **类型安全**：所有交互类型都有完整的 TypeScript 类型定义

### 1.2 数据流

```
┌─────────────┐
│   execute   │ 调用 createInteraction()
└──────┬──────┘
       │ 返回 INTERACTION_REQUESTED 事件
       ▼
┌─────────────┐
│   reducer   │ 写入 sys.interaction
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ InteractionSys  │ 自动管理状态
└──────┬──────────┘
       │
       ▼
┌─────────────┐
│     UI      │ 读取并渲染
└──────┬──────┘
       │ dispatch(RESPOND, { data })
       ▼
┌─────────────────┐
│ InteractionSys  │ 调用 onResolve(data)
└──────┬──────────┘
       │ 生成后续事件
       ▼
┌─────────────┐
│   reducer   │ 应用事件
└─────────────┘
```

---

## 2. 交互工厂设计

### 2.1 工厂函数签名

```typescript
// 选择玩家
function createSelectPlayerInteraction(config: {
    playerId: string;           // 发起交互的玩家
    sourceAbilityId: string;    // 来源技能/卡牌 ID
    count: number;              // 选择数量
    targetPlayerIds?: string[]; // 可选目标（默认所有玩家）
    onResolve: (selectedPlayerIds: string[]) => DiceThroneEvent[];
}): InteractionRequestedEvent;

// 选择骰子
function createSelectDieInteraction(config: {
    playerId: string;
    sourceAbilityId: string;
    count: number;
    allowedDiceIds?: number[];
    onResolve: (selectedDiceIds: number[]) => DiceThroneEvent[];
}): InteractionRequestedEvent;

// 修改骰子
function createModifyDieInteraction(config: {
    playerId: string;
    sourceAbilityId: string;
    dieId: number;
    allowedValues: number[];
    onResolve: (newValue: number) => DiceThroneEvent[];
}): InteractionRequestedEvent;

// 选择状态
function createSelectStatusInteraction(config: {
    playerId: string;
    sourceAbilityId: string;
    targetPlayerIds?: string[];
    filter?: (statusId: string) => boolean;
    onResolve: (selection: { playerId: string; statusId: string }) => DiceThroneEvent[];
}): InteractionRequestedEvent;

// 转移状态
function createTransferStatusInteraction(config: {
    playerId: string;
    sourceAbilityId: string;
    sourcePlayerId: string;
    statusId: string;
    onResolve: (targetPlayerId: string) => DiceThroneEvent[];
}): InteractionRequestedEvent;
```

### 2.2 使用示例

```typescript
// ✅ 新实现：圣骑士复仇 II
function handleVengeanceSelectPlayer(ctx: CustomActionContext): DiceThroneEvent[] {
    return [createSelectPlayerInteraction({
        playerId: ctx.targetId,
        sourceAbilityId: ctx.sourceAbilityId,
        count: 1,
        onResolve: ([targetPlayerId]) => [{
            type: 'TOKEN_GRANTED',
            payload: {
                targetId: targetPlayerId,
                tokenId: TOKEN_IDS.RETRIBUTION,
                amount: 1,
                newTotal: (ctx.state.players[targetPlayerId]?.tokens[TOKEN_IDS.RETRIBUTION] ?? 0) + 1,
                sourceAbilityId: ctx.sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: ctx.timestamp,
        }]
    })];
}
```


---

## 3. UI 层设计

### 3.1 统一交互组件

```typescript
// 新增：统一的交互 Modal
<InteractionModal
    interaction={sys.interaction.current}
    players={G.players}
    dice={G.dice}
    onRespond={(data) => dispatch(INTERACTION_COMMANDS.RESPOND, { data })}
    onCancel={() => dispatch(INTERACTION_COMMANDS.CANCEL)}
/>
```

### 3.2 交互类型映射

| 交互类型 | UI 组件 | 用户操作 | 返回数据 |
|---------|---------|---------|---------|
| `selectPlayer` | 玩家卡片列表 | 点击选择 | `string[]` |
| `selectDie` | 骰子高亮 | 点击选择 | `number[]` |
| `modifyDie` | 骰面选择器 | 点击骰面 | `number` |
| `selectStatus` | 状态图标列表 | 点击选择 | `{ playerId, statusId }` |
| `transferStatus` | 玩家卡片列表 | 点击选择 | `string` |

---

## 4. 迁移映射表

### 4.1 Custom Actions 迁移

| 文件 | 函数 | 当前实现 | 新实现 |
|------|------|---------|--------|
| `paladin.ts` | `handleVengeanceSelectPlayer` | `PendingInteraction` + `tokenGrantConfig` | `createSelectPlayerInteraction` |
| `paladin.ts` | `handleConsecrate` | `PendingInteraction` + `tokenGrantConfigs` | `createSelectPlayerInteraction` |
| `monk.ts` | 各种骰子交互 | `PendingInteraction` + `selectDie` | `createSelectDieInteraction` |
| `pyromancer.ts` | 骰子修改 | `PendingInteraction` + `modifyDie` | `createModifyDieInteraction` |
| `shadow_thief.ts` | 状态转移 | `PendingInteraction` + `transferConfig` | `createTransferStatusInteraction` |

### 4.2 卡牌迁移（部分示例）

| 卡牌 | 当前交互类型 | 新工厂函数 |
|------|-------------|-----------|
| 强制重投 | `selectDie` | `createSelectDieInteraction` |
| 净化 | `selectStatus` | `createSelectStatusInteraction` |
| 转移诅咒 | `transferStatus` | `createTransferStatusInteraction` |
| 修改骰面 | `modifyDie` | `createModifyDieInteraction` |

---

## 5. 删除清单

### 5.1 类型定义（`types.ts`）

```typescript
// ❌ 删除
export interface PendingInteraction {
    id: string;
    playerId: string;
    sourceCardId: string;
    type: 'selectDie' | 'modifyDie' | 'selectStatus' | 'selectPlayer' | 'selectTargetStatus';
    titleKey: string;
    selectCount: number;
    selected: (string | number)[];
    // ... 其他字段
}
```

### 5.2 命令定义（`commands.ts`）

```typescript
// ❌ 删除
export interface ConfirmInteractionCommand extends BaseCommand {
    type: 'CONFIRM_INTERACTION';
    payload: {
        interactionId: string;
        selectedDiceIds?: number[];
        selectedPlayerId?: PlayerId;
    };
}

export interface CancelInteractionCommand extends BaseCommand {
    type: 'CANCEL_INTERACTION';
}
```

### 5.3 事件定义（`events.ts`）

```typescript
// ❌ 删除
export interface InteractionRequestedEvent extends BaseEvent {
    type: 'INTERACTION_REQUESTED';
    payload: { interaction: PendingInteraction };
}

export interface InteractionCompletedEvent extends BaseEvent {
    type: 'INTERACTION_COMPLETED';
    payload: { interactionId: string; sourceCardId: string };
}

export interface InteractionCancelledEvent extends BaseEvent {
    type: 'INTERACTION_CANCELLED';
    payload: { interactionId: string; sourceCardId: string; cpCost: number; playerId: string };
}
```

### 5.4 Execute 逻辑（`execute.ts`）

```typescript
// ❌ 删除整个 case 分支（约 150 行）
case 'CONFIRM_INTERACTION': {
    // ... 所有交互确认逻辑
}

case 'CANCEL_INTERACTION': {
    // ... 所有交互取消逻辑
}
```

### 5.5 Reducer 逻辑（`reducer.ts`）

```typescript
// ❌ 删除
case 'INTERACTION_REQUESTED': {
    // ... 写入 core.pendingInteraction
}

case 'INTERACTION_COMPLETED': {
    // ... 清理 core.pendingInteraction
}

case 'INTERACTION_CANCELLED': {
    // ... 清理 core.pendingInteraction + 退还 CP
}
```

### 5.6 UI 层（`Board.tsx`）

```typescript
// ❌ 删除（约 100 行）
const handleStatusInteractionConfirm = () => {
    // ... 复杂的交互确认逻辑
};

const statusInteraction = React.useMemo(() => {
    // ... 复杂的交互状态计算
}, [pendingInteraction, localInteraction]);
```

### 5.7 Hooks（`useInteractionState.ts`）

```typescript
// ❌ 可能整个文件删除（约 80 行）
export function useInteractionState(pendingInteraction?: PendingInteraction) {
    // ... 本地交互状态管理
}
```

---

## 6. 实现细节

### 6.1 交互工厂实现

```typescript
// src/games/dicethrone/domain/interactions/factory.ts

import { INTERACTION_COMMANDS } from '../../../../engine/systems/InteractionSystem';
import type { DiceThroneEvent } from '../types';

export function createSelectPlayerInteraction(config: {
    playerId: string;
    sourceAbilityId: string;
    count: number;
    targetPlayerIds?: string[];
    onResolve: (selectedPlayerIds: string[]) => DiceThroneEvent[];
}): DiceThroneEvent {
    return {
        type: 'INTERACTION_REQUESTED',
        payload: {
            kind: 'dt:select-player',
            playerId: config.playerId,
            sourceId: config.sourceAbilityId,
            data: {
                count: config.count,
                targetPlayerIds: config.targetPlayerIds,
            },
            onResolve: (response: { selectedPlayerIds: string[] }) => {
                return config.onResolve(response.selectedPlayerIds);
            },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: Date.now(),
    };
}
```

### 6.2 UI 层简化

```typescript
// src/games/dicethrone/Board.tsx

// ✅ 简化后的交互处理
const currentInteraction = rawG.sys.interaction?.current;

// 渲染
{currentInteraction && (
    <InteractionModal
        interaction={currentInteraction}
        players={G.players}
        dice={G.dice}
        onRespond={(data) => dispatch(INTERACTION_COMMANDS.RESPOND, { data })}
        onCancel={() => dispatch(INTERACTION_COMMANDS.CANCEL)}
    />
)}
```

---

## 7. 测试策略

### 7.1 单元测试

```typescript
// src/games/dicethrone/domain/interactions/__tests__/factory.test.ts

describe('createSelectPlayerInteraction', () => {
    it('should create interaction with correct structure', () => {
        const event = createSelectPlayerInteraction({
            playerId: '0',
            sourceAbilityId: 'vengeance-2',
            count: 1,
            onResolve: (ids) => [],
        });

        expect(event.type).toBe('INTERACTION_REQUESTED');
        expect(event.payload.kind).toBe('dt:select-player');
        expect(event.payload.data.count).toBe(1);
    });

    it('should call onResolve with selected player IDs', () => {
        const onResolve = jest.fn(() => []);
        const event = createSelectPlayerInteraction({
            playerId: '0',
            sourceAbilityId: 'vengeance-2',
            count: 1,
            onResolve,
        });

        event.payload.onResolve({ selectedPlayerIds: ['1'] });
        expect(onResolve).toHaveBeenCalledWith(['1']);
    });
});
```

### 7.2 E2E 测试验证

所有现有 E2E 测试应该无需修改即可通过：
- `e2e/dicethrone-paladin-vengeance-select-player.e2e.ts`
- `e2e/dicethrone-monk-dice-interaction.e2e.ts`
- `e2e/dicethrone-pyromancer-modify-die.e2e.ts`
- 等等

---

## 8. 性能优化

### 8.1 避免重复渲染

```typescript
// ✅ 使用 useMemo 缓存交互配置
const interactionConfig = React.useMemo(() => {
    if (!currentInteraction) return null;
    return parseInteractionConfig(currentInteraction);
}, [currentInteraction]);
```

### 8.2 延迟加载

```typescript
// ✅ 交互 Modal 使用 React.lazy
const InteractionModal = React.lazy(() => import('./InteractionModal'));
```

---

## 9. 回滚计划

如果迁移过程中发现严重问题，可以按以下步骤回滚：

1. **立即回滚**：`git reset --hard <commit-before-migration>`
2. **保留部分改动**：`git revert <commit-range>`
3. **分阶段回滚**：先回滚 UI 层，再回滚领域层

---

## 10. 后续优化

迁移完成后，可以进一步优化：

1. **统一 UI 风格**：所有交互使用相同的视觉风格
2. **交互动画**：添加淡入淡出动画
3. **交互历史**：记录交互历史用于回放
4. **交互预览**：在确认前预览效果
5. **交互撤销**：支持撤销交互操作

---

## 11. 正确性属性

### 11.1 核心不变量

1. **单一交互**：任意时刻最多只有一个活跃交互
2. **状态一致性**：`sys.interaction.current` 与 UI 显示一致
3. **生命周期完整**：每个交互必须被 resolve 或 cancel
4. **事件顺序**：交互解决后的事件按正确顺序执行

### 11.2 测试属性

```typescript
// Property 1: 交互创建后必须出现在 sys.interaction
property('interaction appears in sys after creation', () => {
    const state = createInitialState();
    const event = createSelectPlayerInteraction({...});
    const newState = reduce(state, event);
    
    assert(newState.sys.interaction.current !== null);
});

// Property 2: 交互解决后必须清理
property('interaction clears after resolve', () => {
    const state = createStateWithInteraction();
    dispatch(INTERACTION_COMMANDS.RESPOND, { data: {...} });
    
    assert(state.sys.interaction.current === null);
});
```

---

## 12. 文档更新

迁移完成后需要更新以下文档：

1. `docs/ai-rules/engine-systems.md` - 更新交互系统说明
2. `docs/framework/interaction-system.md` - 新增 DiceThrone 交互示例
3. `AGENTS.md` - 更新"禁止在 core 中存放交互状态"规则
4. 游戏规则文档 - 无需更新（不影响规则）

---

## 13. 总结

### 13.1 关键改进

1. **代码量减少**：净减少 ~300 行代码
2. **复杂度降低**：数据流从 6 步简化为 3 步
3. **可维护性提升**：新增交互只需修改 1 个文件
4. **类型安全**：完整的 TypeScript 类型支持

### 13.2 风险控制

1. **渐进式迁移**：按阶段迁移，每个阶段都可独立验证
2. **测试覆盖**：单元测试 + E2E 测试双重保障
3. **回滚机制**：Git 版本控制，随时可回滚

### 13.3 长期价值

1. **统一架构**：所有游戏使用相同的交互模式
2. **易于扩展**：新增交互类型只需添加工厂函数
3. **降低门槛**：新开发者更容易理解和使用
