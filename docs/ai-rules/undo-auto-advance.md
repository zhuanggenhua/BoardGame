# 撤回后自动推进规范（强制）

> **问题根源**：撤回恢复状态后，FlowSystem.afterEvents 中的 `onAutoContinueCheck` 会被触发，导致某些阶段意外自动推进。

## 核心规则（强制）

### 1. 撤回不应触发自动推进（强制）

**原则**：撤回是"恢复到过去某个时刻"的操作，不应产生新的游戏进程。撤回后玩家应停留在恢复的阶段，等待手动操作。

**禁止行为**：
- ❌ 撤回后自动推进到下一阶段
- ❌ 撤回后自动执行任何游戏逻辑（抽牌、结算、阶段切换等）
- ❌ 撤回后触发 `onAutoContinueCheck` 导致阶段推进

**正确行为**：
- ✅ 撤回后停留在恢复的阶段
- ✅ 撤回后等待玩家手动操作（ADVANCE_PHASE / 打牌 / 使用技能等）
- ✅ 撤回后 UI 显示恢复的阶段和状态

### 2. 引擎层统一处理（通用方案）

**实现位置**：`src/engine/systems/FlowSystem.ts` 的 `afterEvents` 方法

**实现代码**：
```typescript
afterEvents: ({ state, events, random, playerIds }): HookResult<TCore> | void => {
    // 撤回后不自动推进（通用守卫）
    // UndoSystem 恢复快照后会设置 restoredRandomCursor，
    // 此时不应触发任何自动推进逻辑，等待玩家手动操作
    if (state.sys.undo?.restoredRandomCursor !== undefined) {
        return;
    }

    // 检查是否需要自动继续流程
    if (!hooks.onAutoContinueCheck) return;

    const result = hooks.onAutoContinueCheck({ state, events, random });
    if (!result?.autoContinue) return;

    // ... 自动推进逻辑
};
```

**优势**：
- ✅ 所有游戏自动受益，无需在游戏层重复写检查
- ✅ 新增游戏无需额外代码，零配置
- ✅ 引擎层统一维护，修改一处全局生效
- ✅ 符合"面向百游戏设计"原则

### 3. 游戏层无需额外代码（强制）

**重要**：游戏层的 `onAutoContinueCheck` 无需检查撤回标记，引擎层已统一处理。

**禁止**：
```typescript
// ❌ 游戏层不需要这段代码（引擎层已处理）
onAutoContinueCheck: ({ state }) => {
    if (state.sys.undo.restoredRandomCursor !== undefined) {
        return undefined;
    }
    // ...
};
```

**正确**：
```typescript
// ✅ 游戏层直接写自动推进逻辑即可
onAutoContinueCheck: ({ state }) => {
    const phase = state.sys.phase;
    if (phase === 'setup') {
        // ... 检查是否需要自动推进
    }
    // ...
};
```

### 4. 撤回标记清理时机（强制）

**清理规则**：`restoredRandomCursor` 标记必须在下一个"会产生快照的命令"执行前清理，确保后续操作不受影响。

**实现位置**：UndoSystem.beforeCommand 中，当检测到新的快照命令时，自动清理 `restoredRandomCursor`。

**已实现**：引擎层 UndoSystem 已自动处理清理逻辑，游戏层无需手动清理。

## 问题场景与修复

### 场景 1：DiceThrone 弃牌阶段撤回后自动推进

**问题描述**：
- 玩家在 discard 阶段撤回
- 撤回后 `onAutoContinueCheck` 被触发
- discard 阶段没有检查撤回标记，直接返回 `undefined`（不自动推进）
- 但如果撤回到其他阶段（如 main1），可能触发意外的自动推进

**修复方案**：
引擎层 FlowSystem.afterEvents 统一检查撤回标记，游戏层无需修改。

### 场景 2：SummonerWars 阶段结束技能撤回后自动推进

**问题描述**：
- 玩家在 attack 阶段确认了阶段结束技能（如 feed_beast）
- 撤回到确认前
- `onAutoContinueCheck` 检测到"无需确认的技能"，自动推进到下一阶段

**修复方案**：
引擎层 FlowSystem.afterEvents 统一检查撤回标记，游戏层无需修改。

### 场景 3：SmashUp 派系选择撤回后自动推进

**问题描述**：
- 玩家在 factionSelect 阶段选择了派系
- 撤回到选择前
- `onAutoContinueCheck` 检测到"所有人都选完了"（因为 reducer 把 selection 置空了），自动推进

**修复方案**：
引擎层 FlowSystem.afterEvents 统一检查撤回标记，游戏层无需修改。

## 测试要求（强制）

### 1. 撤回后不自动推进测试

**覆盖场景**：
- ✅ 撤回到玩家操作阶段（main1/main2/playCards/discard）→ 不自动推进
- ✅ 撤回到自动阶段（upkeep/income/startTurn）→ 不自动推进
- ✅ 撤回到战斗阶段（offensiveRoll/defensiveRoll）→ 不自动推进
- ✅ 撤回到选择阶段（factionSelect/setup）→ 不自动推进

