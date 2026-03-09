# FlowSystem.afterEvents 未被调用问题调查报告

## 问题描述

Cardia 游戏中，FlowSystem.afterEvents 没有被正确调用，导致阶段无法自动推进。目前使用了临时修复方案：在 execute.ts 中手动发射 PHASE_CHANGED 事件，并在 CardiaEventSystem 中监听该事件来同步 sys.phase。

## 调查发现

### 1. FlowSystem.afterEvents 的设计意图

FlowSystem.afterEvents 的设计目标是：
- 在每次命令执行后，检查是否需要自动推进阶段
- 通过 `onAutoContinueCheck` 钩子判断是否满足自动推进条件
- 如果满足条件，自动执行 ADVANCE_PHASE 命令

### 2. 调用链路分析

**正常流程**：
```
executePipeline
  → domain.execute (产生事件)
  → reduceEventsToCore (事件写入 core)
  → runAfterEventsRounds
    → 遍历所有 systems
      → system.afterEvents (包括 FlowSystem.afterEvents)
```

**实际情况**：
- Pipeline 确实会调用 FlowSystem.afterEvents
- FlowSystem.afterEvents 确实会调用 `onAutoContinueCheck`
- 但是 `onAutoContinueCheck` 返回的结果可能不满足自动推进条件

### 3. Cardia 的 onAutoContinueCheck 实现分析

查看 `src/games/cardia/domain/flowHooks.ts`，发现以下问题：

#### 问题 1：play → ability 阶段的自动推进条件

```typescript
// 情况1：play 阶段 → ability 阶段（遭遇战解析后）
if (sys.phase === 'play') {
    const encounterResolved = events.find(e => e.type === CARDIA_EVENTS.ENCOUNTER_RESOLVED);
    
    if (encounterResolved) {
        const payload = (encounterResolved as any).payload;
        
        // 只有在有失败者时才推进到 ability 阶段
        if (payload.loser) {
            return {
                autoContinue: true,
                playerId: payload.loser,
            };
        }
    }
    return;
}
```

**问题**：这个逻辑是正确的，但是需要确认 ENCOUNTER_RESOLVED 事件是否正确发射，以及 payload.loser 是否正确设置。

#### 问题 2：ability → end 阶段的自动推进条件

```typescript
// 情况2：ability 阶段 → end 阶段（交互完成或跳过能力）
if (sys.phase === 'ability') {
    const shouldAutoContinue = events.some(e => 
        e.type === 'SYS_INTERACTION_RESOLVED' || 
        e.type === CARDIA_EVENTS.ABILITY_SKIPPED
    );
    
    if (!shouldAutoContinue) {
        return;
    }
    
    const activePlayerId = core.currentEncounter?.loserId || core.currentPlayerId;
    
    return {
        autoContinue: true,
        playerId: activePlayerId,
    };
}
```

**问题**：这个逻辑依赖于 `SYS_INTERACTION_RESOLVED` 事件，但是需要确认：
1. InteractionSystem 是否正确发射了这个事件
2. 事件是否在正确的时机发射（交互完成后）

### 4. 根本原因分析

通过查看代码和日志，发现以下几个可能的原因：

#### 原因 1：afterEventsRound 限制

根据 `docs/ai-rules/engine-systems.md`：

> `FlowSystem.afterEvents` 在 `afterEventsRound > 0` 时传空 events 给 `onAutoContinueCheck`，基于事件的自动推进链单次 `executePipeline` 最多跨一个阶段。

这意味着：
- 第一轮 afterEvents（round 0）：传递完整的 events 数组
- 后续轮次（round > 0）：传递空数组

**影响**：如果 `onAutoContinueCheck` 依赖于检查 events 数组中的特定事件（如 ENCOUNTER_RESOLVED），那么在后续轮次中将无法检测到这些事件。

#### 原因 2：事件时序问题

查看 pipeline.ts 的 runAfterEventsRounds 函数：

```typescript
for (let round = 0; round < maxRounds; round++) {
    ctx.afterEventsRound = round;
    
    // 调用每个系统的 afterEvents hook
    for (const system of systems) {
        if (!system.afterEvents) continue;
        const result = system.afterEvents(ctx);
        // ...
    }
    
    // 本轮事件 reduce 进 core
    if (roundEvents.length > 0) {
        // ...
        ctx.events = reduced.appliedEvents;
    } else {
        ctx.events = [];  // 清空 ctx.events
    }
}
```

