# 忍者侍从"打出自己"额度问题修复

## 问题描述

用户反馈：忍者侍从打出自己后，好像没有被算作额外随从，而是直接没有随从额度了。

## 根本原因

忍者侍从（ninja_acolyte）的 special 能力实现有问题：

1. **旧实现**：返回手牌后，打出新随从时设置 `consumesNormalLimit: false`
2. **问题**：`consumesNormalLimit: false` 只是让 `minionsPlayed` 不增加，但并没有增加基地限定额度（`baseLimitedMinionQuota`）
3. **结果**：玩家打出忍者侍从后，虽然 `minionsPlayed` 没有增加，但也没有获得额外的随从额度，导致无法继续打出随从

## 解决方案

根据用户建议，直接增加基地限定随从额度（`baseLimitedMinionQuota`），而不是使用 `consumesNormalLimit: false`。这样更符合"额外随从"的语义。

### 代码修改

#### 1. 忍者侍从 special 能力（`src/games/smashup/abilities/ninjas.ts`）

**修改前**：
```typescript
function ninjaAcolyteSpecial(ctx: AbilityContext): AbilityResult {
    // ... 前置检查 ...
    
    // 返回手牌
    events.push({
        type: SU_EVENTS.MINION_RETURNED,
        payload: { minionUid: ctx.cardUid, minionDefId: 'ninja_acolyte', fromBaseIndex: ctx.baseIndex, toPlayerId: ctx.playerId, reason: 'ninja_acolyte' },
        timestamp: ctx.now,
    } as MinionReturnedEvent);

    // 创建交互：选择手牌中的随从打出到该基地
    // ...
}
```

**修改后**：
```typescript
function ninjaAcolyteSpecial(ctx: AbilityContext): AbilityResult {
    // ... 前置检查 ...
    
    // 返回手牌
    events.push({
        type: SU_EVENTS.MINION_RETURNED,
        payload: { minionUid: ctx.cardUid, minionDefId: 'ninja_acolyte', fromBaseIndex: ctx.baseIndex, toPlayerId: ctx.playerId, reason: 'ninja_acolyte' },
        timestamp: ctx.now,
    } as MinionReturnedEvent);

    // 授予基地限定随从额度（额外随从）
    events.push({
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: {
            playerId: ctx.playerId,
            limitType: 'minion',
            delta: 1,
            reason: 'ninja_acolyte',
            restrictToBase: ctx.baseIndex, // 限定到该基地
        },
        timestamp: ctx.now,
    });

    // 创建交互：选择手牌中的随从打出到该基地
    // ...
}
```

#### 2. 忍者侍从交互处理器（`src/games/smashup/abilities/ninjas.ts`）

**修改前**：
```typescript
registerInteractionHandler('ninja_acolyte_play', (state, playerId, value, iData, _random, timestamp) => {
    if ((value as any).skip) return { state, events: [] };
    
    const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
    const baseIndex = ((iData as any)?.continuationContext as { baseIndex: number })?.baseIndex;
    if (baseIndex === undefined) return undefined;
    const playedEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: { playerId, cardUid, defId, baseIndex, power, consumesNormalLimit: false },
        timestamp,
    };
    return { state, events: [playedEvt] };
});
```

**修改后**：
```typescript
registerInteractionHandler('ninja_acolyte_play', (state, playerId, value, iData, _random, timestamp) => {
    if ((value as any).skip) return { state, events: [] };
    
    const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
    const baseIndex = ((iData as any)?.continuationContext as { baseIndex: number })?.baseIndex;
    if (baseIndex === undefined) return undefined;
    // 使用基地限定额度打出随从（consumesNormalLimit 默认为 true）
    const playedEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: { playerId, cardUid, defId, baseIndex, power },
        timestamp,
    };
    return { state, events: [playedEvt] };
});
```

#### 3. 测试更新（`src/games/smashup/__tests__/baseFactionOngoing.test.ts`）

更新测试以验证新行为：
- 忍者侍从 special 能力应该产生 `LIMIT_MODIFIED` 事件授予基地限定额度
- 交互处理器不再设置 `consumesNormalLimit: false`
- 使用基地限定额度时，reducer 不增加 `minionsPlayed`

## 验证

运行测试：
```bash
npm test -- baseFactionOngoing.test.ts --run
```

结果：✅ 所有测试通过（41 个测试）

## 影响范围

- ✅ 忍者侍从现在正确授予基地限定额度
- ✅ 玩家可以在使用忍者侍从后继续打出随从
- ✅ 额度限定到该基地（符合卡牌描述）
- ✅ 不影响其他忍者卡牌（便衣忍者仍然使用 `consumesNormalLimit: false`）

## 总结

修复完成。忍者侍从现在正确实现"额外随从"语义，通过授予基地限定额度而不是使用 `consumesNormalLimit: false`。
