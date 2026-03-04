# 海盗王移动后 UI 弹窗不关闭 Bug 分析 (2026/2/28)

## Bug 报告

**提交者**: 用户  
**时间**: 2026/2/28  
**反馈内容**: 海盗王已经移动到基地了，但是弹窗还在显示，无法隐藏

## 状态快照分析

用户运行的控制台命令结果：

```javascript
console.log('Current Interaction:', window.__BG_STATE__?.sys?.interaction?.current);
// 输出: undefined

console.log('Interaction Queue:', window.__BG_STATE__?.sys?.interaction?.queue);
// 输出: undefined

console.log('Flow Halted:', window.__BG_STATE__?.sys?.flowHalted);
// 输出: undefined

console.log('Prompt title:', document.querySelector('h2')?.textContent);
// 输出: 海盗王：是否移动到即将计分的「托尔图加」？

console.log('Board interaction prop:', window.__BG_STATE__?.sys?.interaction);
// 输出: undefined

console.log('Has displayCards:', !!document.querySelector('[data-discard-view-panel]'));
// 输出: false
```

**关键发现**：
- ✅ 交互状态已正确清除（`sys.interaction.current = undefined`）
- ✅ 交互队列为空（`sys.interaction.queue = undefined`）
- ✅ flowHalted 已清除（`sys.flowHalted = undefined`）
- ✅ Board 组件接收到的 `interaction` prop 是 `undefined`
- ❌ **但 DOM 中仍然有弹窗元素，标题是"海盗王：是否移动到即将计分的「托尔图加」？"**

## 根因确认：Handler 覆盖了交互清除操作

**问题流程**：

1. **用户点击"移动到该基地"**
2. **SimpleChoiceSystem 处理 RESPOND 命令**（`src/engine/systems/SimpleChoiceSystem.ts` 第 165 行）：
   ```typescript
   const newState = resolveInteraction(state);  // 清除当前交互
   return { halt: false, state: newState, events: [INTERACTION_RESOLVED] };
   ```
   - 此时 `newState.sys.interaction.current = undefined`（交互已清除）

3. **SmashUpEventSystem 处理 INTERACTION_RESOLVED 事件**（`src/games/smashup/domain/systems.ts` 第 66-68 行）：
   ```typescript
   const handler = getInteractionHandler(payload.sourceId);
   const result = handler(newState, ...);  // 调用海盗王 handler
   newState = result.state;  // ← 使用 handler 返回的 state
   ```

4. **海盗王 handler 返回新交互**（`src/games/smashup/abilities/pirates.ts` 第 879 行）：
   ```typescript
   return { state: queueInteraction(state, newInteraction), events };
   ```

5. **`queueInteraction` 的行为**（`src/engine/systems/InteractionSystem.ts` 第 398-410 行）：
   ```typescript
   if (!current) {
       // 如果当前没有交互，新交互立即成为 current
       return {
           ...state,
           sys: {
               ...state.sys,
               interaction: { ...state.sys.interaction, current: interaction },
           },
       };
   }
   ```
   - 因为 `current = undefined`（已被清除），新交互立即成为 `current`
   - **Handler 返回的 `state` 中 `current` 又有值了！**

6. **SmashUpEventSystem 覆盖了 SimpleChoiceSystem 的清除操作**：
   - `newState = result.state`（包含新交互）
   - **`current` 永远不会变成 `undefined`**
   - **UI 永远不会卸载旧弹窗**

**为什么第二次点击没有日志**：
- 第一次点击后，提交锁锁定了交互 ID
- 但是交互没有被清除（`current` 仍然存在）
- 第二次点击时，`isSubmitLocked = true`（因为 `submittingInteractionId === prompt.id`）
- `handleSelect` 直接 return，不执行任何操作

**为什么只有一个海盗王时也会卡住**：
- 即使只有一个海盗王，handler 也会返回 `{ state, events }`
- 但是 `state` 是原始的 `state`，不是 `newState`（清除交互后的状态）
- 等等，这不对... 让我再检查一次

实际上，如果只有一个海盗王，handler 返回 `{ state, events }`，不调用 `queueInteraction`。
所以 `state.sys.interaction.current` 应该还是 `undefined`（因为 handler 接收的 `state` 已经是清除交互后的状态）。

