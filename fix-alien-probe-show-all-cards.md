# 修复：Alien Probe（探究）应展示所有手牌

## 问题描述

**当前实现（错误）**：
- 打出"探究"后，只展示对手手牌中的随从卡
- 玩家看不到对手的行动卡

**正确实现（应该）**：
- 展示对手的所有手牌（随从 + 行动卡）
- 但只有随从卡可以被选择（行动卡显示但禁用/不可点击）
- 这样玩家可以看到对手的完整手牌信息

**官方规则（Wiki）**：
> "Look at another player's hand and choose a minion in it. That player discards that minion."
> 
> 中文：查看一个玩家的手牌，选择一张随从卡，该个玩家弃掉这张随从

关键词是"查看手牌"（look at hand），而不是"查看随从"（look at minions）。

## 修复内容

### 1. 修改 `src/games/smashup/abilities/aliens.ts`

**修改前**：
```typescript
// 从手牌中筛选随从卡
const minionCards = targetPlayer.hand.filter(c => c.type === 'minion');

// 只展示随从卡
const minionOptions = minionCards.map(card => {
    const def = getMinionDef(card.defId);
    return {
        id: card.uid,
        label: def?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId, targetPlayerId: targetPid , displayMode: 'card' as const },
        _source: 'hand' as const,
    };
});
```

**修改后**：
```typescript
// 从手牌中筛选随从卡（用于检查是否有可选目标）
const minionCards = targetPlayer.hand.filter(c => c.type === 'minion');

// 展示所有手牌，但只有随从可选
const allHandOptions = targetPlayer.hand.map(card => {
    const isMinion = card.type === 'minion';
    const def = getCardDef(card.defId);
    return {
        id: card.uid,
        label: def?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId, targetPlayerId: targetPid , displayMode: 'card' as const },
        _source: 'hand' as const,
        disabled: !isMinion, // 非随从卡禁用（显示但不可选）
    };
});
```

**关键变化**：
1. 展示所有手牌（`targetPlayer.hand`），而不是只展示随从（`minionCards`）
2. 使用 `disabled: !isMinion` 标记非随从卡为禁用状态
3. 使用 `getCardDef()` 而不是 `getMinionDef()`，因为现在包含行动卡

### 2. 更新 `optionsGenerator`

同样的逻辑也应用到动态刷新函数中：

```typescript
(interaction.data as any).optionsGenerator = (state: any) => {
    const targetPlayer = state.core.players[targetPid];
    return targetPlayer.hand.map((card: any) => {
        const isMinion = card.type === 'minion';
        const def = getCardDef(card.defId);
        return {
            id: card.uid,
            label: def?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId, targetPlayerId: targetPid , displayMode: 'card' as const },
            _source: 'hand' as const,
            disabled: !isMinion, // 非随从卡禁用
        };
    });
};
```

### 3. 更新测试

更新 `src/games/smashup/__tests__/alien-probe-bug.test.ts`，验证新行为：

```typescript
it('单对手场景：打出探究应该创建选择随从的交互（展示所有手牌）', () => {
    // ... 测试设置 ...
    
    // 断言：选项应该包含所有手牌（3 张），但只有随从可选
    expect(interaction?.options.length).toBe(3);
    
    // 断言：随从选项应该可选（disabled: false 或 undefined）
    const minionOptions = interaction?.options.filter(opt => 
        opt.value.cardUid === 'h1-1' || opt.value.cardUid === 'h1-2'
    );
    expect(minionOptions?.length).toBe(2);
    minionOptions?.forEach(opt => {
        expect(opt.disabled).toBeFalsy();
    });
    
    // 断言：行动卡选项应该禁用（disabled: true）
    const actionOption = interaction?.options.find(opt => opt.value.cardUid === 'h1-3');
    expect(actionOption).toBeDefined();
    expect(actionOption?.disabled).toBe(true);
});
```

## UI 行为

`PromptOverlay` 组件已经支持 `disabled` 属性：
- 禁用的卡牌会显示为灰色/半透明
- 点击禁用的卡牌不会触发选择
- 玩家可以看到所有卡牌，但只能选择随从

## 测试结果

所有测试通过：
```
✓ 单对手场景：打出探究应该创建选择随从的交互（展示所有手牌）
✓ 选择随从后，对手应该弃掉那张随从
✓ 对手手牌中没有随从时，效果结束
✓ 多对手场景：打出探究应该先选择对手
```

## 影响范围

- 只影响 Alien Probe（探究）这一个能力
- 不影响其他"查看手牌"类能力（如果有的话）
- UI 层无需修改（`PromptOverlay` 已支持 `disabled` 属性）

## 总结

修复后，Alien Probe 的行为符合官方规则：
1. 玩家可以看到对手的所有手牌（信息获取）
2. 但只能选择其中的随从卡弃掉（效果执行）

这样既保证了规则正确性，又提供了更好的游戏体验（玩家可以获得更多信息）。
