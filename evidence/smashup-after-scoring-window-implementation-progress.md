# 大杀四方 - 计分后响应窗口实现进度

## 已完成的工作

### Phase 1: 更新验证逻辑（✅ 完成）

**文件**: `src/games/smashup/domain/commands.ts`

1. ✅ 将 `windowType === 'meFirst'` 改为 `windowType === 'beforeScoring' || windowType === 'afterScoring'`
2. ✅ 添加 `specialTiming` 验证逻辑：
   - `beforeScoring` 窗口只能打出 `specialTiming: 'beforeScoring'` 的卡牌
   - `afterScoring` 窗口只能打出 `specialTiming: 'afterScoring'` 的卡牌
3. ✅ 更新错误提示文案

### Phase 2: 更新辅助函数（✅ 完成）

**文件**: `src/games/smashup/domain/abilityHelpers.ts`

1. ✅ 将 `openMeFirstWindow` 的 `windowType` 从 `'meFirst'` 改为 `'beforeScoring'`
2. ✅ 新增 `openAfterScoringWindow` 函数，用于打开计分后响应窗口

### Phase 3: 更新 Reducer（✅ 完成）

**文件**: `src/games/smashup/domain/reducer.ts`

1. ✅ 将 `windowType === 'meFirst'` 改为 `windowType === 'beforeScoring'`

### Phase 4: 更新游戏配置（✅ 完成）

**文件**: `src/games/smashup/game.ts`

1. ✅ 更新 `ResponseWindowSystem` 配置：
   - `responseAdvanceEvents` 添加 `'afterScoring'` 窗口类型
   - `hasRespondableContent` 添加 `specialTiming` 检查逻辑
2. ✅ 确保 `beforeScoring` 窗口只显示 `specialTiming: 'beforeScoring'` 的卡牌
3. ✅ 确保 `afterScoring` 窗口只显示 `specialTiming: 'afterScoring'` 的卡牌

### Phase 5: 更新计分流程（⚠️ 部分完成）

**文件**: `src/games/smashup/domain/index.ts`

1. ✅ 导入 `openAfterScoringWindow` 函数
2. ⚠️ **待完成**：在 `scoreOneBase` 函数中添加计分后响应窗口逻辑

## 待完成的工作

### 核心逻辑：计分后响应窗口

**问题**：当前实现使用 ARMED 机制处理 `afterScoring` 卡牌：
- 在 `beforeScoring` 窗口打出
- 生成 `SPECIAL_AFTER_SCORING_ARMED` 事件
- 在 `scoreOneBase` 中执行

**目标**：改为使用独立的 `afterScoring` 响应窗口：
- 基地计分完成后
- 打开 `afterScoring` 响应窗口
- 玩家可以打出 `specialTiming: 'afterScoring'` 的卡牌
- 所有玩家 pass 后，继续下一个基地或结束计分阶段

**实现位置**：`src/games/smashup/domain/index.ts` 的 `scoreOneBase` 函数

**实现思路**：

```typescript
// 在 scoreOneBase 函数中，BASE_SCORED 和 afterScoring 基地能力执行完成后

// 检查是否有玩家手牌中有 afterScoring 卡牌
const hasAfterScoringCards = Object.values(core.players).some(player => 
    player.hand.some(c => {
        if (c.type !== 'action') return false;
        const def = getCardDef(c.defId) as ActionCardDef | undefined;
        return def?.subtype === 'special' && def.specialTiming === 'afterScoring';
    })
);

if (hasAfterScoringCards) {
    // 打开 afterScoring 响应窗口
    const afterScoringWindowEvt = openAfterScoringWindow('scoreBases', pid, core.turnOrder, now);
    events.push(afterScoringWindowEvt);
    
    // halt=true：等待响应窗口关闭后再继续
    return { events, newBaseDeck, matchState: ms, halt: true };
}

// 无 afterScoring 卡牌：正常发出清除+替换事件
events.push(...postScoringEvents);
return { events, newBaseDeck, matchState: ms };
```

**注意事项**：
1. 需要在 `afterScoring` 基地能力和 ongoing 触发器执行完成后检查
2. 如果有多个基地计分，每个基地计分后都需要检查是否打开 `afterScoring` 窗口
3. 需要处理 `afterScoring` 窗口中创建的交互（如"我们乃最强"的指示物转移交互）

### 移除 ARMED 机制（可选）

