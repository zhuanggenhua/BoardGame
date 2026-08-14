# Smash Up Prompt 系统迁移到 InteractionSystem - 设计文档

## 1. 概述

本设计文档描述如何将 Smash Up 游戏的自定义 Prompt 系统迁移到引擎标准的 InteractionSystem。当前实现使用了事件桥接模式（`CHOICE_REQUESTED` 事件 → InteractionSystem），这是一个反模式，需要重构为直接在能力执行器中调用 InteractionSystem API。

### 1.1 当前架构问题

**反模式识别**：
- 能力执行器生成 `CHOICE_REQUESTED` 事件
- `SmashUpEventSystem` 监听该事件并创建 Interaction
- 使用 `promptContinuation.ts` 注册表管理继续函数
- 交互解决后，系统再次监听 `SYS_INTERACTION_RESOLVED` 事件并调用继续函数

**违反的设计原则**（来自 AGENTS.md）：
> **禁止写桥接系统**：不得创建"游戏事件→创建 Prompt/Interaction→解决后转回游戏事件"的桥接系统，应在 execute 中直接调用 `createSimpleChoice()` / `createInteraction()`。

### 1.2 目标架构

**标准模式**：
- 能力执行器直接调用 `createSimpleChoice()` 创建交互
- 能力执行器直接调用 `queueInteraction()` 将交互加入队列
- 继续逻辑内联到能力执行器中，通过监听 `SYS_INTERACTION_RESOLVED` 事件执行

**优势**：
- 代码更简洁，减少约 100+ 行桥接代码
- 符合引擎规范，与其他游戏一致
- 更易维护，逻辑集中在能力执行器中
- 消除注册表，减少全局状态

## 2. 架构设计

### 2.1 数据流对比

**当前流程（反模式）**：
```
能力执行器 
  → 生成 CHOICE_REQUESTED 事件
  → SmashUpEventSystem 监听事件
  → 创建 Interaction 并 queueInteraction
  → 玩家选择
  → SYS_INTERACTION_RESOLVED 事件
  → SmashUpEventSystem 监听事件
  → 查找 promptContinuation 注册表
  → 调用继续函数
  → 生成后续事件
```

**目标流程（标准模式）**：
```
能力执行器
  → 直接调用 createSimpleChoice()
  → 直接调用 queueInteraction()
  → 返回空事件数组（等待交互）
  
能力执行器（监听 SYS_INTERACTION_RESOLVED）
  → 检查 sourceId 是否匹配
  → 提取选择值
  → 生成后续事件
```

### 2.2 核心变更

#### 2.2.1 移除的组件

1. **promptContinuation.ts**
   - `registerPromptContinuation()` 函数
   - `resolvePromptContinuation()` 函数
   - `PromptContinuationFn` 类型
   - `PromptContinuationCtx` 类型

2. **systems.ts 中的桥接逻辑**
   - 监听 `CHOICE_REQUESTED` 的代码
   - 监听 `SYS_INTERACTION_RESOLVED` 并调用继续函数的代码
   - `SmashUpContinuationData` 接口

3. **types.ts 中的事件类型**
   - `CHOICE_REQUESTED` 事件常量
   - `ChoiceRequestedEvent` 接口

#### 2.2.2 保留的组件

1. **InteractionSystem**（引擎层）
   - `createSimpleChoice()` - 创建交互
   - `queueInteraction()` - 加入队列
   - `asSimpleChoice()` - UI 辅助函数
   - `SYS_INTERACTION_RESOLVED` 事件

2. **UI 组件**
   - `InteractionPanel.tsx` - 无需修改
   - `asSimpleChoice()` 辅助函数保持兼容

3. **辅助函数**
   - `requestChoice()` - 需要重构实现
   - 其他 `abilityHelpers.ts` 中的函数

### 2.3 能力执行器重构模式

#### 2.3.1 简单选择模式

**当前实现**：
```typescript
// 能力执行器
export function executeZombieGraveDigger(ctx: AbilityExecuteContext): SmashUpEvent[] {
    const discardMinions = player.discard.filter(/* ... */);
    
    if (discardMinions.length === 1) {
        // 单个目标：直接执行
        return [recoverCardsFromDiscard(/* ... */)];
    }
    
    // 多个目标：生成 CHOICE_REQUESTED 事件
    return [requestChoice(/* ... */)];
}

// 注册继续函数
registerPromptContinuation('zombie_grave_digger', (ctx) => {
    const { cardUid } = ctx.selectedValue;
    return [recoverCardsFromDiscard(/* ... */)];
});
```

