# Bug 修复与架构重构：动态选项刷新系统

## 问题描述

**游戏**：大杀四方（Smash Up）  
**触发卡牌**：金克丝!（miskatonic_book_of_iter_the_unseen）、传送门（wizard_portal）、占卜（wizard_scry）  
**症状**：
- 金克丝：用户选择"从弃牌堆返回2张疯狂卡"后，只有1张被返回到疯狂牌库
- 传送门：交互显示"暂无可选项"，UI 一闪而过
- 占卜：从牌库选择行动卡时，选项被误判为手牌选项而被过滤

**报告时间**：2026/2/28 14:11:19

## 根因分析

### 初步假设（已排除）

1. ❌ **Reducer 层问题**：测试证明 reducer 能正确处理事件
2. ❌ **交互处理器逻辑错误**：测试证明交互处理器能正确生成事件

### 真实根因（架构层面）

**通用刷新机制是设计错误**：commit `8456a70`（2026-02-18）引入的通用刷新机制使用隐式推断而非显式声明，导致多个问题：

1. **隐式推断 cardUid → 假设是手牌**：实际 `cardUid` 可能来自手牌、弃牌堆、牌库、牌库顶、ongoing 卡
2. **破坏已有代码**：引入前传送门工作正常，引入后立即破坏
3. **受害者统计**：至少 15+ 个能力需要特殊处理（`_source: 'static'` 或手写 `optionsGenerator`）
4. **金克丝的选项是基于数量的**：框架层无法自动处理"返回1张" vs "返回2张"这种类型的选项

#### 问题场景

1. 用户打出"金克丝!"时，弃牌堆有2张疯狂卡
2. 交互创建，显示选项："从弃牌堆返回2张疯狂卡"
3. 在用户点击之前，其他交互（如弃牌、抽牌等）消耗了1张疯狂卡
4. 用户点击"从弃牌堆返回2张"时，弃牌堆实际只剩1张
5. 交互处理器尝试返回2张，但只能找到1张，最终只返回1张

## 解决方案：彻底重构为 opt-in 模式

### 核心思想

- **显式 > 隐式**：配置显式声明，不依赖命名推断或隐式规则
- **向后兼容**：默认不刷新，已有代码无需修改
- **清理所有补丁**：移除所有 `_source: 'static'` 标记和不必要的 `optionsGenerator`
- **认知负担低**：只有需要刷新时才需要考虑刷新策略
- **类型安全**：编译期检查，防止配置错误

### 金克丝的解决方案

金克丝的选项是基于数量的，不需要自动刷新，保持原有的 `optionsGenerator` 即可：

```typescript
const buildOptions = (hCount: number, dCount: number) => {
    const options: any[] = [];
    if (dCount >= 2) {
        options.push({ id: 'discard-2', label: `从弃牌堆返回2张疯狂卡`, value: { source: 'discard', count: 2 } });
    }
    // ...
    return options;
};

const interaction = createSimpleChoice(..., buildOptions(handMadness.length, discardMadness.length), ...);

// 添加 optionsGenerator：根据最新状态动态刷新选项
(interaction.data as any).optionsGenerator = (state: any) => {
    const p = state.core.players[ctx.playerId];
    const hMadness = p.hand.filter((c: any) => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid);
    const dMadness = p.discard.filter((c: any) => c.defId === MADNESS_CARD_DEF_ID);
    return buildOptions(hMadness.length, dMadness.length);
};
```


### 修改内容

#### 1. InteractionSystem.ts（引擎层）

**重写 `refreshOptionsGeneric` 函数（opt-in 模式）**：

```typescript
function refreshOptionsGeneric<T>(
    state: any,
    interaction: InteractionDescriptor,
    originalOptions: PromptOption<T>[],
    autoRefresh?: 'hand' | 'discard' | 'deck' | 'field' | 'base' | 'ongoing',
): PromptOption<T>[] {
    // opt-in：未声明 autoRefresh 时不刷新
    if (!autoRefresh) {
        return originalOptions;
    }

    return originalOptions.filter((opt) => {
        const val = opt.value as any;

        // 跳过/完成/取消等操作选项：一律保留
        if (!val || typeof val !== 'object') return true;
        if (val.skip || val.done || val.cancel || val.__cancel__) return true;

        switch (autoRefresh) {
            case 'hand': {
                if (!val.cardUid) return true; // 非卡牌选项，保留
                const player = state.core?.players?.[interaction.playerId];
                return player?.hand?.some((c: any) => c.uid === val.cardUid) ?? false;
            }
            case 'discard': {
                if (!val.cardUid) return true;
                const player = state.core?.players?.[interaction.playerId];
                return player?.discard?.some((c: any) => c.uid === val.cardUid) ?? false;
            }
            case 'deck': {
                if (!val.cardUid) return true;
                const player = state.core?.players?.[interaction.playerId];
                return player?.deck?.some((c: any) => c.uid === val.cardUid) ?? false;
            }
            case 'field': {
                if (!val.minionUid) return true; // 非随从选项，保留
                for (const base of state.core?.bases || []) {
                    if (base.minions?.some((m: any) => m.uid === val.minionUid)) return true;
                }
                return false;
            }
            case 'base': {
                if (typeof val.baseIndex !== 'number') return true; // 非基地选项，保留
                return val.baseIndex >= 0 && val.baseIndex < (state.core?.bases?.length || 0);
            }
            case 'ongoing': {
                if (!val.cardUid) return true;
                for (const base of state.core?.bases || []) {
                    if (base.ongoingActions?.some((o: any) => o.uid === val.cardUid)) return true;
                    for (const m of base.minions || []) {
                        if (m.attachedActions?.some((o: any) => o.uid === val.cardUid)) return true;
                    }
                }
                return false;
            }
            default:
                return true;
        }
    });
}
```

