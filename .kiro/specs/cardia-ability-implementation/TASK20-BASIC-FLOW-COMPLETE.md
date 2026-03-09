# Task 20: E2E 基础流程测试 - 完成报告

## 状态：✅ 完成

## 修复的问题

### 1. ✅ 能力阶段 UI 缺失（关键问题）
**问题**：能力阶段时，`currentCard` 在遭遇解析后被设置为 `null`，导致能力按钮无法渲染。

**根本原因**：
- 在 `reduce.ts` 的 `reduceEncounterResolved` 函数中，遭遇解析后 `currentCard` 被清空
- 但能力阶段的 UI 依赖 `myPlayer.currentCard` 来显示能力按钮

**解决方案**：
- 在 `Board.tsx` 中添加逻辑，能力阶段时从 `playedCards` 中查找当前遭遇的卡牌：
  ```typescript
  const myCurrentCard = isAbilityPhase 
      ? myPlayer.playedCards.find(card => card.encounterIndex === core.turnNumber)
      : myPlayer.currentCard;
  ```
- 更新所有使用 `myPlayer.currentCard` 的地方改为使用 `myCurrentCard`

**文件修改**：
- `src/games/cardia/Board.tsx`

### 2. ✅ 结束回合 UI 缺失
**问题**：结束阶段（`phase === 'end'`）没有提供结束回合的按钮，导致游戏无法进入下一回合。

**解决方案**：
- 在 `Board.tsx` 中添加结束回合按钮：
  ```typescript
  {phase === 'end' && core.currentPlayerId === myPlayerId && (
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <button
              data-testid="cardia-end-turn-btn"
              onClick={() => dispatch(CARDIA_COMMANDS.END_TURN, {})}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-lg shadow-lg transition-colors text-xl"
          >
              {t('endTurn')}
          </button>
      </div>
  )}
  ```

**文件修改**：
- `src/games/cardia/Board.tsx`

### 3. ✅ 能力按钮缺少 testid
**问题**：`AbilityButton` 组件中的激活和跳过按钮没有 `data-testid` 属性，导致 E2E 测试无法定位。

**解决方案**：
- 添加 `data-testid="cardia-activate-ability-btn"` 和 `data-testid="cardia-skip-ability-btn"`

**文件修改**：
- `src/games/cardia/ui/AbilityButton.tsx`

### 4. ✅ 卡牌能力 ID 错误
**问题**：卡牌 8（审判官）使用了不存在的能力 ID `ABILITY_IDS.JUDGE`，导致 `abilityId` 为 `null`。

**根本原因**：
- `ids.ts` 中定义的是 `MAGISTRATE`（审判官）
- `cardRegistry.ts` 中错误地使用了 `JUDGE`

**解决方案**：
- 将 `ABILITY_IDS.JUDGE` 改为 `ABILITY_IDS.MAGISTRATE`

**文件修改**：
- `src/games/cardia/domain/cardRegistry.ts`

### 5. ✅ 测试辅助函数签名错误
**问题**：`e2e/cardia-basic-flow.e2e.ts` 使用了旧的 `setupOnlineMatch` 函数和错误的解构语法。

**解决方案**：
- 统一使用 `setupCardiaOnlineMatch` 函数
- 使用正确的解构：`{ hostPage: p1Page, guestPage: p2Page }`
- 使用 `cleanupCardiaMatch(setup)` 清理

**文件修改**：
- `e2e/cardia-basic-flow.e2e.ts`

### 6. ✅ 跳过能力按钮等待逻辑
**问题**：测试使用 `isVisible()` 检查按钮，超时时间太短，导致按钮还没渲染就跳过了。

**解决方案**：
- 使用 `waitFor({ state: 'visible', timeout: 5000 })` 等待按钮出现
- 添加 try-catch 处理两个玩家的情况

**文件修改**：
- `e2e/cardia-basic-flow.e2e.ts`

## 测试结果

### ✅ e2e/cardia-basic-flow.e2e.ts (3/3 通过)
1. ✅ should complete a full turn cycle
2. ✅ should handle ability activation
3. ✅ should end game when player reaches 5 signets

## 关键学习点

1. **状态生命周期管理**：
   - `currentCard` 在遭遇解析后被清空是正确的设计（避免状态污染）
   - UI 层需要根据阶段从不同来源获取数据（`currentCard` vs `playedCards`）

2. **E2E 测试最佳实践**：
   - 使用 `waitFor()` 而不是 `isVisible()` 来等待元素出现
   - 添加详细的调试日志帮助定位问题
   - 使用 `data-testid` 属性标记所有可交互元素

3. **数据一致性**：
   - 能力 ID 必须在 `ids.ts` 中定义
   - `cardRegistry.ts` 中的引用必须与 `ids.ts` 一致
   - TypeScript 类型检查可以捕获这类错误（如果正确配置）

## 下一步

继续运行剩余的 E2E 测试文件：
1. `e2e/cardia-debug-state.e2e.ts`
2. `e2e/cardia-debug-ability-phase.e2e.ts`
3. `e2e/cardia-modifier-abilities.e2e.ts`
4. `e2e/cardia-resource-abilities.e2e.ts`
5. `e2e/cardia-ongoing-abilities.e2e.ts`
6. `e2e/cardia-interactions.e2e.ts`
7. `e2e/cardia-copy-abilities.e2e.ts`
8. `e2e/cardia-special-mechanics.e2e.ts`