**目标实现**：
```typescript
// 能力执行器（直接创建交互）
export function executeZombieGraveDigger(ctx: AbilityExecuteContext): SmashUpEvent[] {
    const discardMinions = player.discard.filter(/* ... */);
    
    if (discardMinions.length === 1) {
        // 单个目标：直接执行
        return [recoverCardsFromDiscard(/* ... */)];
    }
    
    // 多个目标：直接创建交互
    const interaction = createSimpleChoice(
        `zombie_grave_digger_${ctx.timestamp}`,
        ctx.playerId,
        '选择要取回的随从',
        discardMinions.map(c => ({ id: c.uid, label: getCardName(c.defId), value: { cardUid: c.uid } })),
        'zombie_grave_digger'
    );
    
    ctx.state = queueInteraction(ctx.state, interaction);
    return []; // 等待交互解决
}

// 能力执行器（监听交互解决）
export function onZombieGraveDiggerResolved(
    state: SmashUpCore,
    event: GameEvent,
    playerId: PlayerId,
    timestamp: number
): SmashUpEvent[] {
    const payload = event.payload as { sourceId?: string; value: { cardUid: string } };
    if (payload.sourceId !== 'zombie_grave_digger') return [];
    
    const { cardUid } = payload.value;
    return [recoverCardsFromDiscard(playerId, [cardUid], 'zombie_grave_digger', timestamp)];
}
```

#### 2.3.2 多步选择模式

某些能力需要多步选择（如僵尸领主：先选随从，再选基地）。

**当前实现**：
```typescript
// 第一步：选择随从
registerPromptContinuation('zombie_lord_choose_minion', (ctx) => {
    const { cardUid, defId, power } = ctx.selectedValue;
    const data = ctx.data; // 包含 emptyBases
    
    // 生成第二步选择事件
    return [requestChoice({
        abilityId: 'zombie_lord_choose_base',
        continuationContext: { cardUid, defId, power, remainingSlots: data.remainingSlots - 1 }
    })];
});

// 第二步：选择基地
registerPromptContinuation('zombie_lord_choose_base', (ctx) => {
    const { baseIndex } = ctx.selectedValue;
    const data = ctx.data; // 包含 cardUid, defId, power
    
    return [/* 放置随从事件 */];
});
```

**目标实现**：
```typescript
// 能力执行器（第一步）
export function executeZombieLord(ctx: AbilityExecuteContext): SmashUpEvent[] {
    const discardMinions = /* ... */;
    
    const interaction = createSimpleChoice(
        `zombie_lord_minion_${ctx.timestamp}`,
        ctx.playerId,
        '选择要复活的随从',
        discardMinions.map(/* ... */),
        'zombie_lord_minion'
    );
    
    ctx.state = queueInteraction(ctx.state, interaction);
    return [];
}

// 监听第一步解决（生成第二步）
export function onZombieLordMinionResolved(
    state: SmashUpCore,
    event: GameEvent,
    playerId: PlayerId,
    timestamp: number,
    matchState: MatchState<SmashUpCore> // 需要访问 matchState 以调用 queueInteraction
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const payload = event.payload as { sourceId?: string; value: { cardUid: string; defId: string; power: number } };
    if (payload.sourceId !== 'zombie_lord_minion') return { state: matchState, events: [] };
    
    const { cardUid, defId, power } = payload.value;
    const emptyBases = /* 计算空基地 */;
    
    // 创建第二步交互
    const interaction = createSimpleChoice(
        `zombie_lord_base_${timestamp}`,
        playerId,
        '选择放置基地',
        emptyBases.map(/* ... */),
        'zombie_lord_base'
    );
    
    // 将选择上下文存储在 interaction.data 中
    const extendedInteraction = {
        ...interaction,
        data: {
            ...interaction.data,
            context: { cardUid, defId, power }
        }
    };
    
    const newState = queueInteraction(matchState, extendedInteraction);
    return { state: newState, events: [] };
}

// 监听第二步解决（执行最终逻辑）
export function onZombieLordBaseResolved(
    state: SmashUpCore,
    event: GameEvent,
    playerId: PlayerId,
    timestamp: number
): SmashUpEvent[] {
    const payload = event.payload as { 
        sourceId?: string; 
        value: { baseIndex: number };
        interactionData: { context: { cardUid: string; defId: string; power: number } }
    };
    if (payload.sourceId !== 'zombie_lord_base') return [];
    
    const { baseIndex } = payload.value;
    const { cardUid, defId, power } = payload.interactionData.context;
    
    return [/* 放置随从事件 */];
}
```

### 2.4 命令执行流程调整

#### 2.4.1 当前问题

能力执行器在 `execute.ts` 中被调用，但无法直接修改 `MatchState`（只能返回事件）。而 `queueInteraction()` 需要修改 `MatchState.sys.interaction`。

#### 2.4.2 解决方案

