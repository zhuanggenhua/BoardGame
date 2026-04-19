# Bug 修复：伦格高原基地能力跨玩家回合触发失败

## 问题描述

**用户反馈**：印斯茅斯的随从"本地人"打出到"伦格高原"（Plateau of Leng）上，无法触发基地效果"打出同名随从"。

**根本原因**：`minionsPlayedPerBase` 在每个玩家回合开始时（`TURN_STARTED` 事件）被清空，导致非当前回合玩家的计数丢失。

## 语义分析

基地能力描述："每回合玩家第一次打出一个随从从手牌到这以后，他们可以额外打出一张与其同名的随从到这里。"

- **中文**："每回合玩家第一次" = 每个玩家在整个游戏回合内的首次
- **英文**："The first time a player plays a minion here from their hand each turn" = 每个玩家在整个游戏回合内的首次

**SmashUp 的回合系统**：
- 一个"游戏回合"（turn）= 所有玩家都行动一次
- `turnNumber` 只在玩家 0 回合开始时 +1
- 玩家 0 回合 → 玩家 1 回合 → 玩家 2 回合 → 玩家 0 回合（`turnNumber` +1）

**对比其他基地**：
- `base_laboratorium`："每回合第一个被打出到这里的随从" = 全局首次（所有玩家共享）
- `base_moot_site`："每回合第一个打出到这的随从" = 全局首次（所有玩家共享）
- `base_plateau_of_leng`："每回合玩家第一次" = 每个玩家首次（每个玩家独立计数）
- `base_fairy_ring`："每回合你第一次" = 每个玩家首次（每个玩家独立计数）

## Bug 场景

1. 玩家 1 在自己的回合打出"本地人"到"伦格高原"
2. `minionsPlayedPerBase[1] = 1`（基地索引 1）
3. 基地能力检查 `playedAtBase === 1` ✅ 通过
4. **但是**，从状态快照看，这是在玩家 2 的回合中发生的（`currentPlayerIndex: 2`）
5. 玩家 1 的回合已经结束，`TURN_STARTED` 事件已经清空了玩家 1 的 `minionsPlayedPerBase`
6. 所以当玩家 1 在玩家 2 的回合打出随从时，`minionsPlayedPerBase` 是 `undefined`，`playedAtBase` 计算为 `0`
7. `playedAtBase !== 1` 条件不满足，基地能力不触发

## 修复方案（第二版 - 正确）

**错误的第一版修复**：将 `minionsPlayedPerBase` 的清理从 `TURN_STARTED` 移到 `TURN_ENDED`
- ❌ 问题：每个玩家回合结束时都会清空所有玩家的计数
- ❌ 结果：玩家 0 回合结束后，玩家 1 回合开始时，玩家 0 的计数已被清空
- ❌ 如果玩家 0 在玩家 1 的回合打出随从（通过某个能力），会被错误地当作"首次"

**正确的第二版修复**：只在新的游戏回合开始时（`turnNumber` 增加）清空所有玩家的 `minionsPlayedPerBase`
- ✅ 检查 `turnNumber > state.turnNumber` 判断是否是新的游戏回合
- ✅ 新游戏回合：清空所有玩家的 `minionsPlayedPerBase`
- ✅ 同一游戏回合内的玩家回合：保留所有玩家的 `minionsPlayedPerBase`

### 修改文件

1. **`src/games/smashup/domain/reduce.ts`**
   - `TURN_STARTED` 事件：检查 `turnNumber > state.turnNumber`，只在新游戏回合时清空所有玩家的 `minionsPlayedPerBase`
   - `TURN_ENDED` 事件：恢复为原始实现（只切换玩家索引）

### 代码变更

