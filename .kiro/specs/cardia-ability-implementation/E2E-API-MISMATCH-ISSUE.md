# Cardia E2E 测试 API 不匹配问题

## 问题概述

在尝试补充 Cardia E2E 测试时，发现所有 `cardia-deck1-card*.e2e.ts` 测试文件都使用了**不存在的 helper 函数**，导致测试无法运行。

## 不存在的函数

以下函数在测试文件中被使用，但在 `e2e/helpers/cardia.ts` 中**不存在**：

1. ❌ `setupCardiaOnlineMatch(browser)` - 不存在
2. ❌ `cleanupCardiaMatch(setup)` - 不存在
3. ❌ `injectHandCards(page, playerId, cards)` - 不存在
4. ❌ `setPhase(page, phase)` - 不存在
5. ❌ `playCard(page, index)` - 不存在
6. ❌ `waitForPhase(page, phase)` - 不存在

## 实际可用的 API

`e2e/helpers/cardia.ts` 中实际存在的函数：

1. ✅ `setupOnlineMatch(page, options?)` - 创建在线对局
   - 参数：`page: Page`（不是 `browser`）
   - 返回：`{ player1Page, player2Page, matchId, ... }`（不是 `{ hostPage, guestPage }`）

2. ✅ `readCoreState(page)` - 读取核心状态
3. ✅ `applyCoreStateDirect(page, coreState)` - 直接注入状态
4. ✅ `ensureDebugPanelOpen(page)` - 打开调试面板
5. ✅ `ensureDebugPanelClosed(page)` - 关闭调试面板
6. ✅ `ensureDebugStateTab(page)` - 切换到状态标签

## 受影响的测试文件

所有 16 个 `cardia-deck1-card*.e2e.ts` 测试文件都受影响：

- `e2e/cardia-deck1-card01-mercenary-swordsman.e2e.ts`
- `e2e/cardia-deck1-card02-void-mage.e2e.ts`
- `e2e/cardia-deck1-card03-surgeon.e2e.ts`
- `e2e/cardia-deck1-card04-mediator.e2e.ts`
- `e2e/cardia-deck1-card05-saboteur.e2e.ts`
- `e2e/cardia-deck1-card06-diviner.e2e.ts`
- `e2e/cardia-deck1-card07-court-guard.e2e.ts`
- `e2e/cardia-deck1-card08-judge.e2e.ts`
- `e2e/cardia-deck1-card09-ambusher.e2e.ts`
- `e2e/cardia-deck1-card10-puppeteer.e2e.ts`
- `e2e/cardia-deck1-card11-clockmaker.e2e.ts`
- `e2e/cardia-deck1-card12-treasurer.e2e.ts`
- `e2e/cardia-deck1-card13-swamp-guard.e2e.ts`
- `e2e/cardia-deck1-card14-governess.e2e.ts`
- `e2e/cardia-deck1-card15-inventor.e2e.ts`
- `e2e/cardia-deck1-card16-elf.e2e.ts`

## 根本原因

这些测试文件看起来是基于一个**计划中但尚未实现的 API** 编写的。可能的原因：

1. **文档驱动开发**：先写了测试文件，但 helper 函数还没实现
2. **API 重构**：helper API 被重构了，但测试文件没有更新
3. **复制粘贴错误**：从其他项目复制了测试模板，但 API 不兼容

## 解决方案

### 方案 1：实现缺失的 Helper 函数（推荐）

在 `e2e/helpers/cardia.ts` 中实现缺失的函数：

```typescript
/**
 * 注入手牌（使用调试面板）
 */
export const injectHandCards = async (
    page: Page,
    playerId: string,
    cards: Array<{ defId: string }>
) => {
    const state = await readCoreState(page);
    state.players[playerId].hand = cards.map((card, index) => ({
        ...card,
        uid: `${card.defId}_${Date.now()}_${index}`,
        // ... 其他必需字段
    }));
    await applyCoreStateDirect(page, state);
};

/**
 * 设置游戏阶段
 */
export const setPhase = async (page: Page, phase: string) => {
    const state = await readCoreState(page);
    state.phase = phase;
    await applyCoreStateDirect(page, state);
};

/**
 * 打出卡牌
 */
export const playCard = async (page: Page, index: number) => {
    const card = page.locator(`[data-testid="cardia-hand-area"] [data-testid^="card-"]`).nth(index);
    await card.click();
};

/**
 * 等待进入指定阶段
 */
export const waitForPhase = async (page: Page, phase: string, timeout = 10000) => {
    await expect(page.locator('[data-testid="cardia-phase-indicator"]'))
        .toContainText(phase, { timeout });
};

/**
 * 设置在线对局（兼容旧 API）
 */
export const setupCardiaOnlineMatch = setupOnlineMatch;

/**
 * 清理对局（兼容旧 API）
 */
export const cleanupCardiaMatch = async (setup: CardiaMatchSetup) => {
    await setup.player1Context.close();
    await setup.player2Context.close();
};
```

### 方案 2：重写所有测试文件

使用实际可用的 API 重写所有测试文件。这需要：

1. 修改测试签名：`async ({ browser })` → `async ({ page })`
2. 修改 setup 调用：`setupCardiaOnlineMatch(browser)` → `setupOnlineMatch(page)`
3. 修改返回值解构：`{ hostPage, guestPage }` → `{ player1Page, player2Page }`
4. 手动实现所有状态注入和交互逻辑

### 方案 3：使用现有的工作测试作为模板

参考 `e2e/cardia-basic-flow.e2e.ts` 等实际能运行的测试文件，重写所有测试。

## 推荐行动

1. **立即行动**：实现方案 1（实现缺失的 helper 函数）
   - 优点：最小化改动，所有测试文件只需小幅修改
   - 缺点：需要实现 6 个 helper 函数

2. **短期目标**：修复 3 个高优先级测试（card02, card09, card10）
   - 先实现必需的 helper 函数
   - 验证这 3 个测试能运行

3. **长期目标**：修复所有 16 个测试
   - 确保所有 helper 函数稳定可用
   - 逐个修复并验证测试

## 当前状态

- ❌ 所有 16 个测试文件都无法运行
- ❌ 缺少 6 个关键 helper 函数
- ✅ 已识别问题根源
- ✅ 已制定解决方案

## 下一步

需要决定：
1. 是否实现缺失的 helper 函数？
2. 还是重写所有测试文件？
3. 还是暂时搁置这些测试？

**建议**：实现缺失的 helper 函数（方案 1），因为这是最高效的解决方案。