**方案 A：在 execute.ts 中调用 queueInteraction**

在 `execute.ts` 的命令处理函数中，能力执行器返回一个特殊标记，表示需要创建交互。然后在 `execute.ts` 中统一调用 `queueInteraction()`。

```typescript
// execute.ts
export function executePlayAction(
    state: MatchState<SmashUpCore>,
    command: PlayActionCommand,
    random: RandomFn
): HookResult<SmashUpCore> {
    // ... 验证逻辑 ...
    
    const ctx: AbilityExecuteContext = {
        state: state.core,
        matchState: state, // 传递完整 matchState
        playerId: command.playerId,
        timestamp: /* ... */,
        random
    };
    
    const result = executeAbility(ctx, cardDef.id, /* ... */);
    
    // 如果能力创建了交互，更新 matchState
    let newState = state;
    if (result.interaction) {
        newState = queueInteraction(newState, result.interaction);
    }
    
    return {
        state: { ...newState, core: result.core },
        events: result.events
    };
}
```

**方案 B：能力执行器直接访问 matchState**

修改 `AbilityExecuteContext` 以包含 `matchState`，能力执行器可以直接调用 `queueInteraction()` 并返回更新后的 `matchState`。

```typescript
export interface AbilityExecuteContext {
    state: SmashUpCore;
    matchState: MatchState<SmashUpCore>; // 新增
    playerId: PlayerId;
    timestamp: number;
    random: RandomFn;
}

export interface AbilityExecuteResult {
    core: SmashUpCore;
    matchState?: MatchState<SmashUpCore>; // 新增：如果修改了 matchState
    events: SmashUpEvent[];
}
```

**推荐方案**：方案 B 更灵活，能力执行器可以直接操作 `matchState`，但需要确保正确更新。

### 2.5 事件监听架构

#### 2.5.1 SmashUpEventSystem 简化

移除桥接逻辑后，`SmashUpEventSystem` 只需要处理能力的交互解决监听。

**简化后的职责**：
- 监听 `SYS_INTERACTION_RESOLVED` 事件
- 根据 `sourceId` 分发到对应的能力处理函数
- 生成后续事件

**实现**：
```typescript
export function createSmashUpEventSystem(): EngineSystem<SmashUpCore> {
    return {
        id: 'smashup-event-system',
        name: '大杀四方事件处理',
        priority: 50,

        afterEvents: ({ state, events, random }): HookResult<SmashUpCore> | void => {
            let newState = state;
            const nextEvents: GameEvent[] = [];

            for (const event of events) {
                // 监听 SYS_INTERACTION_RESOLVED → 分发到能力处理函数
                if (event.type === INTERACTION_EVENTS.RESOLVED) {
                    const payload = event.payload as {
                        sourceId?: string;
                        playerId: string;
                        value: unknown;
                        interactionData?: Record<string, unknown>;
                    };
                    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;

                    if (payload.sourceId) {
                        const result = handleInteractionResolved(
                            newState,
                            payload.sourceId,
                            payload.playerId,
                            payload.value,
                            payload.interactionData,
                            random,
                            eventTimestamp
                        );
                        
                        if (result) {
                            newState = result.state;
                            nextEvents.push(...result.events);
                        }
                    }
                }
            }

            if (newState !== state || nextEvents.length > 0) {
                return {
                    state: newState,
                    events: nextEvents.length > 0 ? nextEvents : undefined,
                };
            }
        },
    };
}

// 分发函数
function handleInteractionResolved(
    state: MatchState<SmashUpCore>,
    sourceId: string,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined {
    // 根据 sourceId 分发到对应的能力处理函数
    switch (sourceId) {
        case 'zombie_grave_digger':
            return handleZombieGraveDiggerResolved(state, playerId, value, timestamp);
        case 'zombie_grave_robbing':
            return handleZombieGraveRobbingResolved(state, playerId, value, timestamp);
        // ... 其他能力 ...
        default:
            return undefined;
    }
}
```

#### 2.5.2 能力处理函数注册

为了避免在 `systems.ts` 中硬编码所有能力的 switch-case，可以使用注册表模式：

```typescript
// abilityInteractionHandlers.ts
type InteractionHandler = (
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number
) => { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined;

const interactionHandlers = new Map<string, InteractionHandler>();

export function registerInteractionHandler(sourceId: string, handler: InteractionHandler): void {
    interactionHandlers.set(sourceId, handler);
}

export function getInteractionHandler(sourceId: string): InteractionHandler | undefined {
    return interactionHandlers.get(sourceId);
}

// systems.ts
function handleInteractionResolved(/* ... */): /* ... */ {
    const handler = getInteractionHandler(sourceId);
    if (handler) {
        return handler(state, playerId, value, interactionData, timestamp);
    }
    return undefined;
}
```

