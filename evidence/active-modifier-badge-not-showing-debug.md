# ActiveModifierBadge 不显示问题调试

## 问题描述

用户反馈：使用 Volley（万箭齐发）卡牌后，**右上角骰子区域上方的"攻击修正"徽章不显示**。

## 截图分析

用户提供的截图显示：
- **红框位置**：骰子区域上方（应该显示"攻击修正"徽章的位置）
- **实际情况**：红框位置是空的，没有显示任何内容
- **骰子状态**：显示了 5 颗骰子（3个弓面、2个足面）
- **投掷结果弹窗**：显示"投掷结果"弹窗，说明骰子已经投掷完成

## 预期行为

使用 Volley 卡牌后，右上角应该显示：
1. **ActiveModifierBadge**："攻击修正 ×1"（琥珀色徽章）
2. **AttackBonusDamageDisplay**："+2 伤害"（红色徽章）← 新增的组件

## 可能的原因

### 1. Volley 卡牌没有 isAttackModifier 标记

**检查结果**：✅ 已确认 Volley 卡牌有 `isAttackModifier: true` 标记

```typescript
// src/games/dicethrone/heroes/moon_elf/cards.ts
{
    id: 'volley',
    name: cardText('volley', 'name'),
    type: 'action',
    cpCost: 1,
    timing: 'roll',
    description: cardText('volley', 'description'),
    previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MOON_ELF, index: 2 },
    isAttackModifier: true,  // ✅ 已标记
    effects: [{ description: 'Effect', action: { type: 'custom', target: 'self', customActionId: 'moon_elf-action-volley' }, timing: 'immediate' }]
}
```

### 2. EventStream 中没有 CARD_PLAYED 事件

**可能原因**：
- Volley 卡牌打出时没有发射 CARD_PLAYED 事件
- CARD_PLAYED 事件被过滤或丢失

**检查方法**：添加日志到 `useActiveModifiers` Hook，查看 EventStream 中的事件

### 3. ATTACK_RESOLVED 事件过早触发

**可能原因**：
- 投掷骰子后立即触发 ATTACK_RESOLVED 事件
- 导致 `useActiveModifiers` 清空了修正卡列表

**检查方法**：添加日志到 `useActiveModifiers` Hook，查看 ATTACK_RESOLVED 事件的触发时机

### 4. useActiveModifiers 返回空数组

**可能原因**：
- `scanActiveModifiers` 函数没有找到修正卡
- `findHeroCard` 函数返回 null

**检查方法**：添加日志到 `useActiveModifiers` Hook，查看扫描结果

### 5. activeModifiers 没有正确传递到 RightSidebar

**可能原因**：
- Board.tsx 中 `useActiveModifiers` 返回空数组
- RightSidebar 的条件渲染逻辑有问题

**检查方法**：添加日志到 RightSidebar，查看 `activeModifiers` prop 的值

## 调试步骤

### 1. 添加日志到 useActiveModifiers

```typescript
// src/games/dicethrone/hooks/useActiveModifiers.ts
useEffect(() => {
    // 首次挂载：扫描历史事件，恢复未结算的修正卡
    if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        const restoredModifiers = scanActiveModifiers(eventStreamEntries);
        console.log('[useActiveModifiers] 首次挂载，扫描历史事件:', {
            totalEntries: eventStreamEntries.length,
            restoredModifiers,
        });
        // ...
    }

    const { entries: newEntries, didReset } = consumeNew();
    
    // 撤回操作
    if (didReset) {
        const restoredModifiers = scanActiveModifiers(eventStreamEntries);
        console.log('[useActiveModifiers] 撤回操作，重新扫描:', {
            totalEntries: eventStreamEntries.length,
            restoredModifiers,
        });
        // ...
    }
    
    if (newEntries.length === 0) return;

    for (const entry of newEntries) {
        const { type, payload } = entry.event;

        if (type === 'CARD_PLAYED') {
            const p = payload as { cardId: string };
            const card = findHeroCard(p.cardId);
            console.log('[useActiveModifiers] CARD_PLAYED 事件:', {
                cardId: p.cardId,
                card,
                isAttackModifier: card?.isAttackModifier,
            });
            // ...
        }

        if (type === 'ATTACK_RESOLVED') {
            console.log('[useActiveModifiers] ATTACK_RESOLVED 事件，清空修正卡');
            shouldClear = true;
        }
    }
    // ...
}, [eventStreamEntries, consumeNew]);
```

### 2. 添加日志到 RightSidebar

```typescript
// src/games/dicethrone/ui/RightSidebar.tsx
React.useEffect(() => {
    console.log('[RightSidebar] activeModifiers:', activeModifiers);
    console.log('[RightSidebar] bonusDamage:', bonusDamage);
}, [activeModifiers, bonusDamage]);
```

### 3. 运行游戏并查看控制台日志

1. 运行游戏，选择月精灵
2. 进入攻击阶段，打出 Volley 卡牌
3. 查看控制台日志：
   - `[useActiveModifiers] CARD_PLAYED 事件` → 确认事件是否触发
   - `[useActiveModifiers] 添加新修正卡` → 确认修正卡是否添加
   - `[RightSidebar] activeModifiers` → 确认 prop 是否传递
   - `[useActiveModifiers] ATTACK_RESOLVED 事件` → 确认清空时机

## 预期日志输出

### 正常情况

```
[useActiveModifiers] CARD_PLAYED 事件: {
  cardId: 'volley',
  card: { id: 'volley', name: '...',  isAttackModifier: true, ... },
  isAttackModifier: true
}
[useActiveModifiers] 添加新修正卡: [
  { cardId: 'volley', nameKey: '...', descriptionKey: '...', timestamp: ..., eventId: ... }
]
[RightSidebar] activeModifiers: [
  { cardId: 'volley', nameKey: '...', descriptionKey: '...', timestamp: ..., eventId: ... }
]
[RightSidebar] bonusDamage: 2
```

### 异常情况 1：没有 CARD_PLAYED 事件

```
// 没有任何日志输出
```

**原因**：Volley 卡牌打出时没有发射 CARD_PLAYED 事件

### 异常情况 2：ATTACK_RESOLVED 过早触发

```
[useActiveModifiers] CARD_PLAYED 事件: { cardId: 'volley', ... }
[useActiveModifiers] 添加新修正卡: [...]
[useActiveModifiers] ATTACK_RESOLVED 事件，清空修正卡
[RightSidebar] activeModifiers: []
```

**原因**：投掷骰子后立即触发 ATTACK_RESOLVED 事件

### 异常情况 3：findHeroCard 返回 null

```
[useActiveModifiers] CARD_PLAYED 事件: {
  cardId: 'volley',
  card: null,
  isAttackModifier: undefined
}
```

**原因**：`findHeroCard('volley')` 返回 null

## 修改文件

- `src/games/dicethrone/hooks/useActiveModifiers.ts`：添加调试日志
- `src/games/dicethrone/ui/RightSidebar.tsx`：添加调试日志

## 下一步

1. 运行游戏，使用 Volley 卡牌
2. 查看控制台日志，确认问题原因
3. 根据日志输出选择修复方案