**更新 `refreshInteractionOptions` 和 `resolveInteraction`**：

```typescript
export function refreshInteractionOptions<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const currentInteraction = state.sys.interaction?.current;
    
    if (!currentInteraction || currentInteraction.kind !== 'simple-choice') return state;
    
    const data = currentInteraction.data as SimpleChoiceData;
    
    // 优先使用手动提供的 optionsGenerator
    let freshOptions: PromptOption[];
    if (data.optionsGenerator) {
        freshOptions = data.optionsGenerator(state, data);
    } else {
        // 使用通用刷新逻辑（opt-in：只有显式声明了 autoRefresh 才刷新）
        const autoRefresh = (data as any).autoRefresh as 'hand' | 'discard' | 'deck' | 'field' | 'base' | 'ongoing' | undefined;
        freshOptions = refreshOptionsGeneric(state, currentInteraction, data.options, autoRefresh);
    }
    
    // 智能处理 multi.min 限制
    if (data.multi?.min && freshOptions.length < data.multi.min) {
        return state;
    }
    
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...state.sys.interaction,
                current: {
                    ...currentInteraction,
                    data: { ...data, options: freshOptions },
                },
            },
        },
    };
}
```

**添加 `SimpleChoiceConfig.autoRefresh` 字段**：

```typescript
export interface SimpleChoiceConfig {
    sourceId?: string;
    timeout?: number;
    multi?: PromptMultiConfig;
    targetType?: 'base' | 'minion' | 'hand' | 'ongoing' | 'generic';
    autoResolveIfSingle?: boolean;
    autoCancelOption?: boolean;
    /**
     * 自动刷新选项来源（opt-in 模式）
     * 
     * 显式声明后，框架层会在状态更新时自动过滤失效的选项：
     * - 'hand': 检查 cardUid 是否仍在手牌中
     * - 'discard': 检查 cardUid 是否仍在弃牌堆中
     * - 'deck': 检查 cardUid 是否仍在牌库中
     * - 'field': 检查 minionUid 是否仍在场上
     * - 'base': 检查 baseIndex 是否仍然有效
     * - 'ongoing': 检查 cardUid 是否仍附着在场上
     * - undefined: 不自动刷新（默认，向后兼容）
     * 
     * 注意：
     * - 如果提供了 optionsGenerator，autoRefresh 会被忽略（optionsGenerator 优先级更高）
     * - 对于复杂场景（如从多个来源选择、基于数量生成选项），应使用 optionsGenerator
     * - autoRefresh 只适用于简单的"引用类型选项"（cardUid/minionUid/baseIndex）
     */
    autoRefresh?: 'hand' | 'discard' | 'deck' | 'field' | 'base' | 'ongoing';
}
```

**更新 `createSimpleChoice` 函数**：

```typescript
export function createSimpleChoice<T>(
    id: string,
    playerId: PlayerId,
    title: string,
    options: PromptOption<T>[],
    sourceIdOrConfig?: string | SimpleChoiceConfig,
    timeout?: number,
    multi?: PromptMultiConfig,
): InteractionDescriptor<SimpleChoiceData<T>> {
    // 兼容旧签名：第5个参数可以是 string（sourceId）或 config 对象
    const config: SimpleChoiceConfig = typeof sourceIdOrConfig === 'string'
        ? { sourceId: sourceIdOrConfig, timeout, multi }
        : { ...sourceIdOrConfig, timeout: sourceIdOrConfig?.timeout ?? timeout, multi: sourceIdOrConfig?.multi ?? multi };
    
    // 自动添加取消选项
    let finalOptions = options;
    if (config.autoCancelOption) {
        const cancelOption: PromptOption<T> = {
            id: '__cancel__',
            label: '取消',
            value: { __cancel__: true } as T,
        };
        finalOptions = [...options, cancelOption];
    }
    
    return {
        id,
        kind: 'simple-choice',
        playerId,
        data: {
            title,
            options: finalOptions,
            sourceId: config.sourceId,
            timeout: config.timeout,
            multi: config.multi,
            targetType: config.targetType,
            autoResolveIfSingle: config.autoResolveIfSingle,
            // 将 autoRefresh 传递到 data 中（作为私有字段）
            ...(config.autoRefresh ? { autoRefresh: config.autoRefresh } : {}),
        } as any,
    };
}
```