然后在各个能力文件中注册处理函数：

```typescript
// abilities/zombies.ts
registerInteractionHandler('zombie_grave_digger', (state, playerId, value, _, timestamp) => {
    const { cardUid } = value as { cardUid: string };
    return {
        state,
        events: [recoverCardsFromDiscard(playerId, [cardUid], 'zombie_grave_digger', timestamp)]
    };
});
```

## 3. 组件和接口

### 3.1 核心接口

#### 3.1.1 AbilityExecuteContext（修改）

```typescript
export interface AbilityExecuteContext {
    state: SmashUpCore;
    matchState: MatchState<SmashUpCore>; // 新增：用于调用 queueInteraction
    playerId: PlayerId;
    timestamp: number;
    random: RandomFn;
}
```

#### 3.1.2 AbilityExecuteResult（修改）

```typescript
export interface AbilityExecuteResult {
    core: SmashUpCore;
    matchState?: MatchState<SmashUpCore>; // 新增：如果修改了 matchState
    events: SmashUpEvent[];
}
```

#### 3.1.3 InteractionHandler（新增）

```typescript
type InteractionHandler = (
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number
) => { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined;
```

### 3.2 辅助函数

#### 3.2.1 requestChoice（重构）

**当前实现**：生成 `CHOICE_REQUESTED` 事件

**目标实现**：直接创建 Interaction 并返回

```typescript
// abilityHelpers.ts
export function createChoiceInteraction(
    abilityId: string,
    playerId: PlayerId,
    title: string,
    options: PromptOption[],
    timestamp: number,
    multi?: PromptMultiConfig
): InteractionDescriptor<SimpleChoiceData> {
    return createSimpleChoice(
        `${abilityId}_${timestamp}`,
        playerId,
        title,
        options,
        abilityId,
        undefined,
        multi
    );
}
```

#### 3.2.2 注册和查找处理函数

```typescript
// abilityInteractionHandlers.ts
export function registerInteractionHandler(sourceId: string, handler: InteractionHandler): void;
export function getInteractionHandler(sourceId: string): InteractionHandler | undefined;
export function clearInteractionHandlers(): void; // 测试用
```

### 3.3 文件结构

```
src/games/smashup/
├── domain/
│   ├── types.ts                    # 移除 CHOICE_REQUESTED 和 ChoiceRequestedEvent
│   ├── systems.ts                  # 简化，移除桥接逻辑
│   ├── promptContinuation.ts       # 删除整个文件
│   ├── abilityHelpers.ts           # 重构 requestChoice
│   └── abilityInteractionHandlers.ts # 新增：交互处理函数注册表
├── abilities/
│   ├── zombies.ts                  # 重构所有能力
│   ├── wizards.ts                  # 重构所有能力
│   ├── pirates.ts                  # 重构所有能力
│   ├── ninjas.ts                   # 重构所有能力
│   ├── robots.ts                   # 重构所有能力
│   ├── aliens.ts                   # 重构所有能力
│   ├── dinosaurs.ts                # 重构所有能力
│   ├── tricksters.ts               # 重构所有能力
│   ├── steampunks.ts               # 重构所有能力
│   ├── plants.ts                   # 重构所有能力
│   ├── geeks.ts                    # 重构所有能力
│   ├── query6.ts                   # 重构所有能力
│   ├── cthulhu.ts                  # 重构所有能力
│   ├── elderThings.ts              # 重构所有能力
│   ├── innsmouth.ts                # 重构所有能力
│   └── miskatonicUniversity.ts     # 重构所有能力
├── domain/
│   ├── baseAbilities.ts            # 重构基地能力
│   └── baseAbilities_expansion.ts  # 重构扩展基地能力
└── __tests__/
    └── *.test.ts                   # 更新所有测试
```

## 4. 数据模型

### 4.1 移除的数据结构

```typescript
// promptContinuation.ts（整个文件删除）
interface PromptContinuationCtx { /* ... */ }
type PromptContinuationFn = (ctx: PromptContinuationCtx) => SmashUpEvent[];

// types.ts
const SU_EVENTS = {
    CHOICE_REQUESTED: 'su:choice_requested', // 删除
    // ...
};

interface ChoiceRequestedEvent { /* ... */ } // 删除

// systems.ts
interface SmashUpContinuationData { /* ... */ } // 删除
```

### 4.2 新增的数据结构

```typescript
// abilityInteractionHandlers.ts
type InteractionHandler = (
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number
) => { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined;
```

### 4.3 修改的数据结构

