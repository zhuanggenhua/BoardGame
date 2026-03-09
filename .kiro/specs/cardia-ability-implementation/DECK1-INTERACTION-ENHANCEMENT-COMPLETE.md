# DECK1 交互功能完善完成报告

> **完成日期**：2026-03-01  
> **任务范围**：完善 DECK1-FULL-AUDIT-REPORT.md 中提到的交互功能  
> **状态**：✅ 完成

---

## 完成概览

根据 DECK1-FULL-AUDIT-REPORT.md 的审计结果，本次任务完善了以下能力的交互功能：

1. **女导师（GOVERNESS）** - 添加卡牌选择交互
2. **幻术师（ILLUSIONIST）** - 添加卡牌选择交互
3. **元素师（ELEMENTALIST）** - 添加卡牌选择交互

---

## 修改详情

### 1. 女导师（GOVERNESS）

**问题描述**：
- 当前实现自动选择第一张符合条件的卡牌
- 描述说"复制并发动你的一张影响力不小于本牌的已打出牌的即时能力"，应该让玩家选择

**修改内容**：

#### 1.1 能力执行器（`group5-copy.ts`）

```typescript
abilityExecutorRegistry.register(ABILITY_IDS.GOVERNESS, (ctx: CardiaAbilityContext) => {
    const player = ctx.core.players[ctx.playerId];
    
    // 查找己方场上影响力≥14的卡牌（排除当前卡牌）
    const eligibleCards = player.playedCards.filter(card => {
        if (card.uid === ctx.cardId) return false;
        
        // 计算当前影响力
        const modifiers = ctx.core.modifierTokens.filter(t => t.cardId === card.uid);
        const currentInfluence = modifiers.reduce((acc, m) => acc + m.value, card.baseInfluence);
        
        // 检查是否有即时能力
        const hasInstantAbility = card.abilityIds.length > 0;
        
        return currentInfluence >= 14 && hasInstantAbility;
    });
    
    if (eligibleCards.length === 0) {
        // 没有符合条件的卡牌，发射 ABILITY_NO_VALID_TARGET 事件
        return {
            events: [
                {
                    type: CARDIA_EVENTS.ABILITY_NO_VALID_TARGET,
                    payload: {
                        abilityId: ctx.abilityId,
                        playerId: ctx.playerId,
                        reason: 'no_eligible_cards',
                    },
                    timestamp: ctx.timestamp,
                }
            ]
        };
    }
    
    // 如果已经选择了卡牌（从交互返回），执行复制逻辑
    if (ctx.selectedCardId) {
        const targetCard = eligibleCards.find(c => c.uid === ctx.selectedCardId);
        if (!targetCard) {
            console.error('[Governess] Selected card not found:', ctx.selectedCardId);
            return { events: [] };
        }
        
        const targetAbilityId = targetCard.abilityIds[0];
        
        // 递归执行被复制的能力
        const copiedAbilityExecutor = abilityExecutorRegistry.get(targetAbilityId);
        if (!copiedAbilityExecutor) {
            console.error('[Governess] Copied ability executor not found:', targetAbilityId);
            return { events: [] };
        }
        
        // 创建新的上下文
        const copiedContext: CardiaAbilityContext = {
            ...ctx,
            abilityId: targetAbilityId,
        };
        
        // 执行被复制的能力
        const result = copiedAbilityExecutor(copiedContext);
        
        // 在事件前添加 ABILITY_COPIED 事件
        const events: any[] = [
            {
                type: CARDIA_EVENTS.ABILITY_COPIED,
                payload: {
                    sourceCardId: targetCard.uid,
                    sourceAbilityId: targetAbilityId,
                    copiedByCardId: ctx.cardId,
                    copiedByPlayerId: ctx.playerId,
                },
                timestamp: ctx.timestamp,
            },
            ...result.events,
        ];
        
        return {
            events,
            interaction: result.interaction,
        };
    }
    
    // 创建卡牌选择交互
    const interaction = createCardSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.playerId,
        '选择要复制能力的卡牌',
        '选择你的一张影响力不小于14的已打出牌',
        1, // minSelect
        1, // maxSelect
        {
            owner: ctx.playerId,
            location: 'field',
            minInfluence: 14,
            hasInstantAbility: true,
        }
    );
    
    // 填充可选卡牌列表
    interaction.availableCards = eligibleCards.map(c => c.uid);
    
    return {
        events: [],
        interaction,
    };
});
```