```typescript
// TURN_STARTED 事件（根据 turnNumber 判断是否清空 minionsPlayedPerBase）
case SU_EVENTS.TURN_STARTED: {
    const { playerId, turnNumber } = event.payload;
    const player = state.players[playerId];
    
    // 检查是否是新的游戏回合（turnNumber 增加）
    const isNewGameTurn = turnNumber > state.turnNumber;
    
    // ... 其他清理逻辑 ...
    
    // 如果是新的游戏回合，清空所有玩家的 minionsPlayedPerBase
    // 否则只清空当前玩家的其他回合状态
    let newPlayers: Record<PlayerId, SmashUpPlayer>;
    if (isNewGameTurn) {
        // 新游戏回合：清空所有玩家的 minionsPlayedPerBase
        newPlayers = {};
        for (const pid of Object.keys(state.players)) {
            const p = state.players[pid];
            if (pid === playerId) {
                // 当前玩家：清空所有回合状态
                newPlayers[pid] = {
                    ...p,
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: newActionLimit,
                    minionsPlayedPerBase: undefined,
                    // ... 其他清理 ...
                };
            } else {
                // 其他玩家：只清空 minionsPlayedPerBase
                newPlayers[pid] = {
                    ...p,
                    minionsPlayedPerBase: undefined,
                };
            }
        }
    } else {
        // 同一游戏回合内的玩家回合：只清空当前玩家的回合状态，保留 minionsPlayedPerBase
        newPlayers = {
            ...state.players,
            [playerId]: {
                ...player,
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: newActionLimit,
                // minionsPlayedPerBase 保留，不清空
                // ... 其他清理 ...
            },
        };
    }
    
    return { ...state, turnNumber, bases: newBases, players: newPlayers, ... };
}

// TURN_ENDED 事件（恢复为原始实现）
case SU_EVENTS.TURN_ENDED: {
    const { nextPlayerIndex } = event.payload;
    return { ...state, currentPlayerIndex: nextPlayerIndex };
}
```

## 测试覆盖

添加测试用例 `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`：

```typescript
it('跨玩家回合：每个玩家首次打出时都应触发', () => {
    // 模拟用户反馈的场景：玩家 1 在自己回合打出本地人，应该触发基地能力
    // 即使此时已经不是玩家 1 的回合（currentPlayerIndex 指向其他玩家）
    const result = triggerBaseAbilityWithMS('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
        state: makeState({
            bases: [makeBase('base_plateau_of_leng')],
            currentPlayerIndex: 2, // 当前是玩家 2 的回合
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('h1', 'innsmouth_the_locals', 'minion')], // 同名随从
                    minionsPlayedPerBase: { 0: 1 }, // 玩家 1 首次打出到该基地
                }),
                '2': makePlayer('2'),
            },
        }),
        baseDefId: 'base_plateau_of_leng',
        playerId: '1', // 玩家 1 打出随从
        minionUid: 'm1',
        minionDefId: 'innsmouth_the_locals',
    }));

    // 应该生成交互，因为这是玩家 1 在该基地的首次打出
    const interactions = getInteractionsFromResult(result);
    expect(interactions).toHaveLength(1);
    expect(interactions[0].data.sourceId).toBe('base_plateau_of_leng');
});
```

## 影响范围

- ✅ `base_plateau_of_leng`：修复跨玩家回合触发失败
- ✅ `base_fairy_ring`：同样受益（使用相同的 `minionsPlayedPerBase` 机制）
- ✅ `base_laboratorium`、`base_moot_site`：不受影响（使用全局计数，累加所有玩家的 `minionsPlayedPerBase`）
- ✅ `giant_ant` ongoing 效果：不受影响（只检查 `> 0`，不依赖精确计数）

## 验证结果

- ✅ 所有现有测试通过（29 个测试）
- ✅ 新增跨玩家回合测试通过
- ✅ 不影响其他使用 `minionsPlayedPerBase` 的功能

## 修复日期

2026-03-02（第一版 - 错误）
2026-03-02（第二版 - 正确）

## 相关文档

- `.kiro/specs/smashup-full-audit/audit-15.2-expansion-bases.md`：更新审计结果
- `docs/audit/smashup/phase2-timing.md`：回合清理时序文档
- `docs/audit/smashup/phase2-write-consume.md`：写入-消费窗口对齐文档

## 教训

**不要假设"回合"的定义**：不同游戏对"回合"的定义不同。SmashUp 的"游戏回合"（turn）= 所有玩家都行动一次，而不是单个玩家的行动。修复时必须先确认游戏的回合系统，而不是凭直觉假设。

**通用修复必须考虑所有场景**：第一版修复只考虑了"每个玩家回合结束时清空"，但没有考虑"同一游戏回合内多个玩家的计数应该保留"。正确的修复应该基于 `turnNumber` 的变化，而不是 `TURN_ENDED` 事件。