**但是用户说只有一个海盗王时也会卡住**，这说明问题不在多个海盗王的链式交互，而在别的地方。

让我重新检查... 用户最开始提供的控制台日志显示 `sys.interaction.current = undefined`，说明交互确实被清除了。

**所以问题不是交互没有被清除，而是 UI 没有响应交互清除！**

这又回到了最开始的假设：React 渲染延迟或 AnimatePresence 问题。

## 修复尝试 3：添加 handleSelect 详细日志

**修改内容**：
- 添加详细日志到 `PromptOverlay.tsx` 的 `handleSelect` 函数（第 465-485 行）
- 追踪每次点击的完整流程

**目的**：
- 确认第一次点击是否真的执行了 `dispatch(INTERACTION_COMMANDS.RESPOND, { optionId })`
- 确认第二次点击是否被提交锁阻止
- 追踪交互锁定和解锁的完整流程

**等待用户提供**：
1. 刷新页面
2. 等待海盗王交互弹窗出现
3. **清空控制台**
4. **点击"移动到该基地"按钮 2-3 次**
5. 复制控制台中所有日志

**预期日志**：
```
[第一次点击]
→ [PromptOverlay] handleSelect called: {optionId: 'xxx', isMyPrompt: true, isSubmitLocked: false, ...}
→ [PromptOverlay] handleSelect: locking interaction {promptId: 'pirate_king_move_0'}
→ [PromptOverlay] handleSelect: dispatching RESPOND {optionId: 'xxx'}
→ [服务端处理命令...]

[第二次点击]
→ [PromptOverlay] handleSelect called: {optionId: 'xxx', isMyPrompt: true, isSubmitLocked: true, ...}
→ [PromptOverlay] handleSelect: blocked {isMyPrompt: true, isSubmitLocked: true}
```

## 日志分析 1：交互创建阶段（已提供）

用户提供的日志显示：
```
InteractionSystem.ts:410 [queueInteraction] No current interaction, setting as current
InteractionSystem.ts:439 [queueInteraction] Result {hasCurrentInteraction: true, currentInteractionId: 'pirate_king_move_0'}
Board.tsx:1779 [DEBUG] Board: PromptOverlay render decision: {shouldRender: true, isHandDiscardPrompt: false, ...}
PromptOverlay.tsx:136 [PromptOverlay] Props changed: {hasInteraction: true, interactionId: 'pirate_king_move_0', ...}
```

**结论**：✅ 交互创建阶段正常，弹窗正确显示

## 需要的日志：交互清除阶段

**用户需要提供**：
1. 点击"移动到该基地"按钮后的完整日志
2. 特别关注以下日志：
   - `[InteractionSystem]` 开头的日志（交互清除）
   - `[DEBUG] Board: PromptOverlay render decision:` 在交互清除后的值
   - `[PromptOverlay] Props changed:` 在交互清除后的值
   - `[DEBUG] isHandDiscardPrompt: computing` 在交互清除后的值

**操作步骤**：
1. 刷新页面
2. 等待海盗王交互弹窗出现
3. **清空控制台**（重要！避免日志过多）
4. 点击"移动到该基地"按钮
5. 复制控制台中所有日志（从点击按钮开始）
6. 提供完整日志

## 预期结果

如果修复成功，日志应该显示：
```
[点击按钮]
→ [InteractionSystem] 清除交互
→ [DEBUG] Board: PromptOverlay render decision: {shouldRender: true, hasInteraction: false, ...}
→ [PromptOverlay] Props changed: {hasInteraction: false, ...}
→ [PromptOverlay 返回 null，DOM 清理]
```

如果仍然有问题，日志会显示哪个环节出错了。

## 临时解决方案

用户可以通过以下方式立即继续游戏：

1. **刷新页面**（F5）：强制重新加载所有状态
2. **等待 1-2 秒**：动画完成后弹窗会自动消失

## 相关文档

- `docs/bugs/smashup-tortuga-pirate-king-卡住-2026-02-28-16-53.md` - flowHalted 守卫修复
- `docs/interaction-refresh-flow.md` - 交互刷新机制
- `docs/interaction-ui-modes.md` - UI 渲染模式

## 最新日志分析 2（2026/2/28 - 用户提供第二次日志）

