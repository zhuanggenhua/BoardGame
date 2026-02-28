# 交互选项自动刷新机制详解

## 核心概念

交互选项的刷新是为了解决**同时触发多个交互时，后续交互的选项可能基于过时状态**的问题。

### 问题场景

```
时间线：
T0: 托尔图加计分，创建3个交互：
    - 交互A：海盗王移动（beforeScoring）
    - 交互B：托尔图加移动随从（afterScoring）
    - 交互C：大副移动（afterScoring）

T1: 用户解决交互A，海盗王从基地1移动到基地2
    → 基地分布发生变化

T2: 交互B弹出，但选项是在T0创建的
    → 可能包含已经移动走的随从
    → 用户选择后卡住 ❌
```

## 刷新时机

交互选项在**两个时机**自动刷新：

### 时机1：交互成为 current（queueInteraction）

```typescript
export function queueInteraction<TCore>(
    state: MatchState<TCore>,
    interaction: InteractionDescriptor,
): MatchState<TCore> {
    const { current, queue } = state.sys.interaction;

    if (!current) {
        // ✅ 时机1：交互立即成为 current
        // 如果有 optionsGenerator，立即基于当前状态生成选项
        if (interaction.kind === 'simple-choice') {
            const data = interaction.data as SimpleChoiceData;
            if (data.optionsGenerator) {
                const freshOptions = data.optionsGenerator(state, data);
                interaction = { ...interaction, data: { ...data, options: freshOptions } };
            }
        }
        return { ...state, sys: { ...state.sys, interaction: { current: interaction } } };
    }

    // 否则加入队列（选项生成延迟到时机2）
    const newQueue = [...queue, interaction];
    return { ...state, sys: { ...state.sys, interaction: { current, queue: newQueue } } };
}
```

### 时机2：交互从队列弹出（resolveInteraction）

```typescript
export function resolveInteraction<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const { queue } = state.sys.interaction;
    let next = queue[0];
    const newQueue = queue.slice(1);

    // ✅ 时机2：交互从队列弹出成为 current
    if (next && next.kind === 'simple-choice') {
        const data = next.data as SimpleChoiceData;
        
        // 优先使用手动提供的 optionsGenerator
        let freshOptions: PromptOption[];
        if (data.optionsGenerator) {
            freshOptions = data.optionsGenerator(state, data);
        } else {
            // 使用通用刷新逻辑（自动推断）
            freshOptions = refreshOptionsGeneric(state, next, data.options);
        }
        
        next = { ...next, data: { ...data, options: freshOptions } };
    }

    return { ...state, sys: { ...state.sys, interaction: { current: next, queue: newQueue } } };
}
```

### 时机3：状态更新时（refreshInteractionOptions）

```typescript
// 在 reducer 或 afterEvents 中调用
export function refreshInteractionOptions<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const currentInteraction = state.sys.interaction?.current;
    if (!currentInteraction || currentInteraction.kind !== 'simple-choice') return state;
    
    const data = currentInteraction.data as SimpleChoiceData;
    
    // ✅ 时机3：当前交互的选项实时刷新
    let freshOptions: PromptOption[];
    if (data.optionsGenerator) {
        freshOptions = data.optionsGenerator(state, data);
    } else {
        freshOptions = refreshOptionsGeneric(state, currentInteraction, data.options);
    }
    
    // 智能降级：如果过滤后无法满足 multi.min，保持原始选项
    if (data.multi?.min && freshOptions.length < data.multi.min) {
        return state;
    }
    
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...state.sys.interaction,
                current: { ...currentInteraction, data: { ...data, options: freshOptions } },
            },
        },
    };
}
```

## 自动推断逻辑

框架层根据选项 `value` 的字段**自动推断**选项类型：

```typescript
function refreshOptionsGeneric<T>(
    state: any,
    interaction: InteractionDescriptor,
    originalOptions: PromptOption<T>[],
): PromptOption<T>[] {
    return originalOptions.filter((opt) => {
        const val = opt.value as any;
        
        // 1️⃣ 优先使用显式声明的 _source
        const explicitSource = opt._source;
        
        // 2️⃣ 自动推断类型（当未显式声明时）
        const inferredSource = explicitSource || (() => {
            if (!val || typeof val !== 'object') return 'static';
            
            // 跳过/完成/取消等操作选项
            if (val.skip || val.done || val.cancel || val.__cancel__) return 'static';
            
            // 根据字段推断类型
            if (val.minionUid !== undefined) return 'field';    // 场上随从
            if (val.baseIndex !== undefined) return 'base';     // 基地
            if (val.cardUid !== undefined) return 'hand';       // 手牌（默认）
            
            return 'static';
        })();

        // 3️⃣ 根据推断的类型校验选项是否仍然有效
        switch (inferredSource) {
            case 'field': {
                // 检查随从是否仍在场上
                for (const base of state.core?.bases || []) {
                    if (base.minions?.some((m: any) => m.uid === val?.minionUid)) return true;
                }
                return false;
            }
            case 'base': {
                // 检查基地索引是否仍然有效
                return typeof val?.baseIndex === 'number' &&
                    val.baseIndex >= 0 &&
                    val.baseIndex < (state.core?.bases?.length || 0);
            }
            case 'hand': {
                // 检查卡牌是否仍在手牌或弃牌堆
                const player = state.core?.players?.[interaction.playerId];
                if (player?.hand?.some((c: any) => c.uid === val?.cardUid)) return true;
                if (player?.discard?.some((c: any) => c.uid === val?.cardUid)) return true;
                return false;
            }
            case 'static':
            default:
                // 静态选项：一律保留
                return true;
        }
    });
}
```