```typescript
// AbilityExecuteContext
export interface AbilityExecuteContext {
    state: SmashUpCore;
    matchState: MatchState<SmashUpCore>; // 新增
    playerId: PlayerId;
    timestamp: number;
    random: RandomFn;
}

// AbilityExecuteResult
export interface AbilityExecuteResult {
    core: SmashUpCore;
    matchState?: MatchState<SmashUpCore>; // 新增
    events: SmashUpEvent[];
}
```

## 5. 正确性属性

*属性是一种特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 5.1 核心属性

**Property 1: 能力直接使用 InteractionSystem API**

*For any* 需要玩家交互的能力执行器，当需要创建交互时，应该直接调用 `createSimpleChoice()` 和 `queueInteraction()`，而不是生成 `CHOICE_REQUESTED` 事件。

**Validates: Requirements 3.2, 8.1**

**测试方法**：
- 搜索所有能力文件中的 `CHOICE_REQUESTED` 引用，应该只出现在测试文件中（用于验证事件不再生成）
- 搜索所有能力文件中的 `createSimpleChoice` 和 `queueInteraction` 调用，验证它们被正确使用
- 对于每个需要交互的能力，验证其执行器直接创建 Interaction 而不是生成事件

**Property 2: 不再使用 promptContinuation 注册表**

*For any* 能力文件，不应该包含 `registerPromptContinuation` 调用，所有继续逻辑应该内联到交互解决处理函数中。

**Validates: Requirements 3.2**

**测试方法**：
- 搜索所有能力文件中的 `registerPromptContinuation` 引用，应该为空
- 验证 `promptContinuation.ts` 文件不存在
- 验证所有能力都使用 `registerInteractionHandler` 注册交互解决处理函数

**Property 3: 交互流程功能完整性**

*For any* 需要玩家交互的能力，执行该能力后：
1. 应该创建一个 Interaction 并加入队列
2. 玩家响应后应该生成 `SYS_INTERACTION_RESOLVED` 事件
3. 交互解决后应该生成正确的后续事件
4. 最终游戏状态应该与重构前一致

**Validates: Requirements 8.2**

**测试方法**：
- 对于每个需要交互的能力，编写端到端测试：
  - 执行能力 → 验证 Interaction 被创建
  - 模拟玩家响应 → 验证 `SYS_INTERACTION_RESOLVED` 事件
  - 验证后续事件和最终状态
- 使用现有测试用例作为参考，确保重构后行为一致

### 5.2 示例验证

**Example 1: 清理验证**

验证以下文件和类型定义不再存在：
- `src/games/smashup/domain/promptContinuation.ts` 文件
- `SU_EVENTS.CHOICE_REQUESTED` 常量
- `ChoiceRequestedEvent` 接口
- `SmashUpContinuationData` 接口
- `systems.ts` 中监听 `CHOICE_REQUESTED` 的代码

**Validates: Requirements 3.1, 8.1**

**Example 2: AbilityExecuteContext 类型定义**

验证 `AbilityExecuteContext` 接口包含 `matchState: MatchState<SmashUpCore>` 字段，允许能力执行器访问完整的 match 状态。

**Validates: Requirements 3.3**

**Example 3: UI 兼容性**

验证 `InteractionPanel.tsx` 组件仍然可以使用 `asSimpleChoice()` 辅助函数正常渲染交互界面，无需修改。

**Validates: Requirements 3.4**

### 5.3 边缘情况

**Edge Case 1: 多步交互**

某些能力需要多步选择（如僵尸领主：先选随从，再选基地）。验证：
- 第一步交互解决后，第二步交互被正确创建并加入队列
- 上下文数据通过 `interaction.data` 正确传递
- 最终状态正确反映所有选择

**Edge Case 2: 单目标自动执行**

某些能力在只有一个有效目标时自动执行，多个目标时才需要交互。验证：
- 单目标时不创建 Interaction，直接生成事件
- 多目标时创建 Interaction 并等待玩家选择
- 两种情况的最终效果一致

**Edge Case 3: 空目标列表**

某些能力在没有有效目标时应该跳过。验证：
- 没有目标时不创建 Interaction
- 不生成任何事件
- 游戏状态不变

## 6. 错误处理

### 6.1 编译时错误

**类型不匹配**：
- 能力执行器返回类型从 `SmashUpEvent[]` 改为 `AbilityExecuteResult`
- 需要更新所有能力执行器的返回语句
- TypeScript 编译器会捕获类型错误

**缺失字段**：
- `AbilityExecuteContext` 新增 `matchState` 字段
- 所有创建 context 的地方需要提供该字段
- TypeScript 编译器会捕获缺失字段错误

### 6.2 运行时错误

**Interaction 未创建**：
- 如果能力执行器忘记调用 `queueInteraction()`，玩家将无法看到交互界面
- 错误表现：能力执行后没有任何反应
- 调试方法：检查 `state.sys.interaction.current` 是否为空

