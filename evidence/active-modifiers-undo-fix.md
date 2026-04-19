# 攻击修正指示器撤回修复

## 问题描述

用户报告了两个相关的 bug：

1. **撤回后没更新**：打出两张攻击修正卡后，撤回一张，UI 上的修正指示器没有移除被撤回的卡
2. **刷新后全部清空**：刷新页面后，所有攻击修正指示器都消失了（即使还有修正卡在生效）

## 根因分析

### 问题1：撤回后没更新

`useActiveModifiers` Hook 在检测到撤回操作（`didReset: true`）时，简单地清空了所有修正卡状态：

```typescript
if (didReset) {
    setModifiers([]);
    return;
}
```

这导致即使只撤回了一张卡，所有修正卡都会从 UI 上消失。

正确的做法应该是：重新扫描当前 EventStream，恢复仍然存在的修正卡。

### 问题2：刷新后全部清空

`useEventStreamCursor` 在首次挂载时会跳过所有历史事件（防止重播动画），导致 `useActiveModifiers` 无法恢复已打出的修正卡。

## 修复方案

### 核心思路

引入 `scanActiveModifiers` 函数，从 EventStream 中扫描未结算的攻击修正卡：

1. 从后往前找最后一个 `ATTACK_RESOLVED` 事件
2. 收集该事件之后的所有 `CARD_PLAYED` 事件
3. 过滤出 `isAttackModifier: true` 的卡牌

### 修改内容

**文件**：`src/games/dicethrone/hooks/useActiveModifiers.ts`

1. **新增 `scanActiveModifiers` 函数**：
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

2. **修改 `useActiveModifiers` Hook**：
   - 首次挂载时扫描历史事件，恢复未结算的修正卡
   - 撤回操作时重新扫描当前 EventStream，恢复仍然存在的修正卡

   ```typescript
   const isFirstMountRef = useRef(true);

   useEffect(() => {
       // 首次挂载：扫描历史事件，恢复未结算的修正卡
       if (isFirstMountRef.current) {
           isFirstMountRef.current = false;
           const restoredModifiers = scanActiveModifiers(eventStreamEntries);
           if (restoredModifiers.length > 0) {
               setModifiers(restoredModifiers);
           }
           // 推进游标（跳过历史事件）
           consumeNew();
           return;
       }

       const { entries: newEntries, didReset } = consumeNew();
       
       // 撤回操作：重新扫描当前 EventStream，恢复仍然存在的修正卡
       if (didReset) {
           const restoredModifiers = scanActiveModifiers(eventStreamEntries);
           setModifiers(restoredModifiers);
           return;
       }
       
       // ... 正常消费新事件
   }, [eventStreamEntries, consumeNew]);
   ```

3. **新增 `eventId` 字段**：
   ```typescript
   export interface ActiveModifier {
       cardId: string;
       nameKey: string;
       descriptionKey: string;
       timestamp: number;
       eventId: number;  // 新增：用于撤回时精确匹配
   }
   ```

## 测试验证

创建了 `src/games/dicethrone/__tests__/active-modifiers-undo.test.ts`，验证以下场景：

1. ✅ 能正确扫描未结算的修正卡
2. ✅ 撤回后能正确恢复剩余的修正卡
3. ✅ 攻击结算后清空所有修正卡
4. ✅ 攻击结算后打出新卡，能正确扫描
5. ✅ 忽略非攻击修正卡

所有测试通过。

## 修复效果

- **撤回操作**：撤回一张修正卡后，只有被撤回的卡从 UI 上移除，其他修正卡仍然显示
- **刷新页面**：刷新后能正确恢复未结算的修正卡，不会全部清空

## 相关文件

- `src/games/dicethrone/hooks/useActiveModifiers.ts` - 修复核心逻辑
- `src/games/dicethrone/__tests__/active-modifiers-undo.test.ts` - 测试用例
- `src/engine/hooks/useEventStreamCursor.ts` - EventStream 游标管理（已有功能，无需修改）