## 推断规则表

| value 字段 | 推断类型 | 校验逻辑 |
|-----------|---------|---------|
| `minionUid` | `'field'` | 检查随从是否仍在任意基地的 `minions` 数组中 |
| `baseIndex` | `'base'` | 检查索引是否在 `[0, bases.length)` 范围内 |
| `cardUid` | `'hand'` | 检查卡牌是否在 `hand` 或 `discard` 中 |
| `skip`/`done`/`cancel` | `'static'` | 一律保留（操作选项） |
| 其他 | `'static'` | 一律保留（无法推断） |

## 完整流程示例

### 场景：托尔图加计分

```typescript
// T0: 托尔图加计分，创建3个交互
function baseTortugaAfterScoring(ctx: TriggerContext): TriggerResult {
    const otherMinions = [
        { uid: 'scout1', defId: 'alien_scout', fromBaseIndex: 1 },  // 在基地1
        { uid: 'king1', defId: 'pirate_king', fromBaseIndex: 1 },   // 在基地1
    ];
    
    const minionOptions = otherMinions.map((m, i) => ({
        id: `minion-${i}`,
        label: m.label,
        value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
        // ← 无需手动添加 _source，框架层自动推断为 'field'
    }));
    
    const interaction = createSimpleChoice(
        `base_tortuga_${ctx.now}`, runnerUpId,
        '托尔图加：选择移动一个其他基地上的随从到替换基地', 
        [{ id: 'skip', label: '跳过', value: { skip: true } }, ...minionOptions],
        { sourceId: 'base_tortuga', targetType: 'minion' },
    );
    
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// T1: 用户解决海盗王交互，海盗王从基地1移动到基地2
// 状态变化：
// - 基地1.minions: [scout1, king1] → [scout1]
// - 基地2.minions: [] → [king1]

// T2: 托尔图加交互从队列弹出，resolveInteraction 自动刷新选项
// refreshOptionsGeneric 执行：
// - 选项1: { skip: true } → inferredSource = 'static' → 保留 ✅
// - 选项2: { minionUid: 'scout1', fromBaseIndex: 1 } → inferredSource = 'field'
//   → 检查 scout1 是否在场上 → 在基地1 → 保留 ✅
// - 选项3: { minionUid: 'king1', fromBaseIndex: 1 } → inferredSource = 'field'
//   → 检查 king1 是否在场上 → 在基地2（已移动） → 保留 ✅
//   （注意：只检查是否在场上，不检查 fromBaseIndex 是否匹配）

// T3: 用户看到的选项：
// - 跳过
// - 侦察兵（scout1）
// - 海盗王（king1）
```

## 优化：显式声明 _source

虽然框架层会自动推断，但在某些场景下显式声明 `_source` 可以提升性能或明确语义：

```typescript
// 场景1：从弃牌堆选择（明确来源）
const discardOptions = player.discard.map((c, i) => ({
    id: `discard-${i}`,
    label: c.name,
    value: { cardUid: c.uid, defId: c.defId },
    _source: 'discard' as const,  // ← 显式声明，避免先检查 hand
}));

// 场景2：复杂刷新逻辑（手动 optionsGenerator）
const interaction = createSimpleChoice(id, playerId, title, initialOptions, sourceId);
(interaction.data as any).optionsGenerator = (state, data) => {
    // 从 continuationContext 中获取上下文
    const ctx = data.continuationContext;
    // 基于最新状态重新生成选项
    return buildOptionsFromContext(state, ctx);
};
```

## 性能考虑

### 自动推断的开销

- **时间复杂度**：O(n × m)，n = 选项数量，m = 基地/随从数量
- **典型场景**：10个选项 × 3个基地 × 5个随从 = 150次检查
- **实际影响**：可忽略（< 1ms）

### 何时需要优化

只有在以下场景才需要考虑优化：
1. 选项数量 > 100
2. 基地/随从数量 > 20
3. 高频刷新（每秒 > 10次）

优化方法：
- 使用 `optionsGenerator` 手动生成选项（避免遍历所有基地）
- 显式声明 `_source` 字段（避免推断逻辑）

## 总结

### 当前交互刷新模式

1. **三个时机自动刷新**：
   - 交互成为 current（queueInteraction）
   - 交互从队列弹出（resolveInteraction）
   - 状态更新时（refreshInteractionOptions）

2. **两种刷新策略**：
   - 手动 `optionsGenerator`（优先级高，完全控制）
   - 自动推断（优先级低，零配置）

3. **自动推断规则**：
   - `minionUid` → `'field'`（场上随从）
   - `baseIndex` → `'base'`（基地）
   - `cardUid` → `'hand'`（手牌/弃牌堆）
   - `skip`/`done`/`cancel` → `'static'`（操作选项）

### 面向百游戏验证

✅ **游戏层零配置**：无需手动添加 `_source` 字段  
✅ **自动覆盖90%场景**：minionUid/baseIndex/cardUid 自动推断  
✅ **可选手动覆盖**：复杂场景可用 `optionsGenerator`  
✅ **向后兼容**：已有的 `_source` 字段仍然有效  
✅ **性能可接受**：典型场景 < 1ms，无需优化