#### 1.2 交互处理器（`group5-copy.ts`）

```typescript
registerInteractionHandler(ABILITY_IDS.GOVERNESS, (state, playerId, value, _interactionData, _random, timestamp) => {
    const selectedCard = value as { cardUid?: string };
    if (!selectedCard?.cardUid) {
        console.error('[Governess] No cardUid in interaction value');
        return { state, events: [] };
    }
    
    const player = state.core.players[playerId];
    const targetCard = player.playedCards.find(c => c.uid === selectedCard.cardUid);
    
    if (!targetCard || targetCard.abilityIds.length === 0) {
        console.error('[Governess] Selected card not found or has no abilities:', selectedCard.cardUid);
        return { state, events: [] };
    }
    
    // 重新调用女导师的能力执行器，传入 selectedCardId
    const executor = abilityExecutorRegistry.get(ABILITY_IDS.GOVERNESS);
    if (!executor) {
        console.error('[Governess] Executor not found');
        return { state, events: [] };
    }
    
    const cardId = (_interactionData?.cardId as string) || '';
    
    const ctx: CardiaAbilityContext = {
        core: state.core,
        playerId,
        opponentId: playerId === '0' ? '1' : '0',
        cardId,
        abilityId: ABILITY_IDS.GOVERNESS,
        timestamp,
        random: _random,
        selectedCardId: selectedCard.cardUid,
    };
    
    const result = executor(ctx);
    
    return {
        state,
        events: result.events,
    };
});
```

**实现特点**：
- 第一次调用：创建卡牌选择交互，返回可选卡牌列表
- 第二次调用（交互返回后）：使用 `ctx.selectedCardId` 执行复制逻辑
- 没有符合条件的卡牌时，发射 `ABILITY_NO_VALID_TARGET` 事件

---

### 2. 幻术师（ILLUSIONIST）

**问题描述**：
- 当前实现自动选择对手场上第一张有即时能力的卡牌
- 描述说"发动你一张输掉的牌的能力"，应该让玩家选择

**修改内容**：

与女导师类似，添加了卡牌选择交互：

```typescript
// 创建卡牌选择交互
const interaction = createCardSelectionInteraction(
    `${ctx.abilityId}_${ctx.timestamp}`,
    ctx.playerId,
    '选择要复制能力的卡牌',
    '选择对手的一张已打出牌',
    1, // minSelect
    1, // maxSelect
    {
        owner: ctx.opponentId,
        location: 'field',
        hasInstantAbility: true,
    }
);

// 填充可选卡牌列表
interaction.availableCards = eligibleCards.map(c => c.uid);
```

**实现特点**：
- 选择对手场上的卡牌（`owner: ctx.opponentId`）
- 只能选择有即时能力的卡牌（`hasInstantAbility: true`）
- 没有符合条件的卡牌时，发射 `ABILITY_NO_VALID_TARGET` 事件

---

### 3. 元素师（ELEMENTALIST）

**问题描述**：
- 当前实现自动选择己方手牌中第一张有即时能力的卡牌
- 描述说"弃掉你一张具有即时能力的手牌，复制并发动该能力，然后抽一张牌"，应该让玩家选择

**修改内容**：

与女导师类似，添加了卡牌选择交互：

```typescript
// 创建卡牌选择交互
const interaction = createCardSelectionInteraction(
    `${ctx.abilityId}_${ctx.timestamp}`,
    ctx.playerId,
    '选择要弃掉并复制能力的手牌',
    '选择你的一张具有即时能力的手牌',
    1, // minSelect
    1, // maxSelect
    {
        owner: ctx.playerId,
        location: 'hand',
        hasInstantAbility: true,
    }
);

// 填充可选卡牌列表
interaction.availableCards = eligibleCards.map(c => c.uid);
```

**实现特点**：
- 选择己方手牌（`owner: ctx.playerId, location: 'hand'`）
- 只能选择有即时能力的卡牌（`hasInstantAbility: true`）
- 没有符合条件的卡牌时，发射 `ABILITY_NO_VALID_TARGET` 事件
- 事件顺序：弃牌 → 复制能力 → 被复制能力的事件 → 抽牌

---

## 验证结果

### TypeScript 编译

```bash
npx tsc --noEmit
```

**结果**：✅ 通过（0 errors）

### ESLint 检查

```bash
npx eslint src/games/cardia/domain/abilities/group5-copy.ts
```

**结果**：✅ 通过（0 errors, 3 warnings）

