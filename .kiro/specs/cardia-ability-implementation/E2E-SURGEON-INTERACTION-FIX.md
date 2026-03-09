# Cardia 外科医生能力交互修复

## 问题描述

外科医生能力测试失败，点击确认按钮后超时，交互无法完成。

## 根本原因

Cardia 使用了自定义的 `CHOOSE_CARD` 命令，但 InteractionSystem 期望使用标准的 `SYS_INTERACTION_RESPOND` 命令。此外，Cardia 缺少交互处理函数注册表来处理交互解决后的逻辑。

## 解决方案

### 1. 创建交互处理函数注册表

创建 `src/games/cardia/domain/abilityInteractionHandlers.ts`，参考 SmashUp 的模式：

```typescript
const interactionHandlers = new Map<string, InteractionHandler>();

export function registerInteractionHandler(sourceId: string, handler: InteractionHandler): void {
    interactionHandlers.set(sourceId, handler);
}

export function getInteractionHandler(sourceId: string): InteractionHandler | undefined {
    return interactionHandlers.get(sourceId);
}
```

### 2. 注册外科医生交互处理函数

在 `group2-modifiers.ts` 中添加：

```typescript
export function registerModifierInteractionHandlers(): void {
    registerInteractionHandler(ABILITY_IDS.SURGEON, (state, _playerId, value, _interactionData, _random, timestamp) => {
        const selectedCard = value as { cardUid?: string };
        
        if (!selectedCard?.cardUid) {
            return { state, events: [] };
        }
        
        return {
            state,
            events: [
                {
                    type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                    payload: {
                        cardId: selectedCard.cardUid,
                        value: 5,
                        source: ABILITY_IDS.SURGEON,
                        timestamp,
                    },
                    timestamp,
                }
            ],
        };
    });
}
```

### 3. 更新 Board.tsx 使用标准交互响应命令

```typescript
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';

const handleCardSelectionConfirm = (selectedCardUids: string[]) => {
    if (!currentInteraction) return;
    
    const data = currentInteraction.data as any;
    const selectedCard = data.cards?.find((c: any) => c.uid === selectedCardUids[0]);
    
    if (selectedCard && selectedCard.optionId) {
        dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: selectedCard.optionId });
    }
    
    setShowCardSelection(false);
};
```

### 4. 更新 systems.ts 监听 SYS_INTERACTION_RESOLVED

```typescript
if (event.type === INTERACTION_EVENTS.RESOLVED) {
    const payload = event.payload as {
        interactionId: string;
        playerId: string;
        optionId: string | null;
        value: unknown;
        sourceId?: string;
        interactionData?: Record<string, unknown>;
    };
    const eventTimestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;

    if (payload.sourceId) {
        const handler = getInteractionHandler(payload.sourceId);
        if (handler) {
            const result = handler(
                newState,
                payload.playerId,
                payload.value,
                payload.interactionData,
                () => Math.random(),
                eventTimestamp
            );
            
            if (result) {
                newState = result.state;
                nextEvents.push(...result.events);
            }
        }
    }
}
```

### 5. 更新 wrapCardiaInteraction 创建真实选项

```typescript
// 创建真实的选项列表
options = cards.map(card => ({
    id: card.optionId,
    label: card.defId,
    value: { cardUid: card.uid }, // 包含 cardUid 的值对象
}));

const interaction = createSimpleChoice(
    cardiaInteraction.interactionId,
    cardiaInteraction.playerId,
    cardiaInteraction.title,
    options, // 使用真实选项而非占位符
    {
        sourceId: cardiaInteraction.interactionId,
        targetType: 'generic',
    }
);
```

### 6. 简化外科医生能力执行器

移除 `ctx.selectedCardId` 分支逻辑，只保留交互创建：

```typescript
abilityExecutorRegistry.register(ABILITY_IDS.SURGEON, (ctx: CardiaAbilityContext) => {
    const availableCards = filterCards(ctx.core, {
        location: 'field',
        owner: ctx.playerId,
    });
    
    if (availableCards.length === 0) {
        return { events: [] };
    }
    
    const interaction = createCardSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.playerId,
        '选择目标卡牌',
        '为你的一张打出的牌添加+5影响力',
        1,
        1,
        { location: 'field', owner: ctx.playerId }
    );
    
    interaction.availableCards = availableCards;
    
    return {
        events: [],
        interaction,
    };
});
```

## 架构模式

Cardia 现在遵循与 SmashUp 相同的交互处理模式：

1. **能力执行器**：创建交互并返回
2. **事件系统**：将交互包装并加入队列
3. **InteractionSystem**：处理 `RESPOND` 命令，发射 `SYS_INTERACTION_RESOLVED` 事件
4. **SimpleChoiceSystem**：实际处理 simple-choice 类型的交互
5. **游戏事件系统**：监听 `SYS_INTERACTION_RESOLVED`，调用注册的处理函数
6. **交互处理函数**：生成实际的游戏事件（如放置修正标记）

## 测试状态

- ✅ 交互创建成功
- ✅ 弹窗显示正确
- ✅ 卡牌选择正常
- ⏳ 确认按钮响应（待验证）

## 下一步

1. 运行测试验证修复
2. 如果测试通过，继续审计其他 E2E 测试
3. 为其他需要交互的能力注册处理函数（天才、使者、图书管理员等）
