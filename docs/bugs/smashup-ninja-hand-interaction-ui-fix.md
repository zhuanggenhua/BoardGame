# 忍者派系手牌交互 UI 修复

## 问题描述

便衣忍者和忍者侍从在 Me First! 响应窗口中打出时，交互 UI 不显示，导致用户以为游戏卡住了。

## 根因分析

### UI 层的设计假设

Board.tsx 中的交互渲染逻辑基于以下假设：

1. **手牌选择交互**（`targetType: 'hand'`）：
   - 如果所有选项都是手牌（`cardUid` 字段），用户在手牌区直接点击选择
   - 如果有非手牌选项（如"跳过"），显示浮动按钮

2. **渲染条件**：
   ```typescript
   // PromptOverlay 不渲染（因为 isHandDiscardPrompt === true）
   {!isHandDiscardPrompt && ... && (
       <PromptOverlay ... />
   )}
   
   // 浮动按钮只在有非手牌选项时显示
   {isHandDiscardPrompt && handSelectExtraOptions.length > 0 && (
       <motion.div>...</motion.div>
   )}
   ```

### 便衣忍者/忍者侍从的实际情况

- `targetType: 'hand'` → `isHandDiscardPrompt === true`
- 所有选项都是手牌（`cardUid` 字段）→ `handSelectExtraOptions.length === 0`
- 结果：`PromptOverlay` 不渲染，浮动按钮也不渲染
- **用户看不到任何交互 UI**

### 设计冲突

**便衣忍者/忍者侍从的实际需求**：
- 在 Me First! 响应窗口中打出（不是正常出牌阶段）
- 需要弹窗显示交互（不是手牌区直接点击）
- 所有选项都是手牌（没有"跳过"选项）

**UI 层的假设**：
- `targetType: 'hand'` + 所有选项都是手牌 → 手牌区直接点击
- 没有非手牌选项 → 不显示浮动按钮

**冲突点**：
- 便衣忍者使用 `targetType: 'hand'` 是为了触发框架层的自动刷新（过滤已不在手牌中的卡牌）
- 但 `targetType: 'hand'` 同时触发了 UI 层的"手牌区直接点击"模式
- 便衣忍者实际需要的是"弹窗显示手牌选项"，而不是"手牌区直接点击"

## 解决方案

### 方案1：添加"跳过"选项（已实施）

为便衣忍者和忍者侍从添加"跳过"选项，使其符合 UI 层的设计假设。

**修改内容**：

1. **便衣忍者**（`src/games/smashup/abilities/ninjas.ts`）：
   ```typescript
   function ninjaHiddenNinja(ctx: AbilityContext): AbilityResult {
       // ...
       const options = minionCards.map(...);
       const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };
       
       const interaction = createSimpleChoice(
           `ninja_hidden_ninja_${ctx.now}`, ctx.playerId,
           '选择要打出到该基地的随从（可跳过）',
           [...options, skipOption],
           { sourceId: 'ninja_hidden_ninja', targetType: 'hand' },
       );
       // ...
   }
   
   // 交互处理器
   registerInteractionHandler('ninja_hidden_ninja', (state, playerId, value, ...) => {
       if ((value as any).skip) return { state, events: [] };
       // ...
   });
   ```

2. **忍者侍从**（`src/games/smashup/abilities/ninjas.ts`）：
   ```typescript
   function ninjaAcolyteSpecial(ctx: AbilityContext): AbilityResult {
       // ...
       const allOptions = [...minionCards, acolyteSelf];
       const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };
       
       const interaction = createSimpleChoice(
           `ninja_acolyte_play_${ctx.now}`, ctx.playerId,
           '选择要打出到该基地的随从（可跳过）',
           [...allOptions, skipOption],
           { sourceId: 'ninja_acolyte_play', targetType: 'hand' },
       );
       // ...
   }
   
   // 交互处理器
   registerInteractionHandler('ninja_acolyte_play', (state, playerId, value, ...) => {
       if ((value as any).skip) return { state, events: [] };
       // ...
   });
   ```

### 修复效果

修复后，便衣忍者/忍者侍从交互的行为：
- `targetType: 'hand'` → `isHandDiscardPrompt === true`
- 有非手牌选项（"跳过"）→ `handSelectExtraOptions.length > 0`
- 结果：浮动按钮显示，用户可以看到交互 UI

### 用户体验改进

1. **可见性**：浮动按钮始终显示，用户不会以为卡住了
2. **灵活性**：用户可以选择不打出随从（跳过）
3. **一致性**：与其他技能（如忍者大师、猛虎刺客）的交互模式一致

## 测试

创建了 E2E 测试 `e2e/ninja-hidden-ninja-skip-option.e2e.ts`：

1. **测试场景1**：验证浮动按钮显示（包含"跳过"选项）
2. **测试场景2**：验证可以选择手牌中的随从

## 相关 Bug

- `docs/bugs/smashup-ninja-hidden-ninja-interaction-not-visible.md` - 之前的便衣忍者 UI bug（2026/2/27 修复）
- `docs/bugs/smashup-tortuga-无法结束回合-analysis.md` - 当前 bug 的详细分析

## 教训

1. **数据驱动与 UI 假设的冲突**：`targetType` 字段同时用于框架层（自动刷新）和 UI 层（渲染模式），需要确保两者的假设一致

2. **交互选项的完整性**：手牌选择交互如果没有非手牌选项（如"跳过"），UI 层会假设用户在手牌区直接点击，不显示弹窗

3. **测试覆盖**：E2E 测试应该覆盖交互 UI 的可见性，而不仅仅是功能正确性

4. **面向百游戏设计**：框架层的自动刷新机制（`targetType` 字段）是正确的，但需要确保游戏层的交互选项符合 UI 层的假设

## 未来改进

### 方案2：UI 层支持"强制弹窗"模式（未实施）

如果未来有更多类似的场景（需要弹窗但所有选项都是手牌），可以考虑在 `interaction.data` 中添加 `forceOverlay: true` 字段：

```typescript
const interaction = createSimpleChoice(
    id, playerId, title, options,
    { sourceId, targetType: 'hand', forceOverlay: true }, // 强制使用弹窗
);
```

UI 层判断：
```typescript
const isHandDiscardPrompt = useMemo(() => {
    // ...
    // 强制弹窗模式：即使 targetType === 'hand'，也不走手牌直选
    if ((currentInteraction?.data as any)?.forceOverlay) return false;
    // ...
}, [currentPrompt, currentInteraction]);
```

**优点**：
- 更灵活，支持"手牌选择但必须弹窗"的场景
- 不需要添加"跳过"选项

**缺点**：
- 增加了框架层的复杂度
- 引入了新的配置字段
- 当前场景下添加"跳过"选项已经足够

## 总结

通过为便衣忍者和忍者侍从添加"跳过"选项，解决了交互 UI 不显示的问题。修复符合 UI 层的设计假设，同时改善了用户体验（允许跳过）。
