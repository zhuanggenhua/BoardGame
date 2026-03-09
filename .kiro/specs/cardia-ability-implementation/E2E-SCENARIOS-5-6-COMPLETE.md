# Cardia 场景5-6完成报告

> **日期**: 2026-03-01  
> **状态**: ✅ 完成  
> **测试文件**: `e2e/cardia-full-turn-flow.e2e.ts`

---

## 完成总结

场景5和场景6已成功实现并通过测试！

### 测试结果

```
✅ 场景1：基础回合流程（无能力激活）- 6.6s
✅ 场景2：即时能力回合流程（雇佣剑士）- 4.8s
✅ 场景3：持续能力回合流程（调停者）- 4.6s
✅ 场景4：平局回合流程 - 4.8s
✅ 场景5：牌库为空时的回合流程 - 7.3s
✅ 场景6：达到5印戒时的胜利流程 - 4.6s

总执行时间：37.1s
通过率：100% (6/6)
```

---

## 问题与解决方案

### 问题：游戏结束检测状态读取延迟

**现象**：
- 场景5和场景6中，游戏结束弹窗出现，但 `readCoreState` 读取的 `sys.gameover` 为 `undefined`

**根本原因**：
- `readCoreState` 从调试面板读取状态，调试面板的状态更新有延迟
- 游戏结束检测系统本身是正常工作的，问题在于测试辅助函数

**解决方案**：
1. 创建 `readLiveState` 辅助函数，直接从 `window.__BG_STATE__` 读取实时状态
2. 等待 endgame overlay 出现，而不是依赖状态读取
3. 场景5不需要点击跳过能力按钮，游戏会自动检测无牌可打并结束

---

## 新增辅助函数

### `readLiveState`

```typescript
/**
 * 读取实时状态（直接从 window.__BG_STATE__）
 * 
 * 与 readCoreState 的区别：
 * - readCoreState: 从调试面板读取，可能有延迟
 * - readLiveState: 直接从 React 状态读取，实时更新
 * 
 * 使用场景：
 * - 验证游戏结束状态（sys.gameover）
 * - 验证实时状态变化
 * - 需要完整的 MatchState（包括 core 和 sys）
 * 
 * @returns 完整的 MatchState，包括 core 和 sys
 */
export const readLiveState = async (page: Page): Promise<Record<string, unknown>> => {
    const state = await page.evaluate(() => {
        const state = (window as any).__BG_STATE__;
        return state ? JSON.parse(JSON.stringify(state)) : null;
    });
    
    if (!state) {
        throw new Error('window.__BG_STATE__ is not available');
    }
    
    return state;
};
```

**位置**：`e2e/helpers/cardia.ts`

---

## 场景5：牌库为空时的回合流程

### 测试流程

1. **初始状态**：双方各有1张手牌，牌库为空
2. **阶段1**：双方打出卡牌
3. **阶段2**：等待游戏结束（双方无牌可打）
4. **验证**：游戏结束弹窗出现，P2获胜（P1无牌可打）

### 关键实现

```typescript
// 等待游戏结束弹窗出现
const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
await endgameOverlay.waitFor({ state: 'visible', timeout: 15000 });

// 读取实时状态
const finalState = await readLiveState(setup.player1Page);

// 验证游戏结束
expect(finalState.sys?.gameover).toBeDefined();
expect(finalState.sys?.gameover.winner).toBeDefined();
```

### 测试输出

```
=== 场景5：牌库为空时的回合流程 ===
初始状态: { p1Hand: 1, p2Hand: 1, p1Deck: 0, p2Deck: 0, phase: 'play' }

--- 阶段1：打出卡牌 ---
✅ 阶段1验证通过

--- 阶段2：等待游戏结束（双方无牌可打）---

--- 验证游戏结束 ---
✅ 游戏结束弹窗已出现
游戏结束后: {
  p1Hand: 0,
  p2Hand: 0,
  p1Deck: 0,
  p2Deck: 0,
  gameover: { winner: '1' }
}
✅ 场景5验证通过
```

---

## 场景6：达到5印戒时的胜利流程

### 测试流程

1. **初始状态**：P1有1个印戒，P2有4个印戒
2. **阶段1**：双方打出卡牌，P2获胜并获得第5个印戒
3. **验证**：游戏结束弹窗出现，P2获胜

### 关键实现

```typescript
// 等待游戏结束弹窗出现
const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
await endgameOverlay.waitFor({ state: 'visible', timeout: 10000 });

// 读取实时状态
const finalState = await readLiveState(setup.player1Page);

// 验证印戒数量和游戏结束
const p2TotalSignets = finalPlayers['1'].playedCards.reduce(
    (sum, c) => sum + (c.signets || 0), 0
);
expect(p2TotalSignets).toBeGreaterThanOrEqual(5);
expect(finalState.sys?.gameover).toEqual({ winner: '1' });
```

### 测试输出

```
=== 场景6：达到5印戒时的胜利流程 ===
初始状态: { p1Signets: 1, p2Signets: 4, phase: 'play' }

--- 阶段1：打出卡牌 ---

--- 验证游戏结束（P2达到5印戒）---
✅ 游戏结束弹窗已出现
游戏结束后: { p2TotalSignets: 5, gameover: { winner: '1' }, p2PlayedCards: 5 }
✅ 场景6验证通过
```

---

## 技术要点

### 1. 状态读取方法选择

- **`readCoreState`**：从调试面板读取，适用于大部分场景
- **`readLiveState`**：直接从 `window.__BG_STATE__` 读取，适用于：
  - 验证游戏结束状态
  - 验证实时状态变化
  - 需要完整的 MatchState（包括 sys）

### 2. UI 验证优先

等待 UI 元素出现（如 endgame overlay）比读取内部状态更可靠：
- 更接近用户体验
- 不依赖内部状态结构
- 避免状态读取延迟问题

### 3. 游戏结束检测时机

游戏结束检测在管线（`executePipeline`）中每次命令执行成功后自动调用：
1. 命令执行 → 事件产生
2. 事件 reduce → 状态更新
3. afterEvents hooks → 系统更新
4. `applyGameoverCheck` → 检测游戏结束并写入 `sys.gameover`

---

## 相关文档

- `E2E-GAMEOVER-DEBUG-COMPLETE.md` - 游戏结束检测调试完整报告
- `E2E-SCENARIOS-1-4-COMPLETE.md` - 场景1-4完成报告
- `TIE-AUTO-END-FIX.md` - 平局自动结束修复文档
- `docs/ai-rules/engine-systems.md` - 引擎系统文档（游戏结束检测）

---

**创建时间**: 2026-03-01  
**完成时间**: 2026-03-01  
**总耗时**: 约2小时