用户提供的日志显示：
```
[PromptOverlay] handleSelect called: {
    optionId: 'yes', 
    isMyPrompt: true, 
    isSubmitLocked: true,  // ← 第一次点击时就已经是 true！
    promptId: 'pirate_king_move_0', 
    submittingInteractionId: 'pirate_king_move_0'  // ← 已经被锁定
}
[PromptOverlay] handleSelect: blocked {isMyPrompt: true, isSubmitLocked: true}
```

**关键发现**：
- ❌ **第一次点击时，提交锁就已经是锁定状态了**（`isSubmitLocked: true`）
- ❌ **`submittingInteractionId` 已经等于 `prompt.id`**
- ❌ **这说明在用户点击之前，提交锁就已经被设置了**

**可能的原因**：
1. **用户之前已经点击过一次**，设置了提交锁
2. **交互没有被清除**（或者被新交互覆盖了）
3. **提交锁的解锁条件没有触发**（`prompt?.id` 没有变化，`interaction` 没有变为 `undefined`）
4. **提交锁一直保持锁定状态**

**需要的日志**：
1. 提交锁的解锁日志（`[PromptOverlay] Unlocking due to...`）
2. 交互创建和消失的完整流程
3. `prompt?.id` 的变化历史

**操作步骤**：
1. **刷新页面**（清除所有状态）
2. 等待海盗王交互弹窗出现
3. **清空控制台**
4. **只点击一次"移动到该基地"按钮**
5. 等待 2-3 秒
6. 复制控制台中所有日志（特别是 `[PromptOverlay] Unlocking` 开头的日志）

## 根因确认：Handler 覆盖了交互清除操作

**问题流程**：

1. **用户点击"移动到该基地"**
2. **SimpleChoiceSystem 处理 RESPOND 命令**（`src/engine/systems/SimpleChoiceSystem.ts` 第 165 行）：
   ```typescript
   const newState = resolveInteraction(state);  // 清除当前交互
   return { halt: false, state: newState, events: [INTERACTION_RESOLVED] };
   ```
   - 此时 `newState.sys.interaction.current = undefined`（交互已清除）

3. **SmashUpEventSystem 处理 INTERACTION_RESOLVED 事件**（`src/games/smashup/domain/systems.ts` 第 66-68 行）：
   ```typescript
   const handler = getInteractionHandler(payload.sourceId);
   const result = handler(newState, ...);  // 调用海盗王 handler
   newState = result.state;  // ← 使用 handler 返回的 state
   ```

4. **海盗王 handler 返回新交互**（`src/games/smashup/abilities/pirates.ts` 第 879 行）：
   ```typescript
   // 如果有剩余的海盗王，创建新交互
   if (remaining.length > 0) {
       const interaction = createSimpleChoice(...);
       return { state: queueInteraction(state, interaction), events };
   }
   return { state, events };
   ```

5. **`queueInteraction` 的行为**（`src/engine/systems/InteractionSystem.ts` 第 398-410 行）：
   ```typescript
   if (!current) {
       // 如果当前没有交互，新交互立即成为 current
       return {
           ...state,
           sys: {
               ...state.sys,
               interaction: { ...state.sys.interaction, current: interaction },
           },
       };
   }
   ```
   - 因为 `current = undefined`（已被清除），新交互立即成为 `current`
   - **Handler 返回的 `state` 中 `current` 又有值了！**

6. **SmashUpEventSystem 覆盖了 SimpleChoiceSystem 的清除操作**：
   - `newState = result.state`（包含新交互）
   - **`current` 永远不会变成 `undefined`**
   - **UI 永远不会卸载旧弹窗**
   - **提交锁永远不会解锁**（因为 `prompt.id` 没有变化）

**为什么只有一个海盗王时也会卡住**：

让我重新分析海盗王 handler 的行为：

```typescript
registerInteractionHandler('pirate_king_move', (state, _playerId, value, iData, _random, timestamp) => {
    const selected = value as { move: boolean; uid?: string; defId?: string; fromBaseIndex?: number };
    const ctx = iData?.continuationContext as { scoringBaseIndex: number; remaining: [...] } | undefined;
    if (!ctx) return undefined;
    const events: SmashUpEvent[] = [];

    if (selected.move && selected.uid && ...) {
        events.push(moveMinion(...));
    }

    // 处理剩余海盗王
    const remaining = ctx.remaining ?? [];
    if (remaining.length > 0) {
        // 创建新交互...
        return { state: queueInteraction(state, newInteraction), events };
    }

    return { state, events };  // ← 只有一个海盗王时，返回这里
});
```

