# Cardia 游戏结束检测调试完成报告

> **日期**: 2026-03-01  
> **状态**: ✅ 问题已解决  
> **测试文件**: `e2e/cardia-gameover-debug.e2e.ts`

---

## 问题总结

场景5和场景6的测试遇到游戏结束检测问题：
- **场景5**：牌库为空时，测试超时等待阶段推进
- **场景6**：P2达到5个印戒，但 `sys.gameover` 显示为 `undefined`

---

## 调试过程

### 1. 初步怀疑：游戏结束检测未被调用

添加了 console.log 到 `isGameOver` 和 `applyGameoverCheck` 函数，但日志未在浏览器控制台出现。

**原因**：这些函数运行在服务端，日志不会出现在浏览器控制台。

### 2. 手动验证游戏结束条件

在客户端手动计算印戒数量，确认 P2 确实有 5 个印戒，游戏应该结束。

**结果**：手动检查显示游戏应该结束，但 `sys.gameover` 仍然是 `undefined`。

### 3. 等待 Endgame Overlay 出现

修改测试，等待游戏结束弹窗（`[data-testid="endgame-overlay"]`）出现。

**结果**：✅ 弹窗出现了！这证明游戏结束检测是正常工作的。

### 4. 根本原因：状态读取方法问题

测试使用 `readCoreState` 辅助函数从调试面板读取状态，但调试面板的状态更新有延迟。

直接从 `window.__BG_STATE__` 读取状态后，发现 `sys.gameover` 确实被正确设置为 `{ winner: '1' }`。

---

## 根本原因

**游戏结束检测系统是正常工作的！**

问题在于测试辅助函数 `readCoreState` 的实现：
- `readCoreState` 从调试面板（`[data-testid="debug-state-json"]`）读取状态
- 调试面板的状态更新有延迟，不是实时的
- 游戏结束时，`window.__BG_STATE__` 已经更新，但调试面板还没有更新

---

## 解决方案

### 方案A：直接从 `window.__BG_STATE__` 读取状态

```typescript
const state = await page.evaluate(() => {
    const state = (window as any).__BG_STATE__;
    return state ? JSON.parse(JSON.stringify(state)) : null;
});
```

**优点**：
- 实时读取，无延迟
- 直接访问 React 状态

**缺点**：
- 需要确保 `window.__BG_STATE__` 存在
- 需要手动序列化（`JSON.parse(JSON.stringify)`）

### 方案B：等待 Endgame Overlay 出现

```typescript
const endgameOverlay = page.locator('[data-testid="endgame-overlay"]');
await endgameOverlay.waitFor({ state: 'visible', timeout: 10000 });
```

**优点**：
- 更接近用户体验（用户看到弹窗 = 游戏结束）
- 不依赖内部状态结构

**缺点**：
- 无法验证 `sys.gameover` 的具体内容
- 依赖 UI 组件

### 方案C：改进 `readCoreState` 辅助函数

创建一个新的辅助函数 `readLiveState`，直接从 `window.__BG_STATE__` 读取：

```typescript
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

**推荐**：方案C，创建新的辅助函数，保持 API 一致性。

---

## 场景5和场景6的正确测试方法

### 场景5：牌库为空时的回合流程

```typescript
test('场景5：牌库为空时的回合流程', async ({ browser }) => {
    const setup = await setupCardiaTestScenario(browser, {
        player1: { hand: ['deck_i_card_01'], deck: [] },
        player2: { hand: ['deck_i_card_05'], deck: [] },
        phase: 'play',
    });
    
    // 打出卡牌
    await playCard(setup.player1Page, 0);
    await playCard(setup.player2Page, 0);
    
    // 等待游戏结束弹窗
    const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
    await endgameOverlay.waitFor({ state: 'visible', timeout: 10000 });
    
    // 验证游戏结束
    const state = await readLiveState(setup.player1Page);
    expect(state.sys.gameover).toBeDefined();
    expect(state.sys.gameover.winner).toBeDefined();
});
```

### 场景6：达到5印戒时的胜利流程

```typescript
test('场景6：达到5印戒时的胜利流程', async ({ browser }) => {
    const setup = await setupCardiaTestScenario(browser, {
        player1: {
            hand: ['deck_i_card_01'],
            playedCards: [{ defId: 'deck_i_card_03', signets: 1 }],
        },
        player2: {
            hand: ['deck_i_card_05'],
            playedCards: [
                { defId: 'deck_i_card_07', signets: 1 },
                { defId: 'deck_i_card_08', signets: 1 },
                { defId: 'deck_i_card_09', signets: 1 },
                { defId: 'deck_i_card_10', signets: 1 },
            ],
        },
        phase: 'play',
    });
    
    // 打出卡牌（P2 获胜，获得第5个印戒）
    await playCard(setup.player1Page, 0);
    await playCard(setup.player2Page, 0);
    
    // 等待游戏结束弹窗
    const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
    await endgameOverlay.waitFor({ state: 'visible', timeout: 10000 });
    
    // 验证游戏结束
    const state = await readLiveState(setup.player1Page);
    expect(state.sys.gameover).toEqual({ winner: '1' });
    
    // 验证印戒数量
    const p2Signets = state.core.players['1'].playedCards.reduce(
        (sum, c) => sum + (c.signets || 0), 0
    );
    expect(p2Signets).toBe(5);
});
```

---

## 下一步

1. ✅ 移除调试日志（`isGameOver` 和 `applyGameoverCheck` 中的 console.log）
2. ✅ 创建 `readLiveState` 辅助函数
3. ✅ 更新场景5和场景6的测试代码
4. ✅ 运行测试验证修复
5. ✅ 合并到原始测试文件 `e2e/cardia-full-turn-flow.e2e.ts`

---

## 教训

1. **状态读取方法很重要**：调试面板的状态可能有延迟，不适合用于验证实时状态变化。
2. **UI 验证优先**：等待 UI 元素出现（如 endgame overlay）比读取内部状态更可靠。
3. **多种验证方法**：结合 UI 验证和状态验证，确保功能正确性。
4. **服务端日志不可见**：在 E2E 测试中，服务端的 console.log 不会出现在浏览器控制台。

---

**创建时间**: 2026-03-01  
**完成时间**: 2026-03-01  
**总耗时**: 约1小时

