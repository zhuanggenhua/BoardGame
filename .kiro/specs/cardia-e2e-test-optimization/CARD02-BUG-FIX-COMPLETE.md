# Card02 虚空法师 - Bug 修复完成

## 问题总结

虚空法师能力激活后，交互弹窗正常显示，玩家可以选择目标卡牌，但是**标记没有被移除**。

## 根本原因

**虚空法师创建交互时缺少 `abilityId` 字段**

```typescript
// ❌ 错误：缺少 abilityId 字段
const interaction: any = {
    type: 'card_selection',
    interactionId: `${ctx.abilityId}_${ctx.timestamp}`,
    playerId: ctx.playerId,
    title: '选择目标卡牌',
    description: '从任一张牌上弃掉所有修正标记和持续标记',
    availableCards: allCardsWithMarkers,
    minSelect: 1,
    maxSelect: 1,
    // ❌ 缺少 abilityId 字段！
};
```

### 问题链路

1. 虚空法师创建交互时没有设置 `abilityId` 字段
2. `wrapCardiaInteraction` 函数从 `cardiaInteraction.abilityId` 读取 `sourceId`
3. 由于 `abilityId` 为 `undefined`，`sourceId` 也为 `undefined`
4. `CardiaEventSystem` 收到 `SYS_INTERACTION_RESOLVED` 事件后，无法通过 `sourceId` 找到对应的交互处理器
5. 交互处理器没有被调用，标记移除事件没有被发射
6. 标记保留在状态中

## 修复方案

在虚空法师创建交互时添加 `abilityId` 字段：

```typescript
// ✅ 正确：添加 abilityId 字段
const interaction: CardiaInteraction = {
    type: 'card_selection',
    interactionId: `${ctx.abilityId}_${ctx.timestamp}`,
    playerId: ctx.playerId,
    abilityId: ctx.abilityId,  // ← 添加 abilityId 字段
    title: '选择目标卡牌',
    description: '从任一张牌上弃掉所有修正标记和持续标记',
    availableCards: allCardsWithMarkers,
    minSelect: 1,
    maxSelect: 1,
};
```

## 修改文件

- `src/games/cardia/domain/abilities/group4-card-ops.ts`：添加 `abilityId` 字段

## 架构说明

### 当前架构（正确）

1. **虚空法师交互处理器**：发射 `ONGOING_ABILITY_REMOVED` 和 `MODIFIER_TOKEN_REMOVED` 事件
2. **Reducer (`reduceOngoingAbilityRemoved`)**：
   - 从 `core.ongoingAbilities` 中移除记录（全局持续能力列表）
   - 从 `card.ongoingMarkers` 中移除标记（卡牌上的标记）
3. **Reducer (`reduceModifierTokenRemoved`)**：
   - 从 `core.modifierTokens` 中移除修正标记

### 为什么这样设计是合理的

- **单一职责**：交互处理器负责决定移除哪些标记，Reducer 负责执行移除操作
- **数据一致性**：Reducer 同时更新两个地方（全局列表 + 卡牌标记），确保数据一致
- **可测试性**：可以单独测试交互处理器（事件发射）和 Reducer（状态更新）

### 用户建议的架构（也可行）

用户建议：
1. 虚空法师交互处理器只发射 `ONGOING_ABILITY_REMOVED` 事件
2. 某个 handler/系统检测到卡牌的 `ongoingMarkers` 为空后，自动移除 `core.ongoingAbilities` 中的对应记录

**这个架构也是合理的**，但需要额外的系统来监听状态变化并自动清理。当前架构更简单直接。

## 预期修复后的行为

修复后，虚空法师能力执行流程：

1. ✅ 能力激活（Event: `ABILITY_ACTIVATED`）
2. ✅ 交互创建（Event: `ABILITY_INTERACTION_REQUESTED`，包含 `abilityId`）
3. ✅ 玩家选择目标卡牌（Event: `SYS_INTERACTION_RESOLVED`）
4. ✅ `CardiaEventSystem` 通过 `sourceId` 找到交互处理器
5. ✅ 交互处理器发射标记移除事件：
   - `ONGOING_ABILITY_REMOVED`（移除持续能力）
   - `MODIFIER_TOKEN_REMOVED`（移除修正标记）
6. ✅ Reducer 处理事件，更新状态：
   - 从 `core.ongoingAbilities` 中移除
   - 从 `card.ongoingMarkers` 中移除
   - 从 `core.modifierTokens` 中移除
7. ✅ 标记被成功移除

## 测试验证

### 手动测试

1. 使用 `CARD02-INJECT-STATE.json` 注入测试状态
2. P1 打出虚空法师，P2 打出占卜师
3. P1 激活虚空法师能力
4. 选择 P2 的审判官（有持续标记 + 修正标记）
5. 验证：
   - ✅ `core.ongoingAbilities` 为空
   - ✅ `card.ongoingMarkers` 为空
   - ✅ `core.modifierTokens` 只剩 P1 外科医生的修正标记

### E2E 测试

运行 `npx playwright test cardia-deck1-card02-void-mage.e2e.ts`，应该通过。

## 相关问题

这个问题与 Card15 发明家的问题类似，但根本原因不同：
- **Card15**：交互处理器返回的 `state` 不会被应用（框架层 bug）
- **Card02**：交互处理器根本没有被调用（缺少 `abilityId` 字段）

## 总结

✅ **问题已修复**：添加 `abilityId` 字段后，交互处理器可以被正确调用
✅ **架构合理**：当前的事件驱动架构简单直接，易于测试和维护
✅ **可以测试**：修复后可以通过手动测试和 E2E 测试验证
