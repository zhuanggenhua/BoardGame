# Reducer 测试修复完成报告

## 修复概览

成功修复了 4 个 reducer 测试，所有 reducer 测试现已通过。

**测试结果**：
- 修复前：253/278 passing (91%)
- 修复后：257/278 passing (92.4%)
- 新增通过：4 tests ✅

---

## 修复详情

### Fix 1: SIGNET_GRANTED 事件定义缺失 ✅

**问题**：
- `flowHooks.ts` 使用 `SIGNET_GRANTED` 事件，但 `events.ts` 中未定义
- 测试使用该事件但 reducer 中没有对应的 case

**解决方案**：
1. 在 `events.ts` 中添加 `SIGNET_GRANTED` 事件常量
2. 添加 `SignetGrantedEvent` 接口定义
3. 在 `reduce.ts` 中添加 `reduceSignetGranted` 函数
4. 添加 reducer case 处理该事件

**修改文件**：
- `src/games/cardia/domain/events.ts`
- `src/games/cardia/domain/reduce.ts`

**测试结果**：✅ 1/1 passing

---

### Fix 2: ENCOUNTER_RESOLVED 测试 payload 不匹配 ✅

**问题**：
- 测试使用的 payload 字段与 reducer 期望的不一致
- 测试：`{ winnerId, loserId, player1Id, player1CardUid, ... }`
- Reducer：`{ slotIndex, winner, loser }`

**解决方案**：
- 修改测试使用正确的 payload 结构：`{ slotIndex, winner, loser }`

**修改文件**：
- `src/games/cardia/__tests__/reduce.test.ts`

**测试结果**：✅ 1/1 passing

---

### Fix 3: MODIFIER_ADDED reducer 实现错误 ✅

**问题**：
- Reducer 创建了 `ModifierToken` 对象但没有添加到卡牌的 `modifiers.entries` 数组
- 测试期望 `card.modifiers.entries.length > 0` 但实际为 0

**解决方案**：
1. 重写 `reduceModifierAdded` 函数
2. 查找卡牌（currentCard 或 playedCards）
3. 创建新的 modifier entry（包含 `def` 和 `insertOrder`）
4. 添加到 `modifiers.entries` 数组
5. 更新 `modifiers.nextOrder`

**修改文件**：
- `src/games/cardia/domain/reduce.ts`

**关键代码**：
```typescript
const updatedCard = {
    ...card,
    modifiers: {
        ...card.modifiers,
        entries: [
            ...card.modifiers.entries,
            {
                def: newModifier,
                insertOrder: card.modifiers.nextOrder,
            },
        ],
        nextOrder: card.modifiers.nextOrder + 1,
    },
};
```

**测试结果**：✅ 1/1 passing

---

### Fix 4: TURN_ENDED reducer 未切换玩家 ✅

**问题**：
- Reducer 只增加了 `turnNumber`，没有切换 `currentPlayerId`
- 测试期望 `currentPlayerId` 切换到对手

**解决方案**：
1. 使用 `getOpponentId` 获取对手 ID
2. 更新 `currentPlayerId` 为对手 ID
3. 重置双方玩家的回合状态（`hasPlayed`, `cardRevealed`, `currentCard`）
4. 清理 `currentEncounter`，保存到 `previousEncounter`

**修改文件**：
- `src/games/cardia/domain/reduce.ts`

**关键代码**：
```typescript
const opponentId = getOpponentId(core, playerId);

let newCore = {
    ...core,
    turnNumber: core.turnNumber + 1,
    currentPlayerId: opponentId,
    currentEncounter: undefined,
    previousEncounter: core.currentEncounter,
};

// 重置双方玩家的回合状态
newCore = updatePlayer(newCore, core.playerOrder[0], {
    hasPlayed: false,
    cardRevealed: false,
    currentCard: null,
});
```

**测试结果**：✅ 1/1 passing

---

## 测试通过率进展

| 阶段 | 通过/总数 | 通过率 | 增量 |
|------|----------|--------|------|
| P0 完成后 | 240/278 | 86% | - |
| P1 完成后 | 234/278 | 84% | -6 (测试调整) |
| P2 完成后 | 253/278 | 91% | +19 |
| Reducer 修复后 | 257/278 | 92.4% | +4 |

---

## 剩余失败测试分析

**21 个失败测试分布**：

1. **interaction.test.ts** (3 tests)
   - 验证错误消息文本不匹配
   - 多选卡牌验证失败

2. **其他测试文件** (18 tests)
   - 需要进一步分析

---

## 下一步行动

### 优先级 P3：交互系统测试修复（3 tests）

**问题类型**：
- 错误消息文本不匹配（"No card selected" vs "No cards selected"）
- 多选卡牌验证逻辑问题

**预计工作量**：低（简单的文本修正和验证逻辑调整）

**预计通过率提升**：92.4% → 93.5%

---

## 总结

✅ **所有 reducer 测试现已通过**（9/9）

**关键成果**：
1. 补充了缺失的 `SIGNET_GRANTED` 事件定义
2. 修复了 `MODIFIER_ADDED` reducer 的核心逻辑（正确添加到 ModifierStack）
3. 修复了 `TURN_ENDED` reducer 的玩家切换逻辑
4. 统一了测试 payload 与 reducer 期望的字段结构

**架构改进**：
- Reducer 现在正确使用 `ModifierStack` 的 `entries` 数组
- 回合结束时正确重置所有玩家状态
- 事件定义与 reducer 实现完全对齐

**测试覆盖**：
- ✅ 卡牌打出
- ✅ 卡牌抽取
- ✅ 遭遇解析
- ✅ 印戒授予
- ✅ 修正标记添加
- ✅ 回合结束
- ✅ 阶段变更
- ✅ 卡牌弃掉
- ✅ 卡牌回收

所有核心 reducer 功能已验证正确。