**测试模板**：
```typescript
it('撤回后不自动推进到下一阶段', () => {
    const runner = createRunner();
    const result1 = runner.run({
        name: '执行操作',
        commands: [
            // ... 执行一些操作
            { type: 'SOME_COMMAND', playerId: '0', payload: {} },
        ],
    });

    const phase1 = result1.finalState.sys.phase;

    const result2 = runner.run({
        setup: () => result1.finalState,
        name: '撤回',
        commands: [
            { type: 'SYS_REQUEST_UNDO', playerId: '0', payload: undefined },
            { type: 'SYS_APPROVE_UNDO', playerId: '1', payload: undefined },
        ],
    });

    // 撤回后应停留在恢复的阶段，不自动推进
    expect(result2.finalState.sys.phase).toBe(phase1);
    expect(result2.finalState.sys.undo.restoredRandomCursor).toBeDefined();
});
```

### 2. 撤回标记清理测试

**覆盖场景**：
- ✅ 撤回后执行新命令 → `restoredRandomCursor` 被清理
- ✅ 清理后自动推进恢复正常

**测试模板**：
```typescript
it('撤回标记在下一个命令前被清理', () => {
    const runner = createRunner();
    const result1 = runner.run({
        name: '执行操作',
        commands: [
            { type: 'SOME_COMMAND', playerId: '0', payload: {} },
        ],
    });

    const result2 = runner.run({
        setup: () => result1.finalState,
        name: '撤回',
        commands: [
            { type: 'SYS_REQUEST_UNDO', playerId: '0', payload: undefined },
            { type: 'SYS_APPROVE_UNDO', playerId: '1', payload: undefined },
        ],
    });

    expect(result2.finalState.sys.undo.restoredRandomCursor).toBeDefined();

    const result3 = runner.run({
        setup: () => result2.finalState,
        name: '执行新命令',
        commands: [
            { type: 'ANOTHER_COMMAND', playerId: '0', payload: {} },
        ],
    });

    // 新命令执行后，撤回标记应被清理
    expect(result3.finalState.sys.undo.restoredRandomCursor).toBeUndefined();
});
```

## 实现检查清单（强制）

### 新增游戏时

- [ ] 无需额外代码，引擎层自动处理 ✅
- [ ] 添加"撤回后不自动推进"测试
- [ ] 添加"撤回标记清理"测试

### 修改现有游戏时

- [ ] 无需检查游戏层代码，引擎层统一处理 ✅
- [ ] 运行撤回相关测试确认无回归

### 审查现有游戏时

- [ ] DiceThrone：引擎层统一处理 ✅
- [ ] SummonerWars：引擎层统一处理 ✅
- [ ] SmashUp：引擎层统一处理 ✅
- [ ] TicTacToe：引擎层统一处理 ✅

## 教训总结

### 根本原因

**撤回恢复状态后，FlowSystem.afterEvents 会被触发**：
1. UndoSystem.beforeCommand 执行撤回，返回 `{ halt: true, state: previousState }`
2. 引擎层 pipeline 将 `previousState` 作为新状态
3. FlowSystem.afterEvents 被调用，`events` 为空数组（撤回不产生事件）
4. `onAutoContinueCheck` 被触发，检查当前状态是否需要自动推进
5. 如果没有撤回检查，可能误判为"需要自动推进"

### 为什么需要撤回标记

**问题**：撤回后的状态与"正常到达该状态"的状态完全相同，无法区分。

**解决方案**：UndoSystem 在恢复快照时设置 `restoredRandomCursor` 标记，游戏层通过此标记识别"这是撤回恢复的状态，不是正常流程"。

**标记生命周期**：
1. 撤回时：UndoSystem 设置 `restoredRandomCursor`
2. 撤回后：`onAutoContinueCheck` 检测到标记，返回 `undefined`（不自动推进）
3. 下一个命令：UndoSystem.beforeCommand 清理标记
4. 清理后：自动推进恢复正常

### 为什么不能在 UndoSystem 中阻止 afterEvents

**问题**：能否在 UndoSystem.afterEvents 中直接返回 `undefined`，阻止后续系统（FlowSystem）执行？

**答案**：不能。UndoSystem 的 priority 是 10，FlowSystem 的 priority 是 25。引擎层按优先级顺序调用所有系统的 afterEvents，UndoSystem 无法阻止 FlowSystem 执行。

**正确方案**：在 FlowSystem.afterEvents 中检查撤回标记，这是唯一可靠的拦截点。引擎层统一处理，游戏层无需关心。

### 为什么是通用方案

**问题**：为什么不让每个游戏在 `onAutoContinueCheck` 中检查撤回标记？

**答案**：
1. **违反 DRY 原则**：每个游戏都写相同的 7 行代码，重复 100 次
2. **容易遗漏**：新增游戏时可能忘记添加检查，导致 bug
3. **维护成本高**：修改逻辑需要改 100 个文件
4. **不符合"面向百游戏设计"**：框架应该提供智能默认值，游戏层零配置

**通用方案优势**：
- ✅ 引擎层统一处理，所有游戏自动受益
- ✅ 新增游戏零配置，无需额外代码
- ✅ 修改一处全局生效，维护成本低
- ✅ 符合"显式 > 隐式、智能默认 + 可覆盖"原则

## 相关文档

- `docs/automated-testing.md` — 撤回测试规范
- `src/engine/systems/UndoSystem.ts` — 撤回系统实现
- `src/engine/systems/FlowSystem.ts` — 流程系统实现
- `docs/ai-rules/engine-systems.md` — 引擎系统规范
