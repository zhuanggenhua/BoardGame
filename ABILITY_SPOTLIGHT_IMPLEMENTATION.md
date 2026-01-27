# 技能特写完整实现

## 需要在 Board.tsx 中添加的代码

### 1. 在第 713 行后添加（cardSpotlightQueue useEffect 之后）

```typescript
React.useEffect(() => {
    abilitySpotlightQueueRef.current = abilitySpotlightQueue;
}, [abilitySpotlightQueue]);
```

### 2. 在第 750行后添加（骰子绑定逻辑之后）

```typescript
// 尝试绑定到技能队列（技能左骰右）
const abilityQueue = abilitySpotlightQueueRef.current;
const abilityCandidate = [...abilityQueue]
    .reverse()
    .find((item) => item.playerId === bonusDie.playerId && Math.abs(item.timestamp - bonusDie.timestamp) <= thresholdMs);

if (abilityCandidate) {
    setAbilitySpotlightQueue((prev) =>
        prev.map((item) =>
            item.id === abilityCandidate.id
                ? {
                    ...item,
                    bonusDice: [
                        ...(item.bonusDice || []),
                        { value: bonusDie.value, face: bonusDie.face, timestamp: bonusDie.timestamp },
                    ],
                }
                : item
        )
    );
    setShowBonusDie(false);
    return;
}
```

### 3. 在第 791行后添加（handleCardSpotlightClose 之后）

```typescript
// 监听其他玩家激活技能（加入特写队列）
React.useEffect(() => {
    const lastActivatedAbility = G.lastActivatedAbility;
    const prevTimestamp = prevLastActivatedAbilityTimestampRef.current;

    // 只处理新激活的技能（通过 timestamp 判断）
    if (!lastActivatedAbility || lastActivatedAbility.timestamp === prevTimestamp) {
        return;
    }

    // 只展示其他玩家激活的技能（不显示自己的）
    if (lastActivatedAbility.playerId !== rootPid) {
        const newItem: AbilitySpotlightItem = {
            id: `${lastActivatedAbility.abilityId}-${lastActivatedAbility.timestamp}`,
            timestamp: lastActivatedAbility.timestamp,
            abilityId: lastActivatedAbility.abilityId,
            level: lastActivatedAbility.level,
            playerId: lastActivatedAbility.playerId,
            playerName: opponentName,
            isDefense: lastActivatedAbility.isDefense,
        };
        setAbilitySpotlightQueue(prev => [...prev, newItem]);
    }

    // 始终更新 timestamp 引用
    prevLastActivatedAbilityTimestampRef.current = lastActivatedAbility.timestamp;
}, [G.lastActivatedAbility, rootPid, opponentName]);

// 关闭技能特写（从队列中移除）
const handleAbilitySpotlightClose = React.useCallback((id: string) => {
    setAbilitySpotlightQueue(prev => prev.filter(item => item.id !== id));
}, []);
```

### 4. 在渲染JSX中添加（CardSpotlightOverlay 附近）

搜索 `<CardSpotlightOverlay` 并在其后添加：

```typescript
{/* 技能特写队列 */}
<AbilitySpotlightOverlay
    queue={abilitySpotlightQueue}
    atlas={cardAtlas}
    locale={locale}
    onClose={handleAbilitySpotlightClose}
    opponentHeaderRef={opponentHeaderRef}
    autoCloseDelay={3500}
/>
```

### 5. 修改 CardSpotlightOverlay 的 autoCloseDelay

将：
```typescript
autoCloseDelay={1000}
```

改为：
```typescript
autoCloseDelay={3500}
```

## 完成后运行

```bash
npm run typecheck
```

确保没有类型错误。