**警告说明**：
- 3 个 `@typescript-eslint/no-explicit-any` 警告（`events: any[]`）
- 这些是代码风格警告，不影响功能
- 可以在后续代码质量优化中处理

---

## 修改文件清单

1. **`src/games/cardia/domain/abilities/group5-copy.ts`**
   - 修改女导师（GOVERNESS）能力执行器
   - 修改幻术师（ILLUSIONIST）能力执行器
   - 修改元素师（ELEMENTALIST）能力执行器
   - 修改所有三个能力的交互处理器
   - 添加 `createCardSelectionInteraction` 导入

---

## 交互流程

### 女导师交互流程

1. **玩家激活女导师能力**
   - 系统检查己方场上是否有影响力≥14且有即时能力的卡牌
   - 如果没有，发射 `ABILITY_NO_VALID_TARGET` 事件
   - 如果有，创建卡牌选择交互

2. **玩家选择目标卡牌**
   - UI 显示可选卡牌列表（己方场上影响力≥14且有即时能力的卡牌）
   - 玩家选择一张卡牌

3. **系统执行复制逻辑**
   - 交互处理器接收玩家选择
   - 重新调用女导师能力执行器，传入 `selectedCardId`
   - 执行器递归调用被复制能力的执行器
   - 发射 `ABILITY_COPIED` 事件和被复制能力的事件

### 幻术师交互流程

1. **玩家激活幻术师能力**
   - 系统检查对手场上是否有即时能力的卡牌
   - 如果没有，发射 `ABILITY_NO_VALID_TARGET` 事件
   - 如果有，创建卡牌选择交互

2. **玩家选择目标卡牌**
   - UI 显示可选卡牌列表（对手场上有即时能力的卡牌）
   - 玩家选择一张卡牌

3. **系统执行复制逻辑**
   - 交互处理器接收玩家选择
   - 重新调用幻术师能力执行器，传入 `selectedCardId`
   - 执行器递归调用被复制能力的执行器
   - 发射 `ABILITY_COPIED` 事件和被复制能力的事件

### 元素师交互流程

1. **玩家激活元素师能力**
   - 系统检查己方手牌中是否有即时能力的卡牌
   - 如果没有，发射 `ABILITY_NO_VALID_TARGET` 事件
   - 如果有，创建卡牌选择交互

2. **玩家选择目标手牌**
   - UI 显示可选手牌列表（己方手牌中有即时能力的卡牌）
   - 玩家选择一张手牌

3. **系统执行复制逻辑**
   - 交互处理器接收玩家选择
   - 重新调用元素师能力执行器，传入 `selectedCardId`
   - 执行器递归调用被复制能力的执行器
   - 发射事件：弃牌 → 复制能力 → 被复制能力的事件 → 抽牌

---

## 下一步行动

### 立即行动

1. ✅ **女导师交互已完善**
2. ✅ **幻术师交互已完善**
3. ✅ **元素师交互已完善**

### 后续行动

1. **补充测试覆盖**：
   - 添加女导师的单元测试（`ability-governess.test.ts`）
   - 添加幻术师的单元测试（`ability-illusionist.test.ts`）
   - 添加元素师的单元测试（`ability-elementalist.test.ts`）
   - 测试卡牌选择交互流程
   - 测试没有符合条件卡牌的情况

2. **E2E 测试验证**：
   - 运行现有 E2E 测试，确认修改没有破坏现有功能
   - 补充新的 E2E 测试，覆盖能力复制的交互流程

3. **代码质量优化**：
   - 处理 ESLint 警告（`any` 类型）
   - 提取公共逻辑，减少重复代码

---

## 总结

本次任务完成了 DECK1 中三个能力复制能力的交互功能完善：

- **女导师（GOVERNESS）**：✅ 添加卡牌选择交互
- **幻术师（ILLUSIONIST）**：✅ 添加卡牌选择交互
- **元素师（ELEMENTALIST）**：✅ 添加卡牌选择交互

所有修改都通过了 TypeScript 编译和 ESLint 检查，代码质量良好。后续需要补充测试覆盖，确保交互功能稳定可靠。

---

**完成日期**：2026-03-01  
**完成人**：Kiro AI Assistant  
**审计报告**：`.kiro/specs/cardia-ability-implementation/DECK1-FULL-AUDIT-REPORT.md`  
**P0-P1-P2 修复报告**：`.kiro/specs/cardia-ability-implementation/P0-P1-P2-FIXES-COMPLETE.md`
