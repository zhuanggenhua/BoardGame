# ActiveModifierBadge 首次挂载扫描历史事件修复

## 问题描述

用户反馈：打出 Volley 卡（Moon Elf 攻击修正卡）后，右侧边栏骰子区域上方应该显示"攻击修正"徽章，但实际没有显示。

## 根因分析

### 问题定位

通过用户提供的日志分析：

```
useActiveModifiers.ts:110 [useActiveModifiers] consumeNew 结果: {newEntriesCount: 0, didReset: false, totalEntries: 17}
```

**根本原因**：`useActiveModifiers` 首次挂载时，`useEventStreamCursor` 会跳过所有历史事件（游标推进到最新位置），导致已经打出的攻击修正卡（`CARD_PLAYED` 事件）被跳过，无法恢复到 UI 状态。

### 代码问题

之前的简化版本删除了首次挂载扫描历史事件的逻辑：

```typescript
useEffect(() => {
    const { entries: newEntries, didReset } = consumeNew();
    
    // 撤回操作：清空所有修正卡
    if (didReset) {
        setModifiers([]);
        return;
    }
    
    if (newEntries.length === 0) return;  // ← 首次挂载时直接 return，没有扫描历史
    
    // ... 处理新事件
}, [eventStreamEntries, consumeNew]);
```

**问题**：首次挂载时 `consumeNew()` 返回空数组（游标已推进到最新），然后直接 `return`，没有扫描 EventStream 中已有的攻击修正卡。

### 对比其他 Hook

`useCardSpotlight` 也使用相同的模式（首次挂载跳过历史），但它不需要恢复历史状态，因为卡牌特写是瞬时的，不需要持久化。

但 `useActiveModifiers` 不同：**攻击修正卡的效果会持续到攻击结算完成**，所以需要在首次挂载时恢复未结算的修正卡。

## 修复方案

### 恢复首次挂载扫描逻辑

```typescript
export function useActiveModifiers(config: UseActiveModifiersConfig) {
    const { eventStreamEntries } = config;
    const [modifiers, setModifiers] = useState<ActiveModifier[]>([]);
    const { consumeNew } = useEventStreamCursor({ entries: eventStreamEntries });
    const isFirstMountRef = useRef(true);  // ← 添加首次挂载标志

    useEffect(() => {
        const { entries: newEntries, didReset } = consumeNew();
        
        // 首次挂载：扫描历史事件，恢复未结算的攻击修正卡
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false;
            const restoredModifiers = scanActiveModifiers(eventStreamEntries);
            if (restoredModifiers.length > 0) {
                setModifiers(restoredModifiers);
            }
            return;
        }
        
        // 撤回操作：重新扫描当前 EventStream
        if (didReset) {
            const restoredModifiers = scanActiveModifiers(eventStreamEntries);
            setModifiers(restoredModifiers);
            return;
        }
        
        if (newEntries.length === 0) return;
        
        // ... 处理新事件
    }, [eventStreamEntries, consumeNew]);
}
```

### 扫描逻辑

`scanActiveModifiers` 函数从 EventStream 中找到最后一个 `ATTACK_RESOLVED` 事件之后的所有 `CARD_PLAYED` 事件，过滤出 `isAttackModifier: true` 的卡牌：

```typescript
function scanActiveModifiers(entries: EventStreamEntry[]): ActiveModifier[] {
    // 从后往前找最后一个 ATTACK_RESOLVED
    let lastResolvedIndex = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].event.type === 'ATTACK_RESOLVED') {
            lastResolvedIndex = i;
            break;
        }
    }

    // 收集 ATTACK_RESOLVED 之后的所有攻击修正卡
    const modifiers: ActiveModifier[] = [];
    const startIndex = lastResolvedIndex + 1;
    
    for (let i = startIndex; i < entries.length; i++) {
        const entry = entries[i];
        const { type, payload, timestamp } = entry.event;

        if (type === 'CARD_PLAYED') {
            const p = payload as { cardId: string };
            const card = findHeroCard(p.cardId);
            if (card && card.isAttackModifier) {
                modifiers.push({
                    cardId: p.cardId,
                    nameKey: typeof card.name === 'string' ? card.name : p.cardId,
                    descriptionKey: typeof card.description === 'string' ? card.description : '',
                    timestamp: typeof timestamp === 'number' ? timestamp : 0,
                    eventId: entry.id,
                });
            }
        }
    }

    return modifiers;
}
```

## 验证方案

### 测试场景

1. **正常流程**：
   - 打出 Volley 卡（Moon Elf）
   - 应该立即显示"攻击修正"徽章
   - 攻击结算后徽章消失

2. **刷新恢复**：
   - 打出 Volley 卡
   - 刷新页面
   - 徽章应该恢复显示（首次挂载扫描历史）

3. **撤回恢复**：
   - 打出 Volley 卡
   - 撤回操作
   - 徽章应该消失
   - 重新打出 Volley 卡
   - 徽章应该重新显示

### 预期日志

```
[useActiveModifiers] 首次挂载，扫描历史事件: {totalEntries: 17, restoredModifiers: [{cardId: 'volley', ...}]}
[Board] activeModifiers from useActiveModifiers: [{cardId: 'volley', ...}]
[RightSidebar] activeModifiers: [{cardId: 'volley', ...}]
```

## 相关文件

- `src/games/dicethrone/hooks/useActiveModifiers.ts` - 修复首次挂载扫描逻辑
- `src/games/dicethrone/ui/RightSidebar.tsx` - 渲染 ActiveModifierBadge
- `src/games/dicethrone/ui/ActiveModifierBadge.tsx` - 徽章组件
- `src/games/dicethrone/Board.tsx` - 调用 useActiveModifiers 并传递给 RightSidebar

## 教训总结

1. **持久化状态 vs 瞬时状态**：
   - 瞬时状态（如卡牌特写）：首次挂载跳过历史即可
   - 持久化状态（如攻击修正）：首次挂载必须扫描历史恢复状态

2. **简化代码时的风险**：
   - 删除"看起来冗余"的代码前，必须理解其存在的原因
   - `isFirstMountRef` 和 `scanActiveModifiers` 不是冗余，而是必需的

3. **EventStream 消费模式**：
   - `useEventStreamCursor` 首次挂载跳过历史是正确的（防止重播动画）
   - 但需要持久化状态的 Hook 必须在首次挂载时主动扫描历史

## 下一步

用户需要重启开发服务器并测试：
1. 打出 Volley 卡，确认徽章显示
2. 刷新页面，确认徽章恢复
3. 撤回操作，确认徽章消失
4. 对比其他攻击修正卡（More Please, Red Hot, Get Fired Up），确认行为一致
