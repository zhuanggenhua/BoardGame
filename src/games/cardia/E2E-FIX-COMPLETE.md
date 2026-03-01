# Cardia E2E 测试修复完成报告

## 修复日期
2026-02-27

## 问题概述
Cardia 游戏的 E2E 测试全部失败，主要原因是 `execute` 函数签名错误和游戏机制理解错误。

## 根本原因

### 1. Execute 函数签名错误
**问题**：`execute` 函数期望接收 `CardiaCore` 对象，但服务端通过 WebSocket 传递的是完整的 `MatchState<CardiaCore>` 对象 `{sys: {...}, core: {...}}`。

**错误代码**：
```typescript
export function execute(
    core: CardiaCore,  // ❌ 错误：期望 core
    command: CardiaCommand,
    random: RandomFn
): CardiaEvent[]
```

**修复**：
```typescript
export function execute(
    state: MatchState<CardiaCore>,  // ✅ 正确：接收 MatchState
    command: CardiaCommand,
    random: RandomFn
): CardiaEvent[] {
    const core = state.core;  // 提取 core
    // ...
}
```

### 2. 游戏机制理解错误
**问题**：代码和测试都假设 Cardia 是回合制游戏（只有当前玩家可以打出卡牌），但实际上 Cardia 是**同时打出卡牌**的游戏（两个玩家可以同时打出卡牌）。

**错误限制**：
1. `validate.ts` 中检查 `playerId !== core.currentPlayerId`
2. `Board.tsx` 中 `handlePlayCard` 检查 `!isMyTurn`
3. `Board.tsx` 中 `canPlay={phase === 'play' && isMyTurn}`

**修复**：
- 移除所有"当前玩家"检查
- 只检查：① 是否在打出卡牌阶段 ② 玩家是否已经打出卡牌

## 修复内容

### 1. 修复 execute 函数签名
**文件**：`src/games/cardia/domain/execute.ts`

- 修改函数签名从 `execute(core: CardiaCore, ...)` 到 `execute(state: MatchState<CardiaCore>, ...)`
- 在函数开头添加 `const core = state.core;`
- 添加 `MatchState` 类型导入

### 2. 修复验证逻辑
**文件**：`src/games/cardia/domain/validate.ts`

移除回合检查：
```typescript
// ❌ 删除
if (playerId !== core.currentPlayerId) {
    return { valid: false, error: 'Not your turn' };
}

// ✅ 保留
if (core.phase !== 'play') {
    return { valid: false, error: 'Not in play phase' };
}
if (player.hasPlayed) {
    return { valid: false, error: 'Already played a card this turn' };
}
```

### 3. 修复 UI 逻辑
**文件**：`src/games/cardia/Board.tsx`

修改 `handlePlayCard`：
```typescript
// ❌ 旧代码
if (phase !== 'play' || !isMyTurn) {
    return;
}

// ✅ 新代码
if (phase !== 'play') {
    return;
}
if (myPlayer.hasPlayed) {
    return;
}
```

修改 `canPlay`：
```typescript
// ❌ 旧代码
canPlay={phase === 'play' && isMyTurn}

// ✅ 新代码
canPlay={phase === 'play' && !myPlayer.hasPlayed}
```

### 4. 修复 E2E 测试
**文件**：`e2e/cardia-basic-flow.e2e.ts`

修改测试流程以反映同时打出卡牌的机制：

**旧流程（错误）**：
1. P1 打出卡牌 → 进入能力阶段
2. P1 跳过能力 → 进入结束阶段
3. P1 结束回合
4. P2 打出卡牌 → 进入能力阶段
5. ...

**新流程（正确）**：
1. P1 打出卡牌（等待 P2）
2. P2 打出卡牌
3. 双方都打出后 → 自动解析遭遇战 → 进入能力阶段
4. 失败者跳过能力 → 进入结束阶段
5. 当前玩家结束回合
6. ...

### 5. 修复单元测试
**文件**：`src/games/cardia/__tests__/execute.test.ts`

- 修改测试以传递 `MatchState` 而不是 `CardiaCore`
- 将所有 `state.players` 改为 `core.players`
- 将所有 `state.phase` 改为 `core.phase`

**文件**：`src/games/cardia/__tests__/validate.test.ts`

- 修改测试"should reject playing card when not current player"为"should allow any player to play card in play phase (simultaneous play)"
- 期望结果从 `valid: false` 改为 `valid: true`

## 测试结果

### E2E 测试
✅ **3/3 通过**（用时 46.1 秒）

1. ✅ should complete a full turn cycle (14.6s)
2. ✅ should handle ability activation (11.2s)
3. ✅ should end game when player reaches 5 signets (13.1s)

### 单元测试
✅ **57/57 通过**（用时 2.13 秒）

- ✅ utils.test.ts (5 tests)
- ✅ smoke.test.ts (3 tests)
- ✅ reduce.test.ts (9 tests)
- ✅ execute.test.ts (9 tests)
- ✅ game-flow.test.ts (4 tests)
- ✅ interaction.test.ts (10 tests)
- ✅ validate.test.ts (13 tests)
- ✅ ability-executor.test.ts (4 tests)

## 关键教训

1. **函数签名必须与引擎接口一致**：`DomainCore.execute` 接口定义为 `execute(state: MatchState<TState>, ...)`，游戏实现必须遵守。

2. **理解游戏机制至关重要**：在实现游戏逻辑前，必须完全理解游戏的核心机制（回合制 vs 同时行动）。

3. **测试必须反映真实游戏流程**：E2E 测试应该模拟真实玩家的操作流程，而不是假设的流程。

4. **类型系统是最好的文档**：TypeScript 的类型定义清楚地说明了 `execute` 应该接收 `MatchState`，如果早点检查类型定义就能避免这个问题。

5. **服务端日志是调试的关键**：通过查看 `logs/error-*.log` 中的错误堆栈，快速定位到了 `core.players` 为 `undefined` 的问题。

## 后续工作

所有测试已通过，Cardia 游戏的基础功能已完整实现并验证。可以继续进行：

1. 添加更多游戏功能（如更多卡牌、能力）
2. 优化 UI/UX
3. 添加教学模式
4. 性能优化

## 相关文件

- `src/games/cardia/domain/execute.ts` - 命令执行逻辑
- `src/games/cardia/domain/validate.ts` - 命令验证逻辑
- `src/games/cardia/Board.tsx` - 游戏 UI
- `e2e/cardia-basic-flow.e2e.ts` - E2E 测试
- `src/games/cardia/__tests__/*.test.ts` - 单元测试