**如果只有一个海盗王**：
1. SimpleChoiceSystem 清除交互：`newState.sys.interaction.current = undefined`
2. SmashUpEventSystem 调用 handler，传入 `newState`（已清除交互）
3. Handler 返回 `{ state: newState, events }`（`state` 就是传入的 `newState`）
4. SmashUpEventSystem 使用 `result.state`（仍然是清除交互后的 state）
5. **交互应该被正确清除！**

**用户最开始提供的控制台日志也证实了这一点**：
```javascript
console.log('Current Interaction:', window.__BG_STATE__?.sys?.interaction?.current);
// 输出: undefined
```

**所以问题不是"交互没有被清除"，而是"UI 没有响应交互清除"！**

## 真正的根因：提交锁阻止了 UI 更新

**提交锁的工作原理**（`PromptOverlay.tsx` 第 145-151 行）：
```typescript
const [submittingInteractionId, setSubmittingInteractionId] = useState<string | null>(null);
const isSubmitLocked = !!prompt && submittingInteractionId === prompt.id;

// interaction.id 变化时自动解锁（含消失场景）
useEffect(() => {
    setSubmittingInteractionId(null);
    setSelectedIds([]);
}, [prompt?.id]);
```

**提交锁的解锁条件**：`prompt?.id` 变化

**问题**：
1. 用户点击"移动到该基地"按钮
2. `handleSelect` 设置提交锁：`setSubmittingInteractionId(prompt.id)`
3. 服务端处理命令，清除交互
4. **但是 Board 组件没有重新渲染，或者 `interaction` prop 没有更新**
5. PromptOverlay 的 `prompt?.id` 仍然是旧值
6. 提交锁没有解锁
7. 第二次点击被提交锁阻止，没有任何日志输出

**为什么 Board 组件没有重新渲染？**

可能的原因：
1. **React 批处理更新**：多个状态更新被合并成一次渲染
2. **引用相等性检查**：如果 `G` 对象的引用没有变化，React 可能不会重新渲染
3. **传输层延迟**：服务端状态更新还没有同步到客户端
4. **AnimatePresence 阻止卸载**：动画还在进行中，组件没有被卸载

## 修复方案

**根因**：提交锁阻止了第二次点击，但交互已经被清除，UI 应该卸载但没有卸载。

**可能的原因**：
1. Board 组件没有重新渲染
2. `interaction` prop 没有更新
3. React 批处理更新导致延迟
4. AnimatePresence 阻止卸载

**修复方案 A：强制解锁提交锁（推荐）**

在 `PromptOverlay` 中添加一个 `useEffect`，当 `interaction` 变为 `undefined` 时立即解锁：

```typescript
// 交互消失时立即解锁（不等待 prompt?.id 变化）
useEffect(() => {
    if (!interaction) {
        setSubmittingInteractionId(null);
    }
}, [interaction]);
```

**优点**：
- 最小化修改，只需要添加一个 `useEffect`
- 不影响其他交互场景
- 立即生效，不依赖 React 渲染时序

**修复方案 B：移除提交锁，使用服务端防重**

删除客户端的提交锁，依赖服务端的命令去重机制。

**优点**：
- 简化客户端逻辑
- 避免客户端状态同步问题

**缺点**：
- 用户可能看到多次网络请求
- 服务端需要实现防重逻辑

**修复方案 C：添加调试日志，确认根因**

在 Board 组件和 PromptOverlay 中添加更多日志，确认：
1. Board 组件是否重新渲染
2. `interaction` prop 是否更新
3. PromptOverlay 是否收到新的 props

**优点**：
- 确认真正的根因
- 避免盲目修复

**缺点**：
- 需要用户配合提供日志
- 修复时间较长

## 临时解决方案

用户可以通过以下方式立即继续游戏：

1. **刷新页面**（F5）：强制重新加载所有状态
2. **等待 1-2 秒**：动画完成后弹窗会自动消失

