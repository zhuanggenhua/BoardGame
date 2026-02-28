# UX 改进：alien_probe（探究）应该在展示手牌时直接选择

## 问题描述

**游戏**: SmashUp  
**类型**: UX 改进  
**优先级**: P2（功能正确但体验不佳）  
**状态**: 📋 待实现

## 当前行为

探究（alien_probe）的交互流程：
1. 打出探究卡
2. 选择对手（多对手时）
3. **展示对手手牌**（`RevealOverlay`，需要点击关闭）
4. **弹出选择交互**（`PromptOverlay`，选择要弃掉的随从）

**问题**：用户需要两次操作：
- 第一次：点击关闭手牌展示浮层
- 第二次：在新弹出的交互中选择随从

## 期望行为

**一步完成**：在展示对手手牌时，直接允许点击选择随从，无需关闭浮层再弹出新交互。

流程应该是：
1. 打出探究卡
2. 选择对手（多对手时）
3. **展示对手手牌并允许点击选择随从**（一步完成）

## 技术方案

### 方案 A：扩展 RevealOverlay 支持选择模式（推荐）

在 `RevealOverlay` 中添加"可选择"模式：

```typescript
interface RevealItem {
    // ... 现有字段
    selectable?: {
        interactionId: string;
        filter?: (card: { uid: string; defId: string }) => boolean;
        onSelect: (cardUid: string) => void;
    };
}
```

**优点**：
- 复用现有的卡牌展示 UI
- 交互流程更自然
- 减少弹窗层级

**缺点**：
- 需要修改 `RevealOverlay` 组件
- 需要处理选择后的交互解决逻辑

### 方案 B：创建新的 RevealAndSelectOverlay 组件

创建专门的"展示并选择"组件，独立于 `RevealOverlay`。

**优点**：
- 不影响现有 `RevealOverlay` 的行为
- 职责更清晰

**缺点**：
- 代码重复（卡牌展示逻辑）
- 维护成本更高

### 方案 C：使用 PromptOverlay 的卡牌展示模式（当前实现）

当前实现已经使用了 `PromptOverlay` 的卡牌展示模式（选项包含 `defId` 会自动渲染为卡牌预览）。

**问题**：
- 仍然需要先关闭 `RevealOverlay`
- 两个浮层分离，体验不连贯

## 推荐方案：方案 A

### 实现步骤

1. **修改 `alienProbe` 函数**：
   - 不发送 `REVEAL_HAND` 事件
   - 直接创建交互，在交互数据中包含"需要展示的手牌"信息

2. **修改 `PromptOverlay` 组件**：
   - 检测交互数据中是否包含"展示手牌"标记
   - 如果有，在选项上方展示完整手牌（类似 `RevealOverlay` 的布局）
   - 用户点击卡牌 = 选择该选项

3. **或者扩展 `RevealOverlay`**：
   - 添加 `selectable` 模式
   - 当检测到当前有待解决的交互且 `sourceId` 匹配时，允许点击卡牌直接解决交互

### 代码示例（方案 A - 扩展 PromptOverlay）

```typescript
// alienProbe 函数中
const interaction = createSimpleChoice(
    `alien_probe_${ctx.now}`, ctx.playerId,
    '选择对手手牌中的一张随从，让其弃掉',
    minionOptions,
    'alien_probe',
);

// 在交互数据中添加"展示手牌"标记
(interaction.data as any).revealCards = {
    targetPlayerId: targetPid,
    cards: targetPlayer.hand.map(c => ({ uid: c.uid, defId: c.defId })),
};
```

```typescript
// PromptOverlay 中
const revealCards = (prompt.data as any)?.revealCards;

if (revealCards) {
    // 渲染完整手牌展示（类似 RevealOverlay 的布局）
    // 点击卡牌 = 选择对应选项
}
```

## 影响范围

- `src/games/smashup/abilities/aliens.ts` - alienProbe 函数
- `src/games/smashup/ui/PromptOverlay.tsx` - 添加"展示并选择"模式
- 或 `src/games/smashup/ui/RevealOverlay.tsx` - 添加"可选择"模式

## 相关能力

以下能力也可能受益于"展示并选择"模式：
- 任何需要"查看对手手牌/牌库顶 → 选择其中一张"的能力
- 例如：某些"偷牌"/"交换"类效果

## 优先级判断

- **P2（中优先级）**：功能正确，但 UX 可以改进
- 不影响游戏规则正确性
- 改进后可显著提升用户体验
- 可作为后续 UX 优化的一部分

## 验收标准

- [ ] 打出探究后，展示对手手牌的同时允许点击选择随从
- [ ] 无需关闭展示浮层再弹出新交互
- [ ] 选择随从后，对手正确弃掉该随从
- [ ] 对手手牌中没有随从时，效果正常结束
- [ ] 多对手场景下，先选择对手的流程不变