**sourceId 不匹配**：
- 如果交互解决处理函数的 `sourceId` 与创建时不一致，处理函数不会被调用
- 错误表现：玩家选择后没有任何效果
- 调试方法：检查 `SYS_INTERACTION_RESOLVED` 事件的 `sourceId` 字段

**上下文数据丢失**：
- 多步交互中，如果忘记在 `interaction.data` 中存储上下文，第二步将无法访问第一步的选择
- 错误表现：第二步交互缺少必要信息
- 调试方法：检查 `interactionData` 字段内容

### 6.3 测试失败

**现有测试失败**：
- 重构后，某些测试可能因为事件顺序变化而失败
- 需要更新测试以反映新的实现方式
- 关键：验证最终状态一致，而不是事件序列完全相同

**新测试覆盖不足**：
- 需要为每个重构的能力添加交互流程测试
- 确保覆盖单目标、多目标、空目标等情况
- 使用 property-based testing 验证通用属性

## 7. 测试策略

### 7.1 单元测试

**能力执行器测试**：
- 测试每个能力执行器在需要交互时创建正确的 Interaction
- 验证 Interaction 的 `id`、`kind`、`playerId`、`data` 字段
- 验证 `queueInteraction()` 被调用且 `matchState` 被正确更新

**交互解决处理函数测试**：
- 测试每个交互解决处理函数正确处理玩家选择
- 验证生成的后续事件
- 验证最终游戏状态

**边缘情况测试**：
- 单目标自动执行
- 空目标列表
- 多步交互上下文传递

### 7.2 集成测试

**端到端交互流程**：
- 使用 `GameTestRunner` 模拟完整的交互流程
- 执行能力 → 验证 Interaction 创建 → 模拟玩家响应 → 验证最终状态
- 对比重构前后的行为一致性

**多能力组合**：
- 测试多个能力连续触发交互的情况
- 验证交互队列正确管理
- 验证交互顺序符合预期

### 7.3 回归测试

**保持现有测试通过**：
- 所有现有的能力测试应该继续通过（可能需要小幅调整）
- 关键：验证最终状态和效果，而不是实现细节
- 如果测试失败，首先检查是否是测试本身需要更新

**测试覆盖率**：
- 确保重构后的代码覆盖率不低于重构前
- 重点覆盖交互创建和解决逻辑
- 使用 Istanbul 或类似工具检查覆盖率

### 7.4 Property-Based Testing

**通用属性测试**：
- Property 1: 所有需要交互的能力都创建 Interaction
- Property 2: 所有 Interaction 都有对应的解决处理函数
- Property 3: 交互流程不会导致状态不一致

**测试配置**：
- 最少 100 次迭代
- 使用随机生成的游戏状态
- 标签格式：`Feature: smashup-interaction-migration, Property 1: 能力直接使用 InteractionSystem API`

## 8. 性能考虑

### 8.1 性能改进

**减少事件桥接开销**：
- 移除 `CHOICE_REQUESTED` 事件的生成和处理
- 减少事件系统的监听和分发开销
- 预期性能提升：约 5-10%（交互密集场景）

**减少注册表查找**：
- 移除 `promptContinuation` 注册表的查找开销
- 交互解决处理函数直接注册，查找更快
- 预期性能提升：约 2-5%（交互解决阶段）

### 8.2 性能监控

**关键指标**：
- 能力执行时间（包含交互创建）
- 交互解决时间（包含后续事件生成）
- 内存使用（移除注册表后应略有下降）

**基准测试**：
- 重构前后对比相同场景的性能
- 使用 `performance.now()` 测量关键路径
- 确保性能不降低

## 9. 迁移计划

### 9.1 分批迁移策略

**阶段 1：基础设施（1-2 天）**
- 修改 `AbilityExecuteContext` 和 `AbilityExecuteResult` 类型
- 创建 `abilityInteractionHandlers.ts` 注册表
- 简化 `systems.ts`，保留桥接逻辑作为后备
- 更新 `execute.ts` 以支持 `matchState` 传递

**阶段 2：核心能力迁移（3-5 天）**
- 迁移僵尸派系（zombies.ts）
- 迁移巫师派系（wizards.ts）
- 迁移海盗派系（pirates.ts）
- 每迁移一个派系，运行该派系的所有测试
- 确保测试通过后再继续下一个

**阶段 3：扩展能力迁移（3-5 天）**
- 迁移忍者派系（ninjas.ts）
- 迁移机器人派系（robots.ts）
- 迁移外星人派系（aliens.ts）
- 迁移恐龙派系（dinosaurs.ts）
- 迁移骗术师派系（tricksters.ts）
- 迁移蒸汽朋克派系（steampunks.ts）
- 迁移植物派系（plants.ts）
- 迁移极客派系（geeks.ts）

