# 忍者侍从 - 回退到 consumesNormalLimit 实现

## 问题描述

用户反馈：忍者侍从的实现应该是"点击后立刻选择打出哪个随从"，而不是"先加额度再选择"。

## 根本原因

之前的修复（`evidence/ninja-acolyte-quota-priority-fix.md`）将忍者侍从改为授予基地限定额度（`LIMIT_MODIFIED` 事件），但这不符合用户的预期行为。

## 正确实现

忍者侍从应该使用 `consumesNormalLimit: false` 实现"额外随从"语义：

1. 点击忍者侍从激活 special 能力
2. 忍者侍从返回手牌（`MINION_RETURNED`）
3. 立刻弹出交互让玩家选择打出哪个随从
4. 打出随从时设置 `consumesNormalLimit: false`（不消耗正常额度）

### 代码修改

#### 1. 忍者侍从 special 能力（`src/games/smashup/abilities/ninjas.ts`）

**移除**：
```typescript
// 授予基地限定随从额度（额外随从）
events.push({
    type: SU_EVENTS.LIMIT_MODIFIED,
    payload: {
        playerId: ctx.playerId,
        limitType: 'minion',
        delta: 1,
        reason: 'ninja_acolyte',
        restrictToBase: ctx.baseIndex,
    },
    timestamp: ctx.now,
});
```

现在只保留：
- `MINION_RETURNED` 事件（返回手牌）
- 创建交互让玩家选择打出随从

#### 2. 忍者侍从交互处理器（`src/games/smashup/abilities/ninjas.ts`）

**修改后**：
```typescript
registerInteractionHandler('ninja_acolyte_play', (state, playerId, value, iData, _random, timestamp) => {
    if ((value as any).skip) return { state, events: [] };
    
    const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
    const baseIndex = ((iData as any)?.continuationContext as { baseIndex: number })?.baseIndex;
    if (baseIndex === undefined) return undefined;
    // 不消耗正常额度（额外随从）
    const playedEvt: MinionPlayedEvent = {
        type: SU_EVENTS.MINION_PLAYED,
        payload: { playerId, cardUid, defId, baseIndex, power, consumesNormalLimit: false },
        timestamp,
    };
    return { state, events: [playedEvt] };
});
```

#### 3. 测试更新（`src/games/smashup/__tests__/baseFactionOngoing.test.ts`）

- 更新测试名称：`ninja_acolyte_play 交互产生 MINION_PLAYED 事件且 consumesNormalLimit=false`
- 断言不应该有 `LIMIT_MODIFIED` 事件
- 断言 `MINION_PLAYED` 事件应该有 `consumesNormalLimit: false`
- 删除"使用基地限定额度时 reducer 不增加 minionsPlayed"测试（不再适用）

## consumesNormalLimit: false 的行为

### reduce.ts 中的逻辑

```typescript
const shouldIncrementPlayed = consumesNormalLimit !== false;

// ...

if (useBaseQuota) {
    // 消耗基地限定额度
} else if (useSameNameQuota) {
    // 消耗同名额度
} else if (shouldIncrementPlayed) {
    // 消耗全局额度
    finalMinionsPlayed = player.minionsPlayed + 1;
}
```

当 `consumesNormalLimit: false` 时：
- `shouldIncrementPlayed = false`
- 不会进入任何额度消耗分支
- `minionsPlayed` 保持不变

### 打出忍者侍从自己的场景

1. 玩家本回合 `minionsPlayed = 0`
2. 点击忍者侍从激活 special
3. 忍者侍从返回手牌
4. 玩家选择打出忍者侍从自己
5. `MINION_PLAYED` 事件，`consumesNormalLimit: false`
6. `minionsPlayed` 保持为 0（不增加）
7. 玩家可以继续打出第二个随从（消耗通用额度，`minionsPlayed` 变成 1）

**结果**：玩家总共打出了 2 个随从，但只消耗了 1 个通用额度。这是正确的"额外随从"行为。

## 验证

运行测试：
```bash
npm test -- baseFactionOngoing.test.ts --run
```

结果：✅ 所有测试通过（40 个测试）

## 总结

忍者侍从现在使用 `consumesNormalLimit: false` 实现"额外随从"语义，符合用户预期的交互流程：点击 → 返回手牌 → 立刻选择打出 → 不消耗额度。

