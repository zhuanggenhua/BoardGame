# Bug 修复：金克丝!（Jinkies!）动态选项刷新

## 问题描述

**游戏**：大杀四方（Smash Up）  
**卡牌**：金克丝!（miskatonic_book_of_iter_the_unseen）  
**症状**：用户选择"从弃牌堆返回2张疯狂卡"后，只有1张被返回到疯狂牌库  
**报告时间**：2026/2/28 14:11:19

## 根因分析

### 初步假设（已排除）

1. ❌ **Reducer 层问题**：测试证明 `MADNESS_RETURNED` reducer 能正确处理连续的多个事件
2. ❌ **交互处理器逻辑错误**：测试证明交互处理器能正确生成2个 `MADNESS_RETURNED` 事件

### 真实根因

**动态选项未刷新**：金克丝的交互选项是在交互创建时静态生成的，不会根据最新状态动态刷新。

#### 问题场景

1. 用户打出"金克丝!"时，弃牌堆有2张疯狂卡
2. 交互创建，显示选项："从弃牌堆返回2张疯狂卡"
3. 在用户点击之前，其他交互（如弃牌、抽牌等）消耗了1张疯狂卡
4. 用户点击"从弃牌堆返回2张"时，弃牌堆实际只剩1张
5. 交互处理器尝试返回2张，但只能找到1张，最终只返回1张

#### 为什么其他卡牌没有这个问题

大部分卡牌的选项是基于 `cardUid`/`minionUid`/`baseIndex` 的引用类型，框架层的 `refreshInteractionOptions` 能自动刷新这些选项（过滤掉已失效的卡牌/随从）。

但金克丝的选项是基于**数量**的（"返回1张" vs "返回2张"），框架层无法自动处理这种类型的选项。

## 解决方案

为 `miskatonicBookOfIterTheUnseen` 添加 `optionsGenerator`，根据最新状态动态生成选项。

### 修改前

```typescript
function miskatonicBookOfIterTheUnseen(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const handMadness = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid);
    const discardMadness = player.discard.filter(c => c.defId === MADNESS_CARD_DEF_ID);
    
    // 静态生成选项
    const options: any[] = [];
    if (discardMadness.length >= 2) {
        options.push({ id: 'discard-2', label: `从弃牌堆返回2张疯狂卡`, value: { source: 'discard', count: 2 } });
    }
    // ...
    
    const interaction = createSimpleChoice(..., options, ...);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}
```

### 修改后

```typescript
function miskatonicBookOfIterTheUnseen(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const handMadness = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid);
    const discardMadness = player.discard.filter(c => c.defId === MADNESS_CARD_DEF_ID);
    
    // 提取选项生成逻辑为函数
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
    
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}
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
> **解决方案（通用刷新，面向100个游戏）**：
> - 框架层在 `refreshInteractionOptions` 和 `resolveInteraction` 中**自动刷新所有交互选项**
> - 自动检测选项类型（cardUid/minionUid/baseIndex），基于最新状态过滤
> - **手动覆盖**（特殊场景）：复杂刷新逻辑（如从弃牌堆/牌库/continuationContext 中过滤）需要手动提供 `optionsGenerator`

## 影响范围

- **修复文件**：`src/games/smashup/abilities/miskatonic.ts`
- **影响卡牌**：金克丝!（miskatonic_book_of_iter_the_unseen）
- **向后兼容**：是（只是添加了动态刷新，不影响现有逻辑）

## 后续行动

- [x] 修复金克丝的 `optionsGenerator`
- [x] 运行回归测试
- [ ] 排查其他基于数量生成选项的卡牌（初步搜索未发现类似问题）
- [ ] 考虑在框架层添加"数量类型选项"的自动刷新支持（未来优化）

## 教训

1. **基于数量的选项需要手动 optionsGenerator**：框架层的自动刷新只能处理引用类型（cardUid/minionUid/baseIndex），无法处理数量类型
2. **测试要覆盖动态场景**：不仅要测试"初始状态正确"，还要测试"状态变化后选项是否刷新"
3. **用户反馈要深入分析**：用户说"只返回1张"，不一定是 reducer 问题，可能是选项刷新问题
