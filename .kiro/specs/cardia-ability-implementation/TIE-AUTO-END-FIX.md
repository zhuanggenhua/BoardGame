# Cardia 平局自动结束回合修复

> **日期**: 2026-03-01  
> **状态**: ✅ 完成  
> **相关测试**: `e2e/cardia-full-turn-flow.e2e.ts` - 场景4

---

## 问题描述

### 现象
- 当双方打出相同影响力的卡牌时（平局），游戏停留在 `ability` 阶段
- 测试场景4失败，超时等待阶段推进到 `play`

### 预期行为
根据游戏规则和设计：
- 平局时无胜者，无印戒放置
- 无失败者，无能力可激活
- 应该跳过能力阶段，直接自动结束回合

### 实际行为
- 平局时仍然推进到 `ability` 阶段
- 游戏停留在该阶段，等待玩家操作
- 但没有任何可操作的按钮（因为无失败者）

---

## 根因分析

### 代码位置
`src/games/cardia/domain/execute.ts` - `resolveEncounter` 函数

### 问题代码
```typescript
// 6. 推进到 ability 阶段
events.push({
    type: CARDIA_EVENTS.PHASE_CHANGED,
    timestamp: Date.now(),
    payload: {
        from: core.phase,
        newPhase: 'ability',
        playerId: player1Id,
    },
});
```

### 根因
- `resolveEncounter` 函数在所有情况下都推进到 `ability` 阶段
- 没有判断平局的特殊情况
- 平局时应该跳过能力阶段，直接结束回合

---

## 修复方案

### 设计思路
1. 在 `resolveEncounter` 中判断遭遇结果
2. 如果是平局（`winner === 'tie'`），直接调用 `executeAutoEndTurn`
3. 如果有胜负，推进到 `ability` 阶段（原有逻辑）

### 实现步骤

#### 1. 传递 `random` 参数到 `resolveEncounter`
```typescript
// 修改函数签名
function resolveEncounter(
    core: CardiaCore,
    player1Id: PlayerId,
    player1Card: any,
    player2Id: PlayerId,
    player2Card: any,
    slotIndex: number,
    random: RandomFn  // 新增参数
): CardiaEvent[] {
```

#### 2. 修改调用点
```typescript
// executePlayCard 中
const encounterEvents = resolveEncounter(
    core,
    playerId,
    card,
    opponentId,
    opponent.currentCard,
    slotIndex,
    _random  // 传递 random 参数
);
```

#### 3. 修改阶段推进逻辑
```typescript
// 6. 推进到 ability 阶段（如果有失败者）或直接结束回合（如果平局）
if (winner === 'tie') {
    // 平局时，跳过能力阶段，直接执行回合结束逻辑
    const endTurnEvents = executeAutoEndTurn(core, player1Id, random);
    events.push(...endTurnEvents);
} else {
    // 有胜负时，推进到 ability 阶段
    events.push({
        type: CARDIA_EVENTS.PHASE_CHANGED,
        timestamp: Date.now(),
        payload: {
            from: core.phase,
            newPhase: 'ability',
            playerId: player1Id,
        },
    });
}
```

---

## 测试验证

### 测试场景4：平局回合流程
```typescript
test('场景4：平局回合流程', async ({ browser }) => {
    const setup = await setupCardiaTestScenario(browser, {
        player1: {
            hand: ['deck_i_card_05'], // 破坏者（影响力5）
            deck: ['deck_i_card_01', 'deck_i_card_02'],
        },
        player2: {
            hand: ['deck_i_card_05'], // 破坏者（影响力5，相同）
            deck: ['deck_i_card_06', 'deck_i_card_07'],
        },
        phase: 'play',
    });
    
    // 打出卡牌
    await playCard(setup.player1Page, 0);
    await playCard(setup.player2Page, 0);
    
    // 等待阶段推进到下一回合的 play（跳过 ability）
    await waitForPhase(setup.player1Page, 'play', 15000);
    
    const afterTie = await readCoreState(setup.player1Page);
    
    // 验证：无印戒放置
    expect(afterTie.players['0'].playedCards[0].signets || 0).toBe(0);
    expect(afterTie.players['1'].playedCards[0].signets || 0).toBe(0);
    
    // 验证：双方抽牌
    expect(afterTie.players['0'].hand.length).toBe(initialP1HandSize);
    expect(afterTie.players['1'].hand.length).toBe(initialP2HandSize);
    
    // 验证：阶段推进
    expect(afterTie.phase).toBe('play');
});
```

### 测试结果
```
=== 场景4：平局回合流程 ===
初始状态: { p1Hand: 1, p2Hand: 1, p1Deck: 2, p2Deck: 2, phase: 'play' }

--- 阶段1：打出卡牌（相同影响力）---

--- 阶段2：平局判定（跳过能力阶段）---
平局后: {
  p1Hand: 1,
  p2Hand: 1,
  p1Deck: 1,
  p2Deck: 1,
  p1Signets: 0,
  p2Signets: 0,
  phase: 'play'
}
✅ 场景4验证通过
```

### 全部测试结果
```
Running 4 tests using 1 worker

✓  1 场景1：基础回合流程（无能力激活） (6.1s)
✓  2 场景2：即时能力回合流程（雇佣剑士） (4.6s)
✓  3 场景3：持续能力回合流程（调停者） (4.7s)
✓  4 场景4：平局回合流程 (4.7s)

4 passed (26.6s)
```

---

## 影响范围

### 修改文件
1. `src/games/cardia/domain/execute.ts`
   - `resolveEncounter` 函数签名（新增 `random` 参数）
   - `executePlayCard` 中的调用点（传递 `_random`）
   - 阶段推进逻辑（平局时调用 `executeAutoEndTurn`）

### 测试文件
1. `e2e/cardia-full-turn-flow.e2e.ts`
   - 场景4：平局回合流程 ✅ 通过

### 不影响
- 其他场景测试（场景1-3）仍然通过
- 现有游戏逻辑（有胜负时的行为不变）
- UI 层代码（无需修改）

---

## 设计原则

### 符合规则文档
- 平局时无胜者，无印戒放置
- 无失败者，无能力可激活
- 应该直接结束回合

### 提升游戏流畅性
- 平局时自动跳过能力阶段
- 无需玩家额外操作
- 游戏流程更自然

### 代码一致性
- 复用 `executeAutoEndTurn` 函数
- 与场景1-3的自动回合结束逻辑一致
- 减少代码重复

---

## 总结

✅ **问题修复**
- 平局时自动跳过能力阶段
- 直接执行回合结束逻辑
- 测试场景4通过

🎯 **设计改进**
- 符合游戏规则
- 提升游戏流畅性
- 代码更简洁

📈 **质量保证**
- 所有测试通过（场景1-4）
- 无副作用（其他场景不受影响）
- 代码可维护性提升

---

**修复时间**: 约30分钟  
**测试时间**: 约10分钟  
**总耗时**: 约40分钟
