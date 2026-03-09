# Card15 发明家 UX 优化完成

## 任务目标
在第二次选牌时，第一次选择的卡牌仍然显示，但覆盖阴影且不可选，方便玩家辨别当前战场情况。

## 实现方案

### 1. 数据层修改
**文件**: `src/games/cardia/domain/interactionHandlers.ts`
- 在 `CardSelectionInteraction` 接口中添加 `disabledCards?: string[]` 字段
- 用于标记哪些卡牌应该显示但禁用

### 2. UI 层修改
**文件**: `src/games/cardia/ui/CardSelectionModal.tsx`
- 添加 `disabledCardUids?: string[]` 属性（默认为空数组）
- 为禁用卡牌添加视觉反馈：
  - 阴影覆盖层（`bg-black/60 backdrop-blur-[2px]`）
  - "已选择"标签（使用 i18n）
  - 禁用点击（`disabled={isDisabled}`）
  - 鼠标样式（`cursor-not-allowed opacity-60`）

### 3. i18n 翻译
**文件**: 
- `public/locales/zh-CN/game-cardia.json` - 添加 `"alreadySelected": "已选择"`
- `public/locales/en/game-cardia.json` - 添加 `"alreadySelected": "Already Selected"`

### 4. 系统层修改
**文件**: `src/games/cardia/domain/systems.ts`

#### 4.1 `wrapCardiaInteraction` 函数
- 在 `interaction.data` 中添加 `disabledCardUids` 字段
- 从 `cardiaInteraction.disabledCards` 读取并传递给 UI
```typescript
(interaction.data as any) = {
    ...interaction.data,
    interactionType,
    cardiaInteraction,
    cards,
    minSelect: cardiaInteraction.type === 'card_selection' ? cardiaInteraction.minSelect : undefined,
    maxSelect: cardiaInteraction.type === 'card_selection' ? cardiaInteraction.maxSelect : undefined,
    disabledCardUids: cardiaInteraction.type === 'card_selection' ? (cardiaInteraction.disabledCards || []) : [],
    cardId: cardId,
};
```

#### 4.2 `CardiaEventSystem.afterEvents`
- 创建第二次交互时，包含所有卡牌（不过滤第一张）
- 将第一张卡牌的 UID 添加到 `disabledCards` 数组
```typescript
secondInteraction.availableCards = allCards;
secondInteraction.disabledCards = [firstCardId];
```

### 5. Board 层修改
**文件**: `src/games/cardia/Board.tsx`
- 在 `CardSelectionModal` 组件中传递 `disabledCardUids` 属性
```typescript
<CardSelectionModal
    title={(currentInteraction.data as any).title || t('selectOneCard')}
    cards={(currentInteraction.data as any).cards || []}
    minSelect={(currentInteraction.data as any).minSelect || 1}
    maxSelect={(currentInteraction.data as any).maxSelect || 1}
    disabledCardUids={(currentInteraction.data as any).disabledCardUids || []}
    onConfirm={handleCardSelectionConfirm}
    onCancel={handleCardSelectionCancel}
/>
```

### 6. 测试更新
**文件**: `e2e/cardia-deck1-card15-inventor-fixed.e2e.ts`
- 更新测试断言，验证第二次交互包含所有卡牌
- 验证第一张卡牌被标记为禁用（`disabledCardUids`）
- 点击第二张卡牌（索引1）而不是第一张（索引0，被禁用）

## 测试结果
✅ 测试通过（`npx playwright test cardia-deck1-card15-inventor-fixed.e2e.ts`）

### 测试输出关键信息
```
第二次交互数据: {
  title: '选择第二张卡牌',
  cardsCount: 4,
  cards: [
    { uid: 'test_0_2000', defId: 'deck_i_card_03' },
    { uid: 'test_0_0', defId: 'deck_i_card_15' },
    { uid: 'test_1_2000', defId: 'deck_i_card_10' },
    { uid: 'test_1_0', defId: 'deck_i_card_16' }
  ],
  disabledCardUids: [ 'test_0_2000' ]
}
✅ 第二次交互包含第一张卡牌（显示但禁用）
✅ 第一张卡牌被标记为禁用
✅ 两次交互完成
✅ 所有断言通过
```

## 用户体验改进
1. **视觉连续性**: 第二次选择时，玩家仍然能看到所有卡牌，包括第一次选择的卡牌
2. **明确反馈**: 第一次选择的卡牌有明显的视觉标记（阴影 + "已选择"标签）
3. **防止误操作**: 禁用的卡牌无法点击，避免玩家重复选择同一张卡牌
4. **战场情况可见**: 玩家可以清楚地看到当前战场上的所有卡牌，方便做出决策

## 技术亮点
1. **数据驱动**: 通过 `disabledCards` 字段控制 UI 行为，而不是硬编码逻辑
2. **类型安全**: 在接口层面定义 `disabledCards` 字段，确保类型一致性
3. **国际化支持**: "已选择"标签支持中英文切换
4. **可扩展性**: 该方案可以轻松扩展到其他需要"显示但禁用"的场景

## 完成时间
2025-01-01

## 相关文件
- `src/games/cardia/domain/interactionHandlers.ts` - 接口定义
- `src/games/cardia/ui/CardSelectionModal.tsx` - UI 组件
- `src/games/cardia/domain/systems.ts` - 系统层逻辑
- `src/games/cardia/Board.tsx` - Board 层集成
- `public/locales/zh-CN/game-cardia.json` - 中文翻译
- `public/locales/en/game-cardia.json` - 英文翻译
- `e2e/cardia-deck1-card15-inventor-fixed.e2e.ts` - E2E 测试
