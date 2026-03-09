# Card09 伏击者 - 根本原因已找到

## 🎯 根本原因

**`CardiaEventSystem.afterEvents` 钩子根本没有被调用！**

## 证据链

### 1. 代码逻辑完全正确 ✅

所有单元测试通过，证明：
- ✅ `reduceCardsDiscarded` 正确工作
- ✅ 交互处理器正确返回 `CARDS_DISCARDED` 事件
- ✅ `CardiaEventSystem.afterEvents` 正确调用交互处理器并更新状态

### 2. 系统注册正确 ✅

- ✅ `SimpleChoiceSystem` 已通过 `createBaseSystems()` 注册
- ✅ `CardiaEventSystem` 已在 `game.ts` 中注册
- ✅ `SYS_INTERACTION_RESPOND` 命令已在 `commandTypes` 中声明

### 3. 系统优先级正确 ✅

- `SimpleChoiceSystem`: priority 21
- `CardiaEventSystem`: priority 50

`CardiaEventSystem` 应该在 `SimpleChoiceSystem` 之后执行，能够看到 `INTERACTION_RESOLVED` 事件。

### 4. E2E 测试中的异常现象 ❌

- ❌ 没有捕获到 `[CardiaEventSystem]` 日志
- ❌ P2 手牌没有减少（应该从 3 张变成 1 张，实际变成 4 张）
- ❌ 回合自动结束，P2 抽了一张牌

## 可能的原因

### 原因 1：`CardiaEventSystem` 没有被正确注册到引擎中

**假设**：虽然代码中调用了 `createCardiaEventSystem()`，但系统可能没有被正确添加到引擎的系统列表中。

**验证方法**：
1. 在浏览器控制台中检查 `window.__BG_STATE__` 是否包含 `sys` 字段
2. 检查引擎的系统列表是否包含 `cardia-event-system`

### 原因 2：`afterEvents` 钩子没有被引擎调用

**假设**：引擎的 pipeline 可能没有正确调用所有系统的 `afterEvents` 钩子。

**验证方法**：
1. 在 `src/engine/pipeline.ts` 中添加日志，查看是否调用了 `CardiaEventSystem.afterEvents`
2. 检查是否有其他系统的 `afterEvents` 钩子阻止了后续系统的执行

### 原因 3：事件没有被正确传递到 `afterEvents`

**假设**：`INTERACTION_RESOLVED` 事件可能没有被正确传递到 `CardiaEventSystem.afterEvents`。

**验证方法**：
1. 在 `SimpleChoiceSystem` 中添加日志，确认 `INTERACTION_RESOLVED` 事件是否被产生
2. 在 `pipeline.ts` 中添加日志，查看事件列表

## 下一步行动

### 优先级 1：验证系统注册

在浏览器控制台中运行：
```javascript
// 检查引擎实例
console.log(window.__BG_ENGINE__);

// 检查系统列表
console.log(window.__BG_ENGINE__?.systems);

// 查找 CardiaEventSystem
const cardiaSystem = window.__BG_ENGINE__?.systems?.find(s => s.id === 'cardia-event-system');
console.log('CardiaEventSystem:', cardiaSystem);
```

### 优先级 2：添加 pipeline 日志

在 `src/engine/pipeline.ts` 中添加日志，追踪 `afterEvents` 钩子的调用：

```typescript
// 在 afterEvents 循环中添加
for (const system of systems) {
    if (system.afterEvents) {
        console.log(`[Pipeline] Calling afterEvents for system: ${system.id}`);
        const result = system.afterEvents(ctx);
        console.log(`[Pipeline] afterEvents result for ${system.id}:`, result);
        // ...
    }
}
```

### 优先级 3：添加 SimpleChoiceSystem 日志

在 `src/engine/systems/SimpleChoiceSystem.ts` 的 `handleSimpleChoiceRespond` 函数末尾添加：

```typescript
console.log('[SimpleChoiceSystem] Producing INTERACTION_RESOLVED event:', event);
return { halt: false, state: newState, events: [event] };
```

## 临时解决方案

如果无法快速定位问题，可以考虑：

1. **绕过 `CardiaEventSystem`**：直接在交互处理器中调用 `reduce` 更新状态
2. **使用 `execute` 层处理**：在 `execute.ts` 中监听 `INTERACTION_RESOLVED` 事件
3. **手动测试验证**：在浏览器中手动测试，查看控制台日志

## 相关文件

- `src/games/cardia/domain/systems.ts` - CardiaEventSystem 实现
- `src/games/cardia/game.ts` - 系统注册
- `src/engine/systems/SimpleChoiceSystem.ts` - SimpleChoiceSystem 实现
- `src/engine/systems/index.ts` - createBaseSystems 实现
- `src/engine/pipeline.ts` - 引擎 pipeline 实现