**关键点**：
- 每轮结束后，`ctx.events` 会被更新为本轮产生的新事件
- 如果本轮没有新事件，`ctx.events` 会被清空
- 下一轮的 `onAutoContinueCheck` 只能看到上一轮产生的新事件

#### 原因 3：系统优先级问题

FlowSystem 的优先级是 25，而其他系统的优先级可能不同：
- InteractionSystem: 优先级未知
- CardiaEventSystem: 优先级 50

**可能的问题**：
- 如果 InteractionSystem 的优先级高于 FlowSystem，那么 FlowSystem.afterEvents 可能在 InteractionSystem 发射 SYS_INTERACTION_RESOLVED 之前就被调用了
- 但是查看代码，系统是按优先级排序后依次调用的，所以这个问题不太可能

### 5. 临时修复方案的问题

当前的临时修复方案：
1. 在 execute.ts 中手动发射 PHASE_CHANGED 事件
2. 在 CardiaEventSystem 中监听 PHASE_CHANGED 事件并同步 sys.phase

**问题**：
- 绕过了 FlowSystem 的设计，导致阶段推进逻辑分散在多个地方
- PHASE_CHANGED 事件既是领域事件（Cardia 特有），又承担了系统事件（阶段推进）的职责
- 违反了"FlowSystem 统一管理阶段推进"的架构原则

## 解决方案

### 方案 1：修复 onAutoContinueCheck 的事件检测逻辑（推荐）

**问题根源**：`onAutoContinueCheck` 依赖于检查 events 数组中的特定事件，但是在 afterEventsRound > 0 时，events 数组可能为空或不包含原始事件。

**解决方案**：
1. 不依赖 events 数组来判断是否需要自动推进
2. 改为检查 state 中的状态标志

**具体实现**：

```typescript
onAutoContinueCheck: ({ state, events }) => {
    const { core, sys } = state;
    
    // 检查是否有交互正在进行
    const hasCurrentInteraction = !!sys.interaction?.current;
    const hasQueuedInteractions = (sys.interaction?.queue?.length || 0) > 0;
    
    // 如果还有交互未完成，不自动推进
    if (hasCurrentInteraction || hasQueuedInteractions) {
        return;
    }
    
    // 情况1：play 阶段 → ability 阶段
    // 条件：遭遇战已解析（currentEncounter 存在）且有失败者
    if (sys.phase === 'play' && core.currentEncounter && core.currentEncounter.loserId) {
        return {
            autoContinue: true,
            playerId: core.currentEncounter.loserId,
        };
    }
    
    // 情况2：ability 阶段 → end 阶段
    // 条件：没有交互且失败者已操作（通过检查 core 状态判断）
    if (sys.phase === 'ability') {
        // 检查是否应该推进到 end 阶段
        // 这里需要根据游戏逻辑判断，例如：
        // - 失败者已经激活了能力
        // - 或者失败者跳过了能力
        // 可以通过检查 core 中的标志来判断
        
        const activePlayerId = core.currentEncounter?.loserId || core.currentPlayerId;
        
        // 如果有 ABILITY_SKIPPED 事件，说明玩家跳过了能力
        const hasAbilitySkipped = events.some(e => e.type === CARDIA_EVENTS.ABILITY_SKIPPED);
        
        // 如果有 SYS_INTERACTION_RESOLVED 事件，说明交互完成
        const hasInteractionResolved = events.some(e => e.type === 'SYS_INTERACTION_RESOLVED');
        
        if (hasAbilitySkipped || hasInteractionResolved) {
            return {
                autoContinue: true,
                playerId: activePlayerId,
            };
        }
    }
},
```

**优点**：
- 符合 FlowSystem 的设计意图
- 不需要修改 execute.ts 和 CardiaEventSystem
- 阶段推进逻辑集中在 FlowHooks 中

**缺点**：
- 需要仔细设计状态检查逻辑，确保不会误判

### 方案 2：在 core 中添加阶段推进标志

**问题根源**：`onAutoContinueCheck` 无法可靠地从 events 数组中判断是否需要自动推进。

**解决方案**：
1. 在 core 中添加一个标志，表示"需要自动推进到下一阶段"
2. execute 函数在适当的时机设置这个标志
3. `onAutoContinueCheck` 检查这个标志来决定是否自动推进