**当前状态**：ARMED 机制仍然存在，但不再使用（因为 `afterScoring` 卡牌现在在 `afterScoring` 窗口打出）

**选项 1**：保留 ARMED 机制作为备用（向后兼容）
- 优点：不需要修改现有代码
- 缺点：代码冗余，可能造成混淆

**选项 2**：完全移除 ARMED 机制
- 优点：代码更清晰
- 缺点：需要修改多个文件，风险较高

**推荐**：先保留 ARMED 机制，等 `afterScoring` 窗口稳定后再考虑移除

### 更新测试（⚠️ 待完成）

**需要更新的测试文件**：
- `src/games/smashup/__tests__/meFirst.test.ts`
- `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
- `src/games/smashup/__tests__/properties/coreProperties.test.ts`
- `src/games/smashup/__tests__/ninja-hidden-ninja-*.test.ts`
- `src/games/smashup/__tests__/pirate-cove-chain-fix.test.ts`
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
- `src/games/smashup/__tests__/interactionChainE2E.test.ts`
- `src/games/smashup/__tests__/commandExecutionFlow.test.ts`
- `src/games/smashup/__tests__/zombieInteractionChain.test.ts`
- `src/games/smashup/__tests__/specialInteractionChain.test.ts`
- `src/games/smashup/__tests__/ui-interaction-manual.test.ts`

**更新内容**：
1. 将 `windowType: 'meFirst'` 改为 `windowType: 'beforeScoring'`
2. 将 `windowId: 'meFirst_...'` 改为 `windowId: 'beforeScoring_...'`
3. 更新 `ResponseWindowSystem` 配置中的 `windowTypes`

### E2E 测试（⚠️ 待完成）

**需要创建的测试**：
1. `e2e/smashup-after-scoring-window.e2e.ts`：验证 `afterScoring` 窗口的基本流程
2. `e2e/smashup-we-are-the-champions-after-scoring.e2e.ts`：验证"我们乃最强"在 `afterScoring` 窗口打出

**测试场景**：
1. 基地计分后，打开 `afterScoring` 窗口
2. 玩家可以打出 `specialTiming: 'afterScoring'` 的卡牌
3. 玩家不能打出 `specialTiming: 'beforeScoring'` 的卡牌
4. 所有玩家 pass 后，窗口关闭，继续下一个基地或结束计分阶段
5. 多基地计分时，每个基地计分后都打开 `afterScoring` 窗口

## 架构决策

### 为什么不移除 ARMED 机制？

**原因**：
1. ARMED 机制已经在多个地方使用（`pendingAfterScoringSpecials`、`SPECIAL_AFTER_SCORING_ARMED`、`SPECIAL_AFTER_SCORING_CONSUMED`）
2. 移除需要修改大量代码和测试
3. 当前实现可以共存：
   - `beforeScoring` 窗口：打出 `specialTiming: 'beforeScoring'` 的卡牌（立即执行）
   - `afterScoring` 窗口：打出 `specialTiming: 'afterScoring'` 的卡牌（立即执行）
   - ARMED 机制：作为备用，不再主动使用

### 为什么不在 `beforeScoring` 窗口打出 `afterScoring` 卡牌？

**原因**：
1. 语义不清晰：用户困惑为什么"计分后"的卡牌可以在"计分前"打出
2. 不符合卡牌描述："在一个基地**计分后**"
3. 用户体验不佳：玩家需要在计分前就决定计分后的行动

### 为什么需要两个独立的响应窗口？

**原因**：
1. 语义清晰：计分前打出计分前卡牌，计分后打出计分后卡牌
2. 符合卡牌描述
3. 用户体验更好：玩家可以根据计分结果决定是否打出 `afterScoring` 卡牌

## 下一步工作

1. **实现计分后响应窗口逻辑**（`scoreOneBase` 函数）
2. **更新所有测试文件**（将 `'meFirst'` 改为 `'beforeScoring'`）
3. **创建 E2E 测试**（验证 `afterScoring` 窗口）
4. **运行所有测试**（确保没有破坏现有功能）
5. **手动测试**（验证 UI 显示和交互流程）

## 总结

已完成 Phase 1-4，核心验证逻辑、辅助函数、Reducer 和游戏配置都已更新。

待完成 Phase 5 的核心逻辑（计分后响应窗口）和测试更新。

预计剩余工作量：
- 核心逻辑：1-2 小时
- 测试更新：2-3 小时
- E2E 测试：1-2 小时
- 总计：4-7 小时