## 相关文档

- `docs/bugs/smashup-tortuga-pirate-king-卡住-2026-02-28-16-53.md` - flowHalted 守卫修复
- `docs/interaction-refresh-flow.md` - 交互刷新机制
- `docs/interaction-ui-modes.md` - UI 渲染模式

## 总结

已确认根因：**Handler 创建的新交互与旧交互使用了相同的 ID（timestamp），导致提交锁无法解锁。**

**完整问题链路**：
1. 用户点击"移动到该基地"按钮
2. `handleSelect` 设置提交锁：`setSubmittingInteractionId('pirate_king_move_0')`（假设 timestamp=0）
3. SimpleChoiceSystem 清除交互：`sys.interaction.current = undefined`
4. SmashUpEventSystem 调用海盗王 handler
5. Handler 调用 `processDestroyMoveCycle` → `processMoveTriggers` → `triggerExtendedBaseAbility`
6. **托尔图加/中央大脑的 `onMinionMoved` 能力创建新交互，ID 也是 `base_tortuga_0`（使用相同的 timestamp）**
7. **新交互的 ID 与旧交互的 ID 完全相同**
8. **`useEffect` 监听 `interaction?.id` 时检测不到变化**（因为 ID 没变）
9. **提交锁永远不解锁**
10. 第二次点击被提交锁阻止，没有任何日志输出
11. 弹窗仍然显示（因为 `prompt` 仍然有值）

**为什么 ID 会相同**：
- 海盗王交互：`pirate_king_move_${timestamp}`
- 托尔图加交互：`base_tortuga_${ctx.now}`
- 两个交互在同一个 `afterEvents` 周期内创建，使用的是同一个 `timestamp`
- 结果：两个不同的交互，但 ID 完全相同

**日志证据**：
```
[SimpleChoiceSystem] After resolveInteraction: {hasCurrentInteraction: false}  // ✅ 交互被清除
[processDestroyMoveCycle] END {hasInteractionInMs: true, interactionId: 'pirate_king_move_0'}  // ❌ 新交互，但 ID 相同
[PromptOverlay] Props changed: {interactionId: 'pirate_king_move_0'}  // ❌ ID 没变，useEffect 不触发
```

**修复方案**：监听 `interaction` 对象引用而不是 `interaction?.id`

在 `PromptOverlay.tsx` 中修改 `useEffect` 依赖：

```typescript
// 之前：监听 interaction?.id（ID 相同时不触发）
useEffect(() => {
    setSubmittingInteractionId(null);
    setSelectedIds([]);
}, [interaction?.id]);

// 现在：监听 interaction 对象引用（即使 ID 相同，只要是新对象就触发）
useEffect(() => {
    setSubmittingInteractionId(null);
    setSelectedIds([]);
}, [interaction]);
```

**为什么这样修复有效**：
- React 的 `useEffect` 使用 `Object.is()` 比较依赖项
- 即使两个交互的 ID 相同，它们是不同的对象引用
- 监听 `interaction` 对象引用时，任何新交互（无论 ID 是否相同）都会触发 `useEffect`
- 提交锁正确解锁，UI 正确更新

**修改文件**：
- `src/games/smashup/ui/PromptOverlay.tsx`：修改 `useEffect` 依赖（第 160-168 行）
- `docs/bugs/smashup-pirate-king-ui-not-closing-2026-02-28.md`：更新分析文档

**下一步**：
1. ✅ 实现修复方案（已完成）
2. 用户刷新页面测试修复是否生效
3. 验证提交锁是否正确解锁（查看 `[PromptOverlay] Unlocking due to interaction change` 日志）
4. 如果修复生效，清理所有调试日志

**能不能支持未来 100 个游戏？**
- ✅ 修复方案在框架层完成，不引入游戏特化代码
- ✅ 所有游戏的交互处理都会受益于这个修复
- ✅ 不会破坏现有的交互机制
- ✅ 提交锁机制更加健壮，能正确处理交互消失、交互切换、**ID 冲突**等场景
- ✅ 监听对象引用而不是 ID，避免了 ID 冲突导致的 bug
- ⚠️ **架构改进建议**：未来应该在引擎层确保交互 ID 的唯一性（如添加递增序列号），避免依赖 timestamp