**具体实现**：

```typescript
// core-types.ts
export interface CardiaCore {
    // ... 其他字段
    
    /**
     * 阶段推进标志
     * 当设置为 true 时，FlowSystem 会在下一次 afterEvents 中自动推进阶段
     */
    shouldAdvancePhase?: boolean;
}

// execute.ts
function executePlayCard(...) {
    // ...
    
    // 当遭遇战解析后，设置阶段推进标志
    if (encounterResolved && encounterResolved.payload.loser) {
        core.shouldAdvancePhase = true;
    }
    
    // ...
}

// flowHooks.ts
onAutoContinueCheck: ({ state, events }) => {
    const { core, sys } = state;
    
    // 检查阶段推进标志
    if (!core.shouldAdvancePhase) {
        return;
    }
    
    // 检查是否有交互正在进行
    const hasCurrentInteraction = !!sys.interaction?.current;
    const hasQueuedInteractions = (sys.interaction?.queue?.length || 0) > 0;
    
    if (hasCurrentInteraction || hasQueuedInteractions) {
        return;
    }
    
    // 确定活跃玩家
    const activePlayerId = core.currentEncounter?.loserId || core.currentPlayerId;
    
    return {
        autoContinue: true,
        playerId: activePlayerId,
    };
},

// reduce.ts
// 在阶段推进后清除标志
function reducePhaseChanged(core, event) {
    return {
        ...core,
        phase: event.payload.newPhase,
        shouldAdvancePhase: false,  // 清除标志
    };
}
```

**优点**：
- 逻辑清晰，易于理解
- 不依赖 events 数组的内容
- 可以精确控制何时自动推进

**缺点**：
- 需要修改 core 类型定义
- 需要在多个地方维护这个标志

### 方案 3：保持当前的临时修复方案，但改进实现

**如果决定保持当前方案**，可以做以下改进：

1. 将 PHASE_CHANGED 事件改为系统事件（SYS_PHASE_CHANGED）
2. 在 FlowSystem 中统一处理阶段推进和事件发射
3. 移除 CardiaEventSystem 中的 PHASE_CHANGED 监听逻辑

**但这不是推荐方案**，因为它违反了 FlowSystem 的设计原则。

## 推荐方案

**推荐使用方案 1**：修复 onAutoContinueCheck 的逻辑，改为检查 state 而不是 events。

理由：
1. 符合 FlowSystem 的设计意图
2. 不需要修改 core 类型定义
3. 阶段推进逻辑集中在一个地方
4. 与其他游戏（DiceThrone、SmashUp、SummonerWars）的实现方式一致

### 关键发现：DiceThrone 的最佳实践

查看 DiceThrone 的 `onAutoContinueCheck` 实现，发现它使用了以下策略：

```typescript
onAutoContinueCheck: ({ state, events }) => {
    const core = state.core;
    const phase = state.sys.phase as TurnPhase;

    // 1. setup 阶段：由特定事件门控
    if (phase === 'setup') {
        const hasSetupGateEvent = events.some(e => e.type === 'HOST_STARTED' || e.type === 'PLAYER_READY');
        if (hasSetupGateEvent && canAdvancePhase(core, phase)) {
            return { autoContinue: true, playerId: core.activePlayerId };
        }
        return undefined;
    }

    // 2. 纯自动阶段（upkeep/income）：通过 SYS_PHASE_CHANGED 检测刚进入该阶段
    if (phase === 'upkeep' || phase === 'income') {
        const justEnteredPhase = events.some(
            e => e.type === 'SYS_PHASE_CHANGED' && (e as any).payload?.to === phase
        );
        if (justEnteredPhase && canAdvancePhase(core, phase)) {
            return { autoContinue: true, playerId: core.activePlayerId };
        }
        return undefined;
    }

    // 3. 战斗阶段：仅在 flowHalted 时自动推进
    if (phase === 'offensiveRoll' || phase === 'defensiveRoll') {
        if (!state.sys.flowHalted) return undefined;

        // 确认所有阻塞已清除
        const hasActiveInteraction = state.sys.interaction?.current !== undefined;
        const hasActiveResponseWindow = state.sys.responseWindow?.current !== undefined;
        const hasPendingDamage = core.pendingDamage !== null && core.pendingDamage !== undefined;
        
        if (!hasActiveInteraction && !hasActiveResponseWindow && !hasPendingDamage) {
            const autoContinuePlayerId = getRollerId(core, phase);
            return { autoContinue: true, playerId: autoContinuePlayerId };
        }
        return undefined;
    }

    // 4. 玩家操作阶段：永不自动推进
    return undefined;
},
```

