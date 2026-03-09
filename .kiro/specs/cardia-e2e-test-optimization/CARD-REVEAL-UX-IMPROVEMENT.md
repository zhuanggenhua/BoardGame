# 卡牌翻开用户体验改进

## 问题描述

**用户反馈**：第一回合，自己应该始终看得到自己打出去的牌，而不是需要对手也打出才能看到。

**原有行为**：
- P1 打出卡牌后，自己的卡牌显示为卡背（未翻开状态）
- 需要等待 P2 也打出卡牌后，双方的卡牌才同时翻开
- 这导致 P1 在等待期间无法看到自己打了什么牌

**问题根源**：
- `EncounterPair` 组件中的卡牌翻开逻辑使用 `player.cardRevealed` 状态
- 该状态只有在双方都打出卡牌后才会设置为 `true`
- 导致玩家无法立即看到自己打出的卡牌

## 解决方案

### 修改卡牌翻开逻辑（Board.tsx）

**优化前**：
```typescript
// 如果是历史遭遇，卡牌已经被解析过，应该显示为翻开
// 如果是当前遭遇，读取玩家的 cardRevealed 状态
const myRevealed = !isLatest || myPlayer.cardRevealed;
const opponentRevealed = !isLatest || opponent.cardRevealed;
```

**优化后**：
```typescript
// 如果是历史遭遇，卡牌已经被解析过，应该显示为翻开
// 如果是当前遭遇：
//   - 我的卡牌：只要存在就翻开（玩家知道自己打了什么）
//   - 对手卡牌：需要 cardRevealed 状态（双方都打出后才翻开）
const myRevealed = !isLatest || !!myCard;
const opponentRevealed = !isLatest || opponent.cardRevealed;
```

### 核心改进

1. **我的卡牌**：只要 `myCard` 存在（即玩家打出了卡牌），就立即翻开
   - 逻辑：`!isLatest || !!myCard`
   - 历史遭遇：永远翻开（`!isLatest` 为 `true`）
   - 当前遭遇：只要打出就翻开（`!!myCard` 为 `true`）

2. **对手卡牌**：保持原有逻辑，需要 `opponent.cardRevealed` 状态
   - 逻辑：`!isLatest || opponent.cardRevealed`
   - 历史遭遇：永远翻开（`!isLatest` 为 `true`）
   - 当前遭遇：需要双方都打出后才翻开（`opponent.cardRevealed` 为 `true`）

## 用户体验改进

### 优化前
1. P1 打出卡牌 → P1 看到卡背（❌ 不知道自己打了什么）
2. P2 打出卡牌 → 双方卡牌同时翻开
3. P1 才能看到自己的卡牌

### 优化后
1. P1 打出卡牌 → P1 立即看到自己的卡牌（✅ 知道自己打了什么）
2. P2 还没打出 → P2 的卡牌显示为空槽位
3. P2 打出卡牌 → P2 的卡牌翻开，双方都能看到对方的卡牌

## 测试验证

### E2E 测试（cardia-card-reveal-ux.e2e.ts）

测试场景：
1. ✅ P1 打出卡牌后，应该立即看到自己的卡牌（翻开状态）
2. ✅ P1 打出卡牌后，对手的卡牌应该显示为空槽位（未打出状态）
3. ✅ P2 打出卡牌后，双方的卡牌都应该翻开

测试结果：
```
=== 阶段1：P1 打出卡牌 ===
✅ P1 打出卡牌
我的卡牌是否可见: true
我的卡牌是否显示影响力: true
空槽位数量: 1

=== 阶段2：P2 打出卡牌 ===
✅ P2 打出卡牌

=== 阶段3：验证双方卡牌都已翻开 ===
战场上的卡牌数量: 2
✅ 双方卡牌都已翻开
✅ 所有断言通过
```

## 技术亮点

1. **最小化修改**：只修改了一行代码（`myRevealed` 的逻辑）
2. **向后兼容**：不影响历史遭遇的显示逻辑
3. **符合直觉**：玩家打出卡牌后立即看到自己的卡牌，符合用户预期
4. **保持悬念**：对手的卡牌仍然保持卡背状态，直到双方都打出

## 相关文件

- `src/games/cardia/Board.tsx` - 修改 `EncounterPair` 组件的卡牌翻开逻辑
- `e2e/cardia-card-reveal-ux.e2e.ts` - E2E 测试验证

## 完成时间
2025-01-03
