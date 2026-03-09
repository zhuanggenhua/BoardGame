# Card15 发明家 - 分组布局优化完成

## 任务目标
在卡牌选择弹窗中，将卡牌按照玩家归属分成上下两排，中间用 VS 连接，就像战场上的遭遇序列一样。

## 实现方案

### 1. UI 组件修改
**文件**: `src/games/cardia/ui/CardSelectionModal.tsx`

#### 1.1 添加新的 Props
```typescript
interface CardSelectionModalProps {
    // ... 现有 props
    myPlayerId?: string;  // 当前玩家 ID（用于分组显示）
    opponentId?: string;  // 对手玩家 ID（用于分组显示）
}
```

#### 1.2 卡牌分组逻辑
```typescript
// 按玩家归属分组卡牌
const myCards = myPlayerId ? cards.filter(card => card.ownerId === myPlayerId) : [];
const opponentCards = opponentId ? cards.filter(card => card.ownerId === opponentId) : [];
const useGroupedLayout = myPlayerId && opponentId && (myCards.length > 0 || opponentCards.length > 0);
```

#### 1.3 条件渲染布局
- **分组布局**（当 `useGroupedLayout` 为 `true` 时）：
  - 对手卡牌（上方）
  - VS 指示器（中间）
  - 我的卡牌（下方）
- **默认网格布局**（当 `useGroupedLayout` 为 `false` 时）：
  - 2-4 列网格布局

### 2. Board 层修改
**文件**: `src/games/cardia/Board.tsx`

传递 `myPlayerId` 和 `opponentId` 到 `CardSelectionModal`：
```typescript
<CardSelectionModal
    title={(currentInteraction.data as any).title || t('selectOneCard')}
    cards={(currentInteraction.data as any).cards || []}
    minSelect={(currentInteraction.data as any).minSelect || 1}
    maxSelect={(currentInteraction.data as any).maxSelect || 1}
    disabledCardUids={(currentInteraction.data as any).disabledCardUids || []}
    myPlayerId={myPlayerId}
    opponentId={opponentId}
    onConfirm={handleCardSelectionConfirm}
    onCancel={handleCardSelectionCancel}
/>
```

### 3. 布局样式
- **对手区域**：
  - 标签：`t('opponent')` → "Opponent" / "对手"
  - 卡牌横向排列（`flex gap-3 flex-wrap justify-center`）
- **VS 指示器**：
  - 大号字体（`text-3xl font-bold text-purple-400`）
  - 垂直间距（`py-2`）
- **我的区域**：
  - 标签：`t('you')` → "You" / "你"
  - 卡牌横向排列（`flex gap-3 flex-wrap justify-center`）

### 4. 测试验证
**文件**: `e2e/cardia-card-selection-layout-test.e2e.ts`

测试验证了：
- ✅ "Opponent" 标签可见
- ✅ "You" 标签可见
- ✅ "VS" 指示器可见
- ✅ 卡牌按玩家归属正确分组
- ✅ 分组布局正确渲染

## 用户体验改进

### 优化前
- 所有卡牌混在一起，按网格排列
- 无法快速区分哪些是自己的卡牌，哪些是对手的卡牌
- 需要仔细查看每张卡牌才能判断归属

### 优化后
- 卡牌按玩家归属分成上下两排
- 中间有明显的 VS 指示器
- 布局与战场遭遇序列一致，视觉连续性强
- 玩家可以快速识别战场情况，做出更好的决策

## 技术亮点

1. **条件渲染**：根据是否提供 `myPlayerId` 和 `opponentId` 自动切换布局模式
2. **向后兼容**：如果没有提供玩家 ID，自动降级到默认网格布局
3. **国际化支持**：标签支持中英文切换
4. **响应式设计**：使用 `flex-wrap` 确保卡牌在小屏幕上也能正常显示
5. **视觉一致性**：与战场遭遇序列的布局保持一致

## 适用场景

分组布局会在以下情况下自动启用：
- ✅ 提供了 `myPlayerId` 和 `opponentId`
- ✅ 至少有一方有卡牌（`myCards.length > 0 || opponentCards.length > 0`）

默认网格布局会在以下情况下使用：
- ❌ 未提供 `myPlayerId` 或 `opponentId`
- ❌ 双方都没有卡牌

## 完成时间
2025-01-01

## 相关文件
- `src/games/cardia/ui/CardSelectionModal.tsx` - UI 组件（分组布局逻辑）
- `src/games/cardia/Board.tsx` - Board 层（传递玩家 ID）
- `e2e/cardia-card-selection-layout-test.e2e.ts` - E2E 测试
- `e2e/cardia-deck1-card15-inventor-fixed.e2e.ts` - 发明家能力测试（需要更新）

## 后续工作
- 更新 `e2e/cardia-deck1-card15-inventor-fixed.e2e.ts` 测试，使用英文标签验证布局
- 考虑添加更多视觉元素（如玩家头像、印戒数量等）
- 优化移动端显示效果