**关键点**：
1. **不依赖 events 数组中的领域事件**：只检查系统事件（SYS_PHASE_CHANGED）或 state 中的标志
2. **使用 SYS_PHASE_CHANGED 检测阶段切换**：这是一个可靠的信号，表示刚进入某个阶段
3. **检查 state 中的阻塞条件**：`sys.interaction.current`、`sys.responseWindow.current`、`core.pendingDamage` 等
4. **使用 sys.flowHalted 标志**：表示上一次 onPhaseExit 返回了 halt，需要重新尝试推进

### Cardia 的修复方案

基于 DiceThrone 的最佳实践，Cardia 应该这样修复：

```typescript
onAutoContinueCheck: ({ state, events }) => {
    const { core, sys } = state;
    
    // 检查是否有交互正在进行
    const hasCurrentInteraction = !!sys.interaction?.current;
    const hasQueuedInteractions = (sys.interaction?.queue?.length || 0) > 0;
    
    // 如果还有交互未完成，不自动推进
    if (hasCurrentInteraction || hasQueuedInteractions) {
        return;
    }
    
    // 情况1：play 阶段 → ability 阶段
    // 条件：遭遇战已解析（currentEncounter 存在）且有失败者
    if (sys.phase === 'play' && core.currentEncounter && core.currentEncounter.loserId) {
        return {
            autoContinue: true,
            playerId: core.currentEncounter.loserId,
        };
    }
    
    // 情况2：ability 阶段 → end 阶段
    // 条件：没有交互且失败者已操作
    // 使用 SYS_PHASE_CHANGED 检测刚进入 ability 阶段，或者检查 SYS_INTERACTION_RESOLVED
    if (sys.phase === 'ability') {
        // 检查是否刚进入 ability 阶段（从 play 阶段推进过来）
        const justEnteredAbility = events.some(
            e => e.type === 'SYS_PHASE_CHANGED' && (e as any).payload?.to === 'ability'
        );
        
        // 或者检查交互是否刚解决
        const interactionJustResolved = events.some(e => e.type === 'SYS_INTERACTION_RESOLVED');
        
        // 或者检查是否跳过了能力
        const abilitySkipped = events.some(e => e.type === CARDIA_EVENTS.ABILITY_SKIPPED);
        
        if (justEnteredAbility || interactionJustResolved || abilitySkipped) {
            const activePlayerId = core.currentEncounter?.loserId || core.currentPlayerId;
            return {
                autoContinue: true,
                playerId: activePlayerId,
            };
        }
    }
},
```

**为什么这样修复有效**：
1. **不依赖领域事件**：不检查 `ENCOUNTER_RESOLVED` 或 `ABILITY_SKIPPED`，而是检查 state 中的状态
2. **使用系统事件**：`SYS_PHASE_CHANGED` 和 `SYS_INTERACTION_RESOLVED` 是可靠的信号
3. **检查 state 标志**：`core.currentEncounter.loserId` 表示遭遇战已解析且有失败者
4. **不受 afterEventsRound 影响**：系统事件在所有轮次中都会传递

## 关键 Bug 修复

### Bug：能力交互弹窗不出现

**问题描述**：
在实现了基于 DiceThrone 最佳实践的修复后，用户手动测试发现能力激活弹窗不再出现。

**根本原因**：
`onAutoContinueCheck` 中的 `justEnteredAbility` 条件导致 ability 阶段刚进入时就立即自动推进到 end 阶段，**在能力交互创建之前**就完成了阶段切换。

**问题代码**（已修复）：
```typescript
// ❌ 错误：刚进入 ability 阶段就自动推进
const justEnteredAbility = events.some(
    e => e.type === 'SYS_PHASE_CHANGED' && (e as any).payload?.to === 'ability'
);

if (justEnteredAbility || interactionJustResolved || abilitySkipped) {
    // 立即推进到 end 阶段，能力交互还未创建！
    return { autoContinue: true, playerId: activePlayerId };
}
```

