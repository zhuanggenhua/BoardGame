# Cardia 外科医生能力 E2E 测试 - 完成报告

## 测试状态

✅ **测试通过** - `e2e/cardia-deck1-card03-surgeon.e2e.ts`

## 修复总结

### 根本问题

1. **交互系统架构不匹配**
   - Cardia 使用自定义 `CHOOSE_CARD` 命令
   - InteractionSystem 期望标准 `SYS_INTERACTION_RESPOND` 命令
   - 缺少交互处理函数注册表

2. **sourceId 映射错误**
   - `wrapCardiaInteraction` 将 `sourceId` 设置为完整的 `interactionId`（格式：`${abilityId}_${timestamp}`）
   - 应该提取能力 ID（`interactionId.split('_')[0]`）
   - 否则无法找到对应的 handler

3. **测试断言不匹配**
   - 测试期望 `card.modifiers?.influence`
   - 实际状态使用 `card.modifierTokens` 数组

### 实施的修复

#### 1. 创建交互处理函数注册表

**文件**: `src/games/cardia/domain/abilityInteractionHandlers.ts`

```typescript
const interactionHandlers = new Map<string, InteractionHandler>();

export function registerInteractionHandler(sourceId: string, handler: InteractionHandler): void {
    interactionHandlers.set(sourceId, handler);
}

export function getInteractionHandler(sourceId: string): InteractionHandler | undefined {
    return interactionHandlers.get(sourceId);
}
```

#### 2. 注册外科医生交互处理函数

**文件**: `src/games/cardia/domain/abilities/group2-modifiers.ts`

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

在 `game.ts` 中调用：
```typescript
import { registerModifierInteractionHandlers } from './domain/abilities/group2-modifiers';
registerModifierInteractionHandlers();
```

#### 3. 更新 Board.tsx 使用标准交互响应命令

**文件**: `src/games/cardia/Board.tsx`

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

#### 4. 更新 systems.ts 监听 SYS_INTERACTION_RESOLVED

**文件**: `src/games/cardia/domain/systems.ts`

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

#### 5. 修复 wrapCardiaInteraction 的 sourceId 提取

**文件**: `src/games/cardia/domain/systems.ts`

```typescript
const interaction = createSimpleChoice(
    cardiaInteraction.interactionId,
    cardiaInteraction.playerId,
    cardiaInteraction.title,
    options,
    {
        // sourceId 应该是能力 ID，这样才能找到对应的 handler
        // interactionId 格式为 "${abilityId}_${timestamp}"，提取 abilityId
        sourceId: cardiaInteraction.interactionId.split('_')[0],
        targetType: 'generic',
    }
);
```

#### 6. 更新测试断言

**文件**: `e2e/cardia-deck1-card03-surgeon.e2e.ts`

```typescript
// 检查 modifierTokens 数组（而非 modifiers 对象）
expect(myCardAfter.modifierTokens).toBeDefined();
expect(myCardAfter.modifierTokens.length).toBeGreaterThan(0);

// 查找外科医生添加的修正标记
const surgeonModifier = myCardAfter.modifierTokens.find(
    (m: any) => m.source === 'deck_i_card_03'
);
expect(surgeonModifier).toBeDefined();
expect(surgeonModifier.value).toBe(5);

// 验证当前影响力 = 基础影响力 + 修正值
expect(myCardAfter.currentInfluence).toBe(myCardAfter.baseInfluence + 5);
```

## 架构验证

✅ 交互创建：能力执行器 → 返回 interaction
✅ 交互包装：CardiaEventSystem → wrapCardiaInteraction
✅ 交互队列：queueInteraction → sys.interaction.current
✅ UI 显示：Board.tsx → CardSelectionModal
✅ 用户选择：点击卡牌 → 点击确认
✅ 命令分发：dispatch(INTERACTION_COMMANDS.RESPOND)
✅ 命令验证：commandTypes 包含 INTERACTION_COMMANDS
✅ 事件发射：SimpleChoiceSystem → SYS_INTERACTION_RESOLVED
✅ 事件处理：CardiaEventSystem → getInteractionHandler → 生成事件
✅ 状态更新：reduce → 应用修正标记

## 测试结果

```
能力执行后: {
  cardDefId: 'deck_i_card_03',
  baseInfluence: 3,
  modifierTokens: [ { value: 5, source: 'deck_i_card_03' } ],
  currentInfluence: 8
}
✅ 所有断言通过
```

## 关键经验

1. **交互系统集成模式**
   - 游戏层创建交互（返回 `CardiaInteraction`）
   - 系统层包装为标准交互（`createSimpleChoice`）
   - 系统层监听 `SYS_INTERACTION_RESOLVED` 事件
   - 通过 `sourceId` 查找并调用注册的处理函数
   - 处理函数生成后续事件（如 `MODIFIER_TOKEN_PLACED`）

2. **sourceId 的重要性**
   - `sourceId` 必须是能力 ID，不能是完整的 `interactionId`
   - `interactionId` 格式为 `${abilityId}_${timestamp}`
   - 需要通过 `split('_')[0]` 提取能力 ID

3. **状态结构一致性**
   - 测试断言必须与实际状态结构一致
   - Cardia 使用 `modifierTokens` 数组，不是 `modifiers` 对象
   - 每个 token 包含 `{ value, source }`

4. **调试策略**
   - 添加日志到关键路径（handler、reducer、系统层）
   - 验证事件是否被生成
   - 验证事件是否被消费
   - 验证状态是否被正确更新

## 后续工作

此修复为所有需要交互的 Cardia 能力建立了标准模式：

1. 在 `abilities/group*.ts` 中注册交互处理函数
2. 在 `game.ts` 中调用注册函数
3. 能力执行器返回交互
4. 系统层自动包装和处理
5. UI 层使用标准 `INTERACTION_COMMANDS.RESPOND`

其他能力（如复制、窃取等）可以复用这个架构。