**阶段 4：克苏鲁扩展迁移（2-3 天）**
- 迁移克苏鲁派系（cthulhu.ts）
- 迁移远古之物派系（elderThings.ts）
- 迁移印斯茅斯派系（innsmouth.ts）
- 迁移密斯卡托尼克大学派系（miskatonicUniversity.ts）

**阶段 5：基地能力迁移（1-2 天）**
- 迁移基础基地能力（baseAbilities.ts）
- 迁移扩展基地能力（baseAbilities_expansion.ts）

**阶段 6：清理和验证（1-2 天）**
- 移除 `promptContinuation.ts`
- 移除 `CHOICE_REQUESTED` 事件定义
- 移除 `systems.ts` 中的桥接逻辑
- 运行所有测试
- 手动验证所有交互能力

### 9.2 回滚计划

**触发条件**：
- 关键测试失败且无法快速修复
- 发现严重的性能退化
- 发现无法解决的架构问题

**回滚步骤**：
1. 恢复 `promptContinuation.ts`
2. 恢复 `CHOICE_REQUESTED` 事件定义
3. 恢复 `systems.ts` 中的桥接逻辑
4. 恢复能力文件到迁移前版本
5. 运行测试验证回滚成功

**风险缓解**：
- 每个阶段完成后提交 Git commit
- 保留详细的迁移日志
- 在独立分支上进行迁移，主分支保持稳定

### 9.3 验证清单

**代码层面**：
- [ ] `promptContinuation.ts` 已删除
- [ ] `CHOICE_REQUESTED` 事件已移除
- [ ] `systems.ts` 已简化
- [ ] 所有能力使用 `createSimpleChoice` 和 `queueInteraction`
- [ ] 所有能力注册交互解决处理函数
- [ ] TypeScript 编译通过
- [ ] ESLint 检查通过

**功能层面**：
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 手动测试所有交互能力
- [ ] 性能基准测试通过
- [ ] 无明显的性能退化

**文档层面**：
- [ ] 代码注释已更新
- [ ] 设计文档已完成
- [ ] 迁移日志已记录
- [ ] 已知问题已文档化

## 10. 风险和依赖

### 10.1 技术风险

**风险 1：能力数量多，迁移工作量大**
- 影响：约 50+ 个能力需要重构
- 缓解：分批迁移，每批运行测试
- 应急：保留桥接逻辑作为后备，逐步迁移

**风险 2：多步交互复杂度高**
- 影响：某些能力需要多步选择，上下文传递复杂
- 缓解：先迁移简单能力，积累经验后再处理复杂能力
- 应急：为复杂能力保留特殊处理逻辑

**风险 3：测试覆盖不完整**
- 影响：某些边缘情况可能未被测试覆盖
- 缓解：增加 property-based testing，覆盖更多场景
- 应急：手动测试补充自动化测试的不足

### 10.2 依赖关系

**依赖 1：InteractionSystem 功能完整**
- 状态：已完成，功能稳定
- 风险：低
- 备注：InteractionSystem 已在其他游戏中使用，经过验证

**依赖 2：现有测试套件可运行**
- 状态：正常
- 风险：低
- 备注：所有测试当前都通过

**依赖 3：开发环境配置正确**
- 状态：正常
- 风险：低
- 备注：TypeScript、ESLint、测试框架都已配置

### 10.3 时间估算

**总工作量**：10-15 天
- 基础设施：1-2 天
- 核心能力迁移：3-5 天
- 扩展能力迁移：3-5 天
- 克苏鲁扩展迁移：2-3 天
- 基地能力迁移：1-2 天
- 清理和验证：1-2 天

**关键路径**：
- 基础设施 → 核心能力 → 扩展能力 → 克苏鲁扩展 → 基地能力 → 清理

**并行机会**：
- 不同派系的能力可以并行迁移（如果有多人协作）
- 测试编写可以与迁移并行进行

## 11. 成功标准

### 11.1 代码质量

- 代码行数减少：预计减少 100+ 行（移除桥接代码和注册表）
- TypeScript 编译错误：0
- ESLint 警告：0
- 代码重复度：低于 5%

### 11.2 功能完整性

- 所有单元测试通过率：100%
- 所有集成测试通过率：100%
- 手动测试覆盖率：100%（所有交互能力）
- 回归测试通过率：100%

### 11.3 性能指标

- 交互创建时间：不超过重构前的 110%
- 交互解决时间：不超过重构前的 110%
- 内存使用：不超过重构前的 105%
- 整体游戏性能：不低于重构前

### 11.4 可维护性