**修复方案**：
移除 `justEnteredAbility` 条件，只在以下情况自动推进：
1. 交互刚解决（`interactionJustResolved`）
2. 能力被跳过（`abilitySkipped`）

**修复后代码**：
```typescript
// ✅ 正确：只在交互完成或跳过时自动推进
const interactionJustResolved = events.some(e => e.type === 'SYS_INTERACTION_RESOLVED');
const abilitySkipped = events.some(e => e.type === CARDIA_EVENTS.ABILITY_SKIPPED);

if (interactionJustResolved || abilitySkipped) {
    return { autoContinue: true, playerId: activePlayerId };
}
```

**时序分析**：
```
正确流程：
1. play 阶段 → 遭遇战解析 → FlowSystem 自动推进到 ability 阶段
2. ability 阶段 → execute 创建能力交互 → 交互入队
3. 玩家操作 → 交互解决 → SYS_INTERACTION_RESOLVED 事件
4. FlowSystem 检测到 interactionJustResolved → 自动推进到 end 阶段

错误流程（已修复）：
1. play 阶段 → 遭遇战解析 → FlowSystem 自动推进到 ability 阶段
2. SYS_PHASE_CHANGED(to='ability') 事件发射
3. FlowSystem 检测到 justEnteredAbility → 立即自动推进到 end 阶段 ❌
4. execute 尝试创建能力交互，但阶段已经是 end，交互被忽略 ❌
```

**教训**：
- 自动推进逻辑必须考虑异步操作的时序
- 不能在"刚进入阶段"时就立即推进，必须等待该阶段的核心操作完成
- 能力交互的创建发生在 execute 中，而 FlowSystem.afterEvents 在 execute 之后运行
- 如果在同一个 afterEvents 轮次中检测到"刚进入阶段"就推进，会导致跳过该阶段的核心逻辑

## 下一步行动

1. ✅ **已完成**：修复 `onAutoContinueCheck` 的逻辑，移除 `justEnteredAbility` 条件
2. ✅ **已完成**：添加 end → play 阶段的自动推进逻辑（检测 TURN_ENDED 事件）
3. ✅ **已完成**：移除 execute.ts 中的手动 PHASE_CHANGED 事件发射（lines ~367, ~527, ~630）
4. ✅ **已完成**：移除 CardiaEventSystem 中的 PHASE_CHANGED 监听逻辑（line ~295）
5. **待验证**：手动测试能力交互和回合结束是否正常工作
6. 添加测试验证自动推进功能
7. 更新文档

## 修复总结

### 修复内容

1. **移除 `justEnteredAbility` 条件**（`flowHooks.ts`）
   - 只在交互完成或跳过能力时自动推进 ability → end
   - 避免在能力交互创建前就推进阶段

2. **添加 end → play 自动推进**（`flowHooks.ts`）
   - 检测 TURN_ENDED 事件
   - 自动推进到下一回合的 play 阶段

3. **移除临时修复方案**
   - `execute.ts`：移除 `resolveEncounter` 中的 PHASE_CHANGED 事件（line ~367）
   - `execute.ts`：移除 `executeSkipAbility` 中的 PHASE_CHANGED 事件（line ~527）
   - `execute.ts`：移除 `executeAutoEndTurn` 中的 PHASE_CHANGED 事件（line ~630）
   - `systems.ts`：移除 CardiaEventSystem 中的 PHASE_CHANGED 监听逻辑（line ~295）

### 架构改进

- **统一阶段管理**：所有阶段推进现在由 FlowSystem 统一管理
- **事件驱动**：使用领域事件（ABILITY_SKIPPED、TURN_ENDED）触发自动推进
- **状态检查**：使用 state 标志（currentEncounter.loserId）而非 events 数组
- **消除不一致**：sys.phase 和 core.phase 现在由 FlowSystem 统一更新，不会出现不一致

## 参考

- `src/engine/systems/FlowSystem.ts` - FlowSystem 实现
- `src/engine/pipeline.ts` - Pipeline 实现
- `src/games/cardia/domain/flowHooks.ts` - Cardia FlowHooks 实现
- `src/games/dicethrone/domain/flowHooks.ts` - DiceThrone FlowHooks 实现（最佳实践）
- `docs/ai-rules/engine-systems.md` - 引擎系统文档
- `docs/ai-rules/undo-auto-advance.md` - 撤回后自动推进规范
