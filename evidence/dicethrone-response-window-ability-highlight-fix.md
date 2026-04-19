# DiceThrone 响应窗口技能高亮修复

## 问题描述

用户反馈：响应窗口切换到对方视角时，对方的可选技能没有高亮。

## 根因分析

### 问题链路

1. **响应窗口打开时自动切换视角**（`src/games/dicethrone/ui/viewMode.ts:56-58`）
   - 当本地玩家是响应者时，视角自动切换到对手（`viewMode = 'opponent'`）
   - 这是为了让玩家看到对手的骰子/状态来决定如何响应

2. **技能高亮逻辑依赖视角**（`src/games/dicethrone/Board.tsx:548-552`）
   ```typescript
   const canHighlightAbility = canOperateView && isViewRolling && isRollPhase
       && (currentPhase === 'defensiveRoll' || hasRolled) && !isAttackShowcaseVisible;
   ```
   - `canOperateView = isSelfView && !isSpectator`
   - 当视角切换到对手时，`isSelfView = false`
   - 导致 `canOperateView = false`
   - 最终 `canHighlightAbility = false`

3. **技能列表计算正确**（`src/games/dicethrone/Board.tsx:517-531`）
   - `availableAbilityIds` 在响应窗口打开时正确计算了响应者的可用技能
   - 但是由于 `canHighlightAbility = false`，这些技能不会被高亮显示

### 核心矛盾

- **视角切换设计**：响应窗口打开时，视角切换到对手（让玩家看到对手状态）
- **高亮逻辑假设**：只有在"自己视角"时才能高亮技能
- **实际需求**：响应窗口打开时，即使视角在对手，也应该高亮本地玩家的可用技能

## 修复方案

### 修改文件

`src/games/dicethrone/Board.tsx`（第 548-556 行）

### 修改内容

```typescript
// 修改前
const canHighlightAbility = canOperateView && isViewRolling && isRollPhase
    && (currentPhase === 'defensiveRoll' || hasRolled) && !isAttackShowcaseVisible;
const canSelectAbility = canOperateView && isViewRolling && isRollPhase
    && (currentPhase === 'defensiveRoll' ? true : G.rollConfirmed) && !isAttackShowcaseVisible;

// 修改后
const canHighlightAbility = (
    (canOperateView && isViewRolling && isRollPhase && (currentPhase === 'defensiveRoll' || hasRolled))
    || (isResponseWindowOpen && currentResponderId === rootPid)
) && !isAttackShowcaseVisible;
const canSelectAbility = (
    (canOperateView && isViewRolling && isRollPhase && (currentPhase === 'defensiveRoll' ? true : G.rollConfirmed))
    || (isResponseWindowOpen && currentResponderId === rootPid)
) && !isAttackShowcaseVisible;
```

### 修复逻辑

1. **保留原有逻辑**：掷骰阶段的技能高亮逻辑不变
2. **新增响应窗口逻辑**：当响应窗口打开且本地玩家是响应者时，允许高亮和选择技能
3. **条件组合**：使用 `||` 连接两种场景，满足任一条件即可

### 为什么这样修复

- **不破坏现有功能**：掷骰阶段的技能高亮逻辑完全保留
- **解决响应窗口问题**：响应窗口打开时，本地玩家是响应者，允许高亮技能
- **逻辑清晰**：两种场景分别判断，易于理解和维护

## 验证方法

### 测试场景

1. 玩家 A 使用攻击技能
2. 响应窗口打开，玩家 B 是响应者
3. 视角自动切换到玩家 A（对手）
4. 玩家 B 的可用响应技能应该高亮显示

### 预期结果

- ✅ 响应窗口打开时，视角切换到对手
- ✅ 本地玩家的可用响应技能高亮显示
- ✅ 可以点击选择响应技能
- ✅ 掷骰阶段的技能高亮逻辑不受影响

## 相关历史

- `evidence/dicethrone-response-window-view-switch-final-fix.md` - 响应窗口视角切换修复
- `evidence/dicethrone-response-card-highlight-fix.md` - 响应窗口卡牌高亮修复（类似问题）

## 核心教训

1. **视角切换与交互权限分离**：视角切换是为了展示信息，不应影响交互权限
2. **响应窗口是特殊场景**：响应窗口打开时，本地玩家需要在"对手视角"下操作自己的技能
3. **条件组合而非替换**：新增场景时，使用 `||` 组合条件，而不是修改原有逻辑

## 总结

修复了响应窗口切换到对方视角时，对方可选技能没有高亮的问题。通过在 `canHighlightAbility` 和 `canSelectAbility` 的计算中新增响应窗口场景的判断，确保响应窗口打开时本地玩家的可用技能能够正确高亮和选择。
