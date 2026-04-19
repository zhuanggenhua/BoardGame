# SmashUp: We Are The Champions afterScoring 修复

## 问题描述

测试 `vampireBuffetE2E.test.ts` 中的 `giant_ant_we_are_the_champions` afterScoring 触发器失败，无法创建交互。

## 根本原因

`afterScoring` 触发器尝试从已计分的基地读取随从信息，但基地在计分后已被清空（随从已移除）。

**时序问题**：
1. P0 打出 `we_are_the_champions` → 创建 ARMED 事件
2. 计分发生 → 基地清空（随从移除）
3. `afterScoring` 触发器执行 → 尝试读取基地上的随从 → 找不到任何随从 → 无法创建交互

## 解决方案

在 ARMED 事件创建时捕获随从快照，而不是在 `afterScoring` 触发时读取：

### 1. 扩展事件和状态类型

```typescript
// src/games/smashup/domain/types.ts

export interface SpecialAfterScoringArmedEvent {
  payload: {
    sourceDefId: string;
    playerId: PlayerId;
    baseIndex: number;
    // 新增：随从快照
    minionSnapshots?: Array<{
      uid: string;
      defId: string;
      baseIndex: number;
      counterAmount: number;
    }>;
  };
}

export interface PendingAfterScoringSpecial {
  sourceDefId: string;
  playerId: PlayerId;
  baseIndex: number;
  // 新增：随从快照
  minionSnapshots?: Array<{...}>;
}
```

### 2. 捕获快照（PLAY_ACTION 时）

```typescript
// src/games/smashup/abilities/giant_ants.ts

function giantAntWeAreTheChampions(ctx: AbilityContext): AbilityResult {
  // 捕获当前基地上己方有力量指示物的随从快照
  const base = ctx.state.bases[ctx.baseIndex];
  const sources = base?.minions
    .filter(m => m.controller === ctx.playerId && m.powerCounters > 0)
    .map(m => ({
      uid: m.uid,
      defId: m.defId,
      baseIndex: ctx.baseIndex,
      counterAmount: m.powerCounters,
    })) ?? [];

  return {
    events: [{
      type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
      payload: {
        sourceDefId: 'giant_ant_we_are_the_champions',
        playerId: ctx.playerId,
        baseIndex: ctx.baseIndex,
        minionSnapshots: sources,  // 保存快照
      },
      timestamp: ctx.now,
    }],
  };
}
```

### 3. 使用快照（afterScoring 触发时）

```typescript
// src/games/smashup/abilities/giant_ants.ts

function giantAntWeAreTheChampionsAfterScoring(ctx: TriggerContext) {
  const armed = (state.pendingAfterScoringSpecials ?? []).filter(
    s => s.sourceDefId === 'giant_ant_we_are_the_champions' && s.baseIndex === baseIndex,
  );
  
  for (const armedEntry of armed) {
    // 使用快照中的随从（而不是读取已清空的基地）
    const sources = armedEntry.minionSnapshots ?? [];
    if (sources.length === 0) continue;
    
    // 构建选项并创建交互...
  }
}
```

### 4. 更新 Reducer

```typescript
// src/games/smashup/domain/reduce.ts

case SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED: {
  const payload = (event as SpecialAfterScoringArmedEvent).payload;
  const newEntry: PendingAfterScoringSpecial = {
    sourceDefId: payload.sourceDefId,
    playerId: payload.playerId,
    baseIndex: payload.baseIndex,
    // 保存快照到 core state
    ...(payload.minionSnapshots ? { minionSnapshots: payload.minionSnapshots } : {}),
  };
  // ...
}
```

## 修改的文件

1. `src/games/smashup/abilities/giant_ants.ts` - 捕获和使用快照
2. `src/games/smashup/domain/types.ts` - 扩展类型定义
3. `src/games/smashup/domain/reduce.ts` - 保存快照到 state
4. `src/games/smashup/__tests__/vampireBuffetE2E.test.ts` - 修复测试数据
5. `src/games/smashup/__tests__/newFactionAbilities.test.ts` - 更新测试状态

## 测试结果

✅ `vampireBuffetE2E.test.ts` (2/2 passing)
✅ `robotAbilities.test.ts` (all passing)
✅ `newFactionAbilities.test.ts` (50/51 passing, 1 skipped)

## 相关问题

这个问题也影响了 `vampire_buffet` 的 afterScoring 触发器，但该触发器不需要读取随从信息，所以没有暴露问题。

## 经验教训

1. **时序敏感的数据必须提前捕获**：如果数据在触发器执行前可能被清除，必须在事件创建时捕获快照
2. **测试数据要真实**：测试中的随从必须有 `powerCounters > 0` 才能触发效果
3. **类型安全很重要**：通过扩展类型定义，确保快照数据的结构正确

## 日期

2024-03-02