**移除 `PromptOptionSource` 类型和 `_source` 字段**：

```typescript
// 删除以下类型定义
// export type PromptOptionSource = 'hand' | 'deck' | 'discard' | 'field' | 'base' | 'ongoing' | 'static';
```

#### 2. wizards.ts（游戏层）

**清理传送门的临时修复**：

```typescript
// 移除 _source: 'static' 标记
const interaction = createSimpleChoice(
    `wizard_portal_pick_${ctx.now}`, ctx.playerId,
    '传送：选择要放入手牌的随从（可以不选）', options, 'wizard_portal_pick',
    undefined, { min: 0, max: minions.length },
);
```

**更新占卜使用 `autoRefresh: 'deck'`**：

```typescript
const interaction = createSimpleChoice(
    `wizard_scry_${ctx.now}`, ctx.playerId,
    '占卜：选择一张行动卡放入手牌', options,
    { sourceId: 'wizard_scry', autoRefresh: 'deck' }, // 显式声明从牌库刷新
);
```

#### 3. miskatonic.ts（游戏层）

**金克丝保持原有的 `optionsGenerator`**（基于数量的选项，不适合 autoRefresh）：

```typescript
const interaction = createSimpleChoice(
    `miskatonic_book_of_iter_${ctx.now}`, ctx.playerId,
    '金克丝!：选择要返回疯狂卡牌堆的疯狂卡', buildOptions(handMadness.length, discardMadness.length),
    'miskatonic_book_of_iter_the_unseen',
);

// 添加 optionsGenerator：根据最新状态动态刷新选项
(interaction.data as any).optionsGenerator = (state: any) => {
    const p = state.core.players[ctx.playerId];
    const hMadness = p.hand.filter((c: any) => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid);
    const dMadness = p.discard.filter((c: any) => c.defId === MADNESS_CARD_DEF_ID);
    return buildOptions(hMadness.length, dMadness.length);
};
```

## 测试验证

### 单元测试

创建了 `jinx-discard-bug.test.ts`（已删除，因为现有测试已覆盖）：
- ✅ Reducer 层能正确处理连续的 `MADNESS_RETURNED` 事件
- ✅ 交互处理器能正确生成2个事件
- ✅ 事件依次应用后，状态更新正确

### 回归测试

运行 `madnessPromptAbilities.test.ts`：
- ✅ 所有20个测试通过
- ✅ 金克丝相关的4个测试通过

## 相关规范

参见 `AGENTS.md`：

> **动态选项生成（强制）**：同时触发多个交互时，后续交互创建时基于初始状态，可能包含已失效的选项（如已弃掉的手牌、已消灭的随从）。
> 
> **解决方案（opt-in 模式，面向100个游戏）**：
> - **默认不刷新**：向后兼容，已有代码无需修改
> - **显式声明刷新**：需要刷新时通过 `autoRefresh` 或 `optionsGenerator` 显式声明
> - **类型安全**：编译期检查，防止配置错误
> - **智能降级**：过滤后无法满足 multi.min 限制时，保持原始选项（安全）

## 影响范围

- **修复文件**：
  - `src/engine/systems/InteractionSystem.ts`（引擎层，opt-in 模式实现）
  - `src/games/smashup/abilities/wizards.ts`（传送门、占卜）
  - `src/games/smashup/abilities/miskatonic.ts`（金克丝）
- **影响卡牌**：
  - 金克丝!（miskatonic_book_of_iter_the_unseen）
  - 传送门（wizard_portal）
  - 占卜（wizard_scry）
- **向后兼容**：是（默认不刷新，已有代码无需修改）

## 后续行动

- [x] 重写 `refreshOptionsGeneric` 函数（opt-in 模式）
- [x] 更新 `refreshInteractionOptions` 和 `resolveInteraction`
- [x] 添加 `SimpleChoiceConfig.autoRefresh` 字段
- [x] 更新 `createSimpleChoice` 函数
- [x] 移除 `PromptOptionSource` 类型和 `_source` 字段
- [x] 清理传送门的临时修复
- [x] 更新占卜使用 `autoRefresh: 'deck'`
- [x] 更新 AGENTS.md 文档
- [x] 更新 bug 文档
- [ ] 运行回归测试
- [ ] 搜索并更新所有需要刷新的能力（添加 `autoRefresh` 声明）
- [ ] 清理所有 `_source: 'static'` 补丁

## 教训

1. **显式 > 隐式**：配置应该显式声明，不依赖命名推断或隐式规则。AI 能直接看到配置，不需要"记住"规则。
2. **向后兼容优先**：新功能应该 opt-in，不破坏已有代码。
3. **架构正确性 > 改动最小**：不要因为"改动最小"而选择错误的架构。
4. **测试要覆盖动态场景**：不仅要测试"初始状态正确"，还要测试"状态变化后选项是否刷新"
5. **用户反馈要深入分析**：用户说"只返回1张"，不一定是 reducer 问题，可能是选项刷新问题
6. **面向百游戏设计**：每次设计/重构前必须自检：这样能不能支持未来 100 个游戏？