- 代码复杂度：降低（移除桥接逻辑）
- 代码可读性：提升（逻辑集中）
- 新能力开发：更简单（直接使用 InteractionSystem）
- 调试难度：降低（减少间接层）

## 12. 附录

### 12.1 参考文档

- `AGENTS.md` - 项目编码规范
- `src/engine/systems/InteractionSystem.ts` - InteractionSystem 实现
- `.spec/knowledge/standards/engine-systems.md` - 引擎系统规范
- 现有游戏的 InteractionSystem 使用示例

### 12.2 术语表

- **InteractionSystem**：引擎层的统一交互系统，提供阻塞式玩家交互原语
- **Prompt**：旧的交互系统，已被 InteractionSystem 替代
- **桥接系统**：通过事件间接创建交互的反模式
- **能力执行器**：执行能力效果的函数，位于 `abilities/*.ts`
- **交互解决处理函数**：处理交互解决后逻辑的函数，注册在 `abilityInteractionHandlers.ts`
- **sourceId**：交互的来源标识，用于分发到对应的处理函数

### 12.3 示例代码

**简单选择示例**：
```typescript
// 能力执行器
export function executeZombieGraveDigger(ctx: AbilityExecuteContext): AbilityExecuteResult {
    const player = ctx.state.players[ctx.playerId];
    const discardMinions = player.discard.filter(c => {
        const def = getCardDef(c.defId);
        return def?.type === 'minion';
    });
    
    if (discardMinions.length === 0) {
        return { core: ctx.state, events: [] };
    }
    
    if (discardMinions.length === 1) {
        return {
            core: ctx.state,
            events: [recoverCardsFromDiscard(ctx.playerId, [discardMinions[0].uid], 'zombie_grave_digger', ctx.timestamp)]
        };
    }
    
    const interaction = createSimpleChoice(
        `zombie_grave_digger_${ctx.timestamp}`,
        ctx.playerId,
        '选择要取回的随从',
        discardMinions.map(c => ({
            id: c.uid,
            label: getCardName(c.defId),
            value: { cardUid: c.uid }
        })),
        'zombie_grave_digger'
    );
    
    const newMatchState = queueInteraction(ctx.matchState, interaction);
    
    return {
        core: ctx.state,
        matchState: newMatchState,
        events: []
    };
}

// 交互解决处理函数
registerInteractionHandler('zombie_grave_digger', (state, playerId, value, _, timestamp) => {
    const { cardUid } = value as { cardUid: string };
    return {
        state,
        events: [recoverCardsFromDiscard(playerId, [cardUid], 'zombie_grave_digger', timestamp)]
    };
});
```

**多步选择示例**：
```typescript
// 第一步：选择随从
export function executeZombieLord(ctx: AbilityExecuteContext): AbilityExecuteResult {
    const player = ctx.state.players[ctx.playerId];
    const discardMinions = player.discard.filter(/* ... */);
    
    const interaction = createSimpleChoice(
        `zombie_lord_minion_${ctx.timestamp}`,
        ctx.playerId,
        '选择要复活的随从',
        discardMinions.map(/* ... */),
        'zombie_lord_minion'
    );
    
    const newMatchState = queueInteraction(ctx.matchState, interaction);
    
    return {
        core: ctx.state,
        matchState: newMatchState,
        events: []
    };
}

// 第一步解决：创建第二步交互
registerInteractionHandler('zombie_lord_minion', (state, playerId, value, _, timestamp) => {
    const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
    const emptyBases = state.core.bases
        .map((b, i) => ({ baseIndex: i, label: getBaseName(b.defId) }))
        .filter(b => state.core.bases[b.baseIndex].minions.length === 0);
    
    const interaction = createSimpleChoice(
        `zombie_lord_base_${timestamp}`,
        playerId,
        '选择放置基地',
        emptyBases.map(b => ({
            id: `base_${b.baseIndex}`,
            label: b.label,
            value: { baseIndex: b.baseIndex }
        })),
        'zombie_lord_base'
    );
    
    // 将第一步的选择存储在 interaction.data 中
    const extendedInteraction = {
        ...interaction,
        data: {
            ...interaction.data,
            context: { cardUid, defId, power }
        }
    };
    
    const newState = queueInteraction(state, extendedInteraction);
    
    return {
        state: newState,
        events: []
    };
});

// 第二步解决：执行最终逻辑
registerInteractionHandler('zombie_lord_base', (state, playerId, value, interactionData, timestamp) => {
    const { baseIndex } = value as { baseIndex: number };
    const context = (interactionData as any)?.context as { cardUid: string; defId: string; power: number };
    
    return {
        state,
        events: [
            recoverCardsFromDiscard(playerId, [context.cardUid], 'zombie_lord', timestamp),
            // ... 其他事件
        ]
    };
});
```

