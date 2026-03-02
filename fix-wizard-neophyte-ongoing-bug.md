# 学徒（wizard_neophyte）打出 ongoing 行动卡 Bug 修复总结

## 问题描述

用户反馈：学徒使用"作为额外行动打出"选项打出 ongoing 行动卡（如泛滥横行 zombie_overrun）时：
1. ❌ 手牌多了一张（不应该增加）
2. ❌ ongoing 卡不显示卡图
3. ❌ 没有选择目标基地的交互

从手牌正常打出 ongoing 卡可以正常显示，说明卡牌定义本身没问题。

## 根本原因

### 问题 1：continuationContext 未正确传递
第二个交互（选择基地）创建时，`continuationContext` 被错误地放在 config 对象内部，而不是手动添加到 `interaction.data` 中。

### 问题 2：ongoing 卡错误地经过手牌
原实现：
```typescript
// ❌ 错误：先抽到手牌
const drawEvent = { type: SU_EVENTS.CARDS_DRAWN, ... };
// 然后 ACTION_PLAYED 从手牌移除（但卡牌还在牌库顶！）
```

正确流程应该是：ongoing 卡直接从牌库打出并附着到基地，不经过手牌。

### 问题 3：额外行动仍然消耗行动次数
`ACTION_PLAYED` 事件会自动增加 `actionsPlayed`（除非是 special 卡），但学徒的"额外行动"应该不消耗行动次数。

## 修复方案

### 1. 修复 continuationContext 传递
```typescript
// ✅ 正确：手动添加到 interaction.data
const interaction = createSimpleChoice(..., 'wizard_neophyte_choose_base');
const extended = {
    ...interaction,
    data: { ...interaction.data, continuationContext: { cardUid, defId } },
};
return { state: queueInteraction(state, extended), events: [] };
```

### 2. ongoing 卡直接从牌库打出
```typescript
// 第一个 handler：不发 CARDS_DRAWN，只创建交互
if (isOngoing) {
    return { state: queueInteraction(state, extended), events: [] };
}

// 第二个 handler：从牌库移除并附着到基地
const events: SmashUpEvent[] = [
    { type: SU_EVENTS.CARD_REMOVED_FROM_DECK, ... },
    { type: SU_EVENTS.ONGOING_ATTACHED, ... },
];
```

### 3. 添加 isExtraAction 标志
**类型定义**（`src/games/smashup/domain/types.ts`）：
```typescript
export interface ActionPlayedEvent extends GameEvent<'su:action_played'> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        isExtraAction?: boolean; // 新增
    };
}
```

**Reducer**（`src/games/smashup/domain/reduce.ts`）：
```typescript
case SU_EVENTS.ACTION_PLAYED: {
    const { playerId, cardUid, isExtraAction } = event.payload;
    // ...
    actionsPlayed: (isSpecial || isExtraAction) ? player.actionsPlayed : player.actionsPlayed + 1,
}
```

**使用**（`src/games/smashup/abilities/wizards.ts`）：
```typescript
{ type: SU_EVENTS.ACTION_PLAYED, payload: { playerId, cardUid, defId, isExtraAction: true }, timestamp }
```

### 4. 修复 systems.ts 中的 import 错误
添加缺失的 import：
```typescript
import { interceptEvent } from './ongoingEffects';
```

## 修改文件清单

1. ✅ `src/games/smashup/domain/types.ts` - 添加 `isExtraAction` 字段
2. ✅ `src/games/smashup/domain/reduce.ts` - 处理 `isExtraAction` 标志
3. ✅ `src/games/smashup/abilities/wizards.ts` - 修复 ongoing 卡和 standard 卡的处理逻辑
4. ✅ `src/games/smashup/domain/systems.ts` - 添加 `interceptEvent` import
5. ✅ `src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts` - 创建测试用例

## 测试结果

```
✓ 学徒打出 zombie_overrun（泛滥横行）时应该先选择目标基地
  - ✅ ongoing 卡正确附着到基地
  - ✅ 卡牌不在手牌中
  - ✅ actionsPlayed = 0（不消耗行动次数）

✓ 学徒打出 standard 行动卡时不需要选择基地
  - ✅ 行动卡进入弃牌堆
  - ✅ 随从额度增加
  - ✅ actionsPlayed = 0（不消耗行动次数）
```

## 架构改进

此次修复引入了 `isExtraAction` 标志，为未来其他"额外行动"机制提供了通用解决方案：
- 不需要用 `LIMIT_MODIFIED` 补偿行动额度
- 类型安全，编译期检查
- 语义清晰，易于理解和维护

## 验收标准

- [x] ongoing 行动卡从牌库直接打出并附着到基地
- [x] 不经过手牌（手牌数量不变）
- [x] 显示选择基地的交互
- [x] 卡牌正确显示卡图
- [x] 不消耗行动次数（actionsPlayed = 0）
- [x] standard 行动卡正常打出并执行能力
- [x] 所有测试通过
