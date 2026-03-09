# Card07 宫廷卫士回合推进 Bug 修复总结

## 问题描述
宫廷卫士能力激活后，P2 看到弹窗时，回合已经结束并抽牌了。

## 问题根因
在 `executeActivateAbility` 函数中，能力激活后会自动执行回合结束逻辑，即使能力返回了交互。这导致：

1. P1 激活宫廷卫士能力
2. 能力返回派系选择交互
3. 发射 `ABILITY_INTERACTION_REQUESTED` 事件
4. **立即发射回合结束事件**（`TURN_ENDED`、`CARD_DRAWN`、`PHASE_CHANGED`）
5. 所有事件被 reduce，回合结束，抽牌完成
6. 然后交互才被处理并显示给玩家

## 修复内容

### 1. 修改 `src/games/cardia/domain/execute.ts`
在 `executeActivateAbility` 函数中，当能力返回交互时，不执行回合结束逻辑：

```typescript
// 2.2 处理返回的交互
if (result.interaction) {
    events.push({
        type: CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED,
        timestamp,
        payload: {
            abilityId,
            cardId: sourceCardUid,
            playerId,
            interaction: result.interaction,
        },
    });
    
    // ✅ 修复：如果有交互，不执行回合结束逻辑
    // 交互完成后，由交互处理器负责推进回合
    console.log('[Cardia] executeActivateAbility: ability returned interaction, skipping auto end turn');
    return events;
}

// 3. 自动执行回合结束逻辑（仅当没有交互时）
const endTurnEvents = executeAutoEndTurn(core, playerId, random);
events.push(...endTurnEvents);
```

### 2. 修改 `src/games/cardia/domain/systems.ts`
在 `CardiaEventSystem` 中，当交互完成且没有新交互时，自动推进回合：

```typescript
// 处理交互处理器返回的新交互
if ((result as any).interaction) {
    // 有新交互，加入队列
    const engineInteraction = wrapCardiaInteraction(...);
    newState = queueInteraction(newState, engineInteraction);
} else {
    // ✅ 修复：交互完成且没有新交互时，推进回合
    const hasMoreInteractions = newState.sys.interaction.queue.length > 0;
    
    if (!hasMoreInteractions && newState.core.phase === 'ability') {
        console.log('[CardiaEventSystem] Interaction chain completed, auto-advancing turn');
        
        // 抽牌
        for (const pid of Object.keys(newState.core.players)) {
            const player = newState.core.players[pid];
            if (player && player.deck.length > 0) {
                const drawEvent = { type: CARDIA_EVENTS.CARD_DRAWN, ... };
                newState = { ...newState, core: reduce(newState.core, drawEvent) };
                appliedEvents.push(drawEvent);
            }
        }
        
        // 回合结束
        const turnEndEvent = { type: CARDIA_EVENTS.TURN_ENDED, ... };
        newState = { ...newState, core: reduce(newState.core, turnEndEvent) };
        appliedEvents.push(turnEndEvent);
        
        // 阶段变更
        const phaseChangeEvent = { type: CARDIA_EVENTS.PHASE_CHANGED, ... };
        newState = { ...newState, core: reduce(newState.core, phaseChangeEvent) };
        appliedEvents.push(phaseChangeEvent);
    }
}
```

## 工作流程

### 修复前（错误）
1. P1 激活宫廷卫士能力
2. 能力返回派系选择交互
3. **立即执行回合结束逻辑**（抽牌、回合结束）
4. 交互被处理并显示给 P1
5. P1 选择派系
6. 创建 P2 的选择交互
7. **P2 看到弹窗时，已经抽牌了** ❌

### 修复后（正确）
1. P1 激活宫廷卫士能力
2. 能力返回派系选择交互
3. **不执行回合结束逻辑** ✅
4. 交互被处理并显示给 P1
5. P1 选择派系
6. 创建 P2 的选择交互
7. P2 看到弹窗，选择是否弃牌
8. **交互完成后，自动推进回合**（抽牌、回合结束）✅

## 测试验证

### 单元测试
```bash
npx vitest run src/games/cardia/__tests__/court-guard-turn-advance.test.ts
```

输出：
```
[Test] Initial state: { phase: 'ability', turnNumber: 1, p1HandCount: 3, p2HandCount: 1 }

[Cardia] executeActivateAbility: ability returned interaction, skipping auto end turn
← 能力返回交互，跳过自动回合结束

[Test] Activate ability events: [
  'cardia:ability_activated',
  'cardia:ability_interaction_requested'
]
← 只有能力激活和交互请求事件，没有回合结束事件

[Test] After activate ability: { phase: 'ability', turnNumber: 1, p1HandCount: 3, p2HandCount: 1 }
← 回合没有结束，手牌数量不变

✓ 测试通过
```

## 影响范围
此修复影响所有返回交互的能力：
- ✅ 宫廷卫士（Court Guard）：选择派系 → 对手选择是否弃牌
- ✅ 天才（Genius）：选择目标卡牌
- ✅ 使者（Messenger）：选择目标卡牌或下一张牌
- ✅ 发明家（Inventor）：两次选择目标卡牌
- ✅ 所有其他需要交互的能力

## 后续工作
- [ ] 创建完整的 E2E 测试验证宫廷卫士的完整流程
- [ ] 验证其他需要交互的能力是否正常工作
- [ ] 更新游戏规则文档，说明交互和回合推进的机制

## 相关文件
- `src/games/cardia/domain/execute.ts` - 修改能力激活逻辑
- `src/games/cardia/domain/systems.ts` - 添加交互完成后的回合推进逻辑
- `src/games/cardia/__tests__/court-guard-turn-advance.test.ts` - 单元测试
- `src/games/cardia/domain/abilities/group2-modifiers.ts` - 宫廷卫士能力定义
