# ActionLog 显示事件原因改进

## 问题描述

用户反馈托尔图加基地的 afterScoring 效果日志不够详细。当随从被移动或消灭时，日志只显示"随从移动"或"随从被消灭"，没有说明原因（如"托尔图加：亚军移动随从到替换基地"）。

## 根因分析

### 事件数据结构

`MINION_MOVED` 和 `MINION_DESTROYED` 事件的 payload 中包含 `reason` 字段：

```typescript
// abilityHelpers.ts
export function moveMinion(
    minionUid: string,
    minionDefId: string,
    fromBaseIndex: number,
    toBaseIndex: number,
    reason: string,  // ← 原因字段
    now: number
): MinionMovedEvent {
    return {
        type: SU_EVENTS.MINION_MOVED,
        payload: { minionUid, minionDefId, fromBaseIndex, toBaseIndex, reason },
        timestamp: now,
    };
}

export function destroyMinion(
    minionUid: string,
    minionDefId: string,
    fromBaseIndex: number,
    ownerId: PlayerId,
    destroyerId: PlayerId | undefined,
    reason: string,  // ← 原因字段
    now: number
): MinionDestroyedEvent {
    return {
        type: SU_EVENTS.MINION_DESTROYED,
        payload: { minionUid, minionDefId, fromBaseIndex, ownerId, destroyerId, reason },
        timestamp: now,
    };
}
```

### ActionLog 处理逻辑

之前的 `actionLog.ts` 没有使用 `reason` 字段：

```typescript
// 之前的代码
case SU_EVENTS.MINION_MOVED: {
    const payload = event.payload as { minionDefId: string; fromBaseIndex: number; toBaseIndex: number };
    // ... 只显示卡牌名称和基地
    pushEntry(event.type, segments, actorId, entryTimestamp, index);
    break;
}

case SU_EVENTS.MINION_DESTROYED: {
    const payload = event.payload as { minionDefId: string; fromBaseIndex: number };
    // ... 只显示卡牌名称和基地
    pushEntry(event.type, segments, actorId, entryTimestamp, index);
    break;
}
```

## 解决方案

### 修改内容

**`src/games/smashup/actionLog.ts`**：

1. **MINION_MOVED 事件**：
   ```typescript
   case SU_EVENTS.MINION_MOVED: {
       const payload = event.payload as { minionDefId: string; fromBaseIndex: number; toBaseIndex: number; reason?: string };
       const fromLabel = formatBaseLabel(getBaseDefId(payload.fromBaseIndex), payload.fromBaseIndex);
       const toLabel = formatBaseLabel(getBaseDefId(payload.toBaseIndex), payload.toBaseIndex);
       const segments = withCardSegments('actionLog.minionMoved', payload.minionDefId);
       segments.push(i18nSeg('actionLog.fromTo', { from: fromLabel, to: toLabel }, ['from', 'to']));
       // 添加原因说明（如果有）
       if (payload.reason) {
           segments.push({ type: 'text', text: ` （原因： ${payload.reason}）` });
       }
       pushEntry(event.type, segments, actorId, entryTimestamp, index);
       break;
   }
   ```

2. **MINION_DESTROYED 事件**：
   ```typescript
   case SU_EVENTS.MINION_DESTROYED: {
       const payload = event.payload as { minionDefId: string; fromBaseIndex: number; reason?: string };
       const baseLabel = formatBaseLabel(getBaseDefId(payload.fromBaseIndex), payload.fromBaseIndex);
       const segments = withCardSegments('actionLog.minionDestroyed', payload.minionDefId);
       if (baseLabel) {
           segments.push(i18nSeg('actionLog.onBase', { base: baseLabel }, ['base']));
       }
       // 添加原因说明（如果有）
       if (payload.reason) {
           segments.push({ type: 'text', text: ` （原因： ${payload.reason}）` });
       }
       pushEntry(event.type, segments, actorId, entryTimestamp, index);
       break;
   }
   ```

### 改进效果

修改后，日志会显示更详细的信息：

**之前**：
```
随从移动： 海盗王  → 母舰 → 托尔图加
```

**之后**：
```
随从移动： 海盗王  → 母舰 → 托尔图加 （原因： 托尔图加：亚军移动随从到替换基地）
```

**之前**：
```
随从被消灭： 科学小怪蛋  → 托尔图加
```

**之后**：
```
随从被消灭： 科学小怪蛋  → 托尔图加 （原因： 一大口）
```

## 受益场景

### 1. 托尔图加 afterScoring

```typescript
// baseAbilities.ts
registerInteractionHandler('base_tortuga', (state, _playerId, value, iData, _random, timestamp) => {
    // ...
    return { state, events: [moveMinion(
        selected.minionUid!,
        selected.minionDefId!,
        selected.fromBaseIndex ?? -1,
        ctx.baseIndex,
        '托尔图加：亚军移动随从到替换基地',  // ← 原因
        timestamp,
    )] };
});
```

日志显示：
```
随从移动： 海盗王  → 母舰 → 托尔图加 （原因： 托尔图加：亚军移动随从到替换基地）
```

### 2. 技能消灭随从

```typescript
// vampires.ts - 一大口
return {
    events: [destroyMinion(val.minionUid, val.defId, val.baseIndex, minion.owner, ctx.playerId, 'vampire_big_gulp', ctx.now)],
};
```

日志显示：
```
随从被消灭： 科学小怪蛋  → 托尔图加 （原因： vampire_big_gulp）
```

### 3. 欺骗之道移动随从

```typescript
// ninjas.ts
return { state, events: [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBaseIndex, destBase, 'ninja_way_of_deception', timestamp)] };
```

日志显示：
```
随从移动： 忍者侍从  → 托尔图加 → 母舰 （原因： ninja_way_of_deception）
```

## 未来改进

### 1. i18n 支持

当前 reason 直接显示原始字符串。未来可以改为 i18n key：

```typescript
if (payload.reason) {
    // 尝试从 i18n 获取翻译，如果没有则显示原始字符串
    const reasonText = t(`actionLog.reasons.${payload.reason}`, { defaultValue: payload.reason });
    segments.push({ type: 'text', text: ` （原因： ${reasonText}）` });
}
```

### 2. 卡牌名称高亮

如果 reason 是卡牌 defId（如 `vampire_big_gulp`），可以自动转换为卡牌名称并高亮：

```typescript
if (payload.reason) {
    const cardDef = getCardDef(payload.reason);
    if (cardDef) {
        // 卡牌原因：显示卡牌名称并高亮
        segments.push({ type: 'text', text: ' （原因： ' });
        segments.push({ type: 'card', defId: payload.reason });
        segments.push({ type: 'text', text: '）' });
    } else {
        // 非卡牌原因：直接显示文本
        segments.push({ type: 'text', text: ` （原因： ${payload.reason}）` });
    }
}
```

## 总结

通过在 ActionLog 中显示事件的 `reason` 字段，用户可以更清楚地了解随从移动或消灭的原因，提升游戏体验和可调试性。
