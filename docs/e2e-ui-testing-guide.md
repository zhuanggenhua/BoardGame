# E2E UI 交互测试指南

## 核心原则

**E2E 测试用于验证 UI 交互，不是用于验证业务逻辑。**

## 快速构造场景 - 使用调试面板状态注入

### 为什么需要状态注入？

传统 E2E 测试的问题：
- ❌ 需要完整走派系选择流程（30-60秒）
- ❌ 需要打出多张牌才能构造测试场景
- ❌ 依赖随机数，场景不可控
- ❌ 测试不稳定，容易超时

状态注入的优势：
- ✅ 直接跳到目标场景（<1秒）
- ✅ 精确控制游戏状态
- ✅ 测试稳定可重复
- ✅ 专注测试 UI 交互

### 使用方法

项目中已有完整的辅助函数：`e2e/smashup-debug-helpers.ts`

#### 1. 基本流程

```typescript
import {
    setupSUOnlineMatch,
    readFullState,
    applyCoreStateDirect,
    closeDebugPanel,
    waitForHandArea,
    getCurrentPlayer,
    makeCard,
    makeMinion,
} from './smashup-debug-helpers';

test('测试传送门 UI 交互', async ({ browser, baseURL }) => {
    // 1. 创建在线对局（自动完成派系选择）
    const match = await setupSUOnlineMatch(browser, baseURL, [
        'wizards', 'pirates', 'ninjas', 'aliens'
    ]);
    if (!match) throw new Error('创建对局失败');
    
    const { hostPage, guestPage, hostContext, guestContext } = match;
    
    try {
        // 2. 等待游戏界面加载
        await waitForHandArea(hostPage);
        
        // 3. 读取当前状态
        const fullState = await readFullState(hostPage);
        const core = fullState.core ?? fullState;
        const { currentPid, player } = getCurrentPlayer(core);
        
        // 4. 构造测试场景
        player.hand = [
            makeCard('portal-1', 'wizard_portal', 'action', currentPid),
            makeCard('minion-1', 'wizard_chronomage', 'minion', currentPid),
            makeCard('minion-2', 'wizard_chronomage', 'minion', currentPid),
        ];
        player.actionsPlayed = 0;
        player.actionLimit = 1;
        
        // 5. 注入状态
        await applyCoreStateDirect(hostPage, core);
        await closeDebugPanel(hostPage);
        await hostPage.waitForTimeout(1000);
        
        // 6. 测试 UI 交互
        // 点击传送门卡牌
        await hostPage.click('[data-card-uid="portal-1"]');
        
        // 等待交互弹窗出现
        await waitForPrompt(hostPage);
        
        // 验证弹窗显示正确的选项
        const options = await hostPage.evaluate(() => {
            const overlay = document.querySelector('.fixed.inset-0[style*="z-index: 300"]');
            return overlay?.querySelectorAll('.cursor-pointer').length ?? 0;
        });
        expect(options).toBeGreaterThan(0);
        
        // 点击第一个选项
        await clickPromptOption(hostPage, 0);
        
        // 验证随从出现在场上
        await hostPage.waitForTimeout(500);
        const minionsOnBase = await hostPage.evaluate(() => {
            const base = document.querySelector('[data-base-index="0"]');
            return base?.querySelectorAll('[data-minion-uid]').length ?? 0;
        });
        expect(minionsOnBase).toBe(1);
        
    } finally {
        await hostContext.close();
        await guestContext.close();
    }
});
```

#### 2. 常用辅助函数

##### 状态操作

```typescript
// 读取完整状态
const fullState = await readFullState(page);

// 注入状态
await applyCoreStateDirect(page, coreState);

// 关闭调试面板
await closeDebugPanel(page);

// 获取当前玩家
const { currentPid, player } = getCurrentPlayer(core);

// 创建卡牌
const card = makeCard('uid', 'defId', 'type', 'owner');

// 创建随从
const minion = makeMinion('uid', 'defId', 'controller', 'owner', basePower);
```

##### UI 交互

```typescript
// 等待手牌区域
await waitForHandArea(page);

// 点击手牌
await clickHandCard(page, 0); // 点击第一张

// 等待交互弹窗
await waitForPrompt(page);

// 点击弹窗选项
await clickPromptOption(page, 0); // 点击第一个选项
await clickPromptOptionByText(page, '跳过'); // 按文本点击

// 点击基地
await clickBaseByIndex(page, 0);
await clickHighlightedBase(page, 0); // 点击高亮的基地

// 点击随从
await clickHighlightedMinion(page, 0);

// 检查模式
const isBaseSelect = await isBaseSelectMode(page);
const isMinionSelect = await isMinionSelectMode(page);
```

## 测试场景模板

### 模板 1：测试卡牌交互

```typescript
test('测试卡牌 UI 交互', async ({ browser, baseURL }) => {
    const match = await setupSUOnlineMatch(browser, baseURL);
    if (!match) throw new Error('创建对局失败');
    
    const { hostPage, hostContext, guestContext } = match;
    
    try {
        await waitForHandArea(hostPage);
        
        // 构造场景
        const fullState = await readFullState(hostPage);
        const core = fullState.core ?? fullState;
        const { currentPid, player } = getCurrentPlayer(core);
        
        player.hand = [
            makeCard('card-1', 'your_card_defId', 'action', currentPid),
        ];
        // ... 设置其他状态
        
        await applyCoreStateDirect(hostPage, core);
        await closeDebugPanel(hostPage);
        await hostPage.waitForTimeout(1000);
        
        // 测试交互
        await clickHandCard(hostPage, 0);
        
        // 验证 UI 响应
        // ...
        
    } finally {
        await hostContext.close();
        await guestContext.close();
    }
});
```

### 模板 2：测试多步交互

```typescript
test('测试多步 UI 交互', async ({ browser, baseURL }) => {
    const match = await setupSUOnlineMatch(browser, baseURL);
    if (!match) throw new Error('创建对局失败');
    
    const { hostPage, hostContext, guestContext } = match;
    
    try {
        await waitForHandArea(hostPage);
        
        // 构造场景
        const fullState = await readFullState(hostPage);
        const core = fullState.core ?? fullState;
        const { currentPid, player } = getCurrentPlayer(core);
        
        player.hand = [
            makeCard('card-1', 'multistep_card', 'action', currentPid),
        ];
        
        await applyCoreStateDirect(hostPage, core);
        await closeDebugPanel(hostPage);
        await hostPage.waitForTimeout(1000);
        
        // 第一步：打出卡牌
        await clickHandCard(hostPage, 0);
        await waitForPrompt(hostPage);
        
        // 第二步：选择第一个选项
        await clickPromptOption(hostPage, 0);
        await hostPage.waitForTimeout(500);
        
        // 第三步：选择基地
        await waitForBaseSelect(hostPage);
        await clickHighlightedBase(hostPage, 0);
        
        // 验证最终结果
        // ...
        
    } finally {
        await hostContext.close();
        await guestContext.close();
    }
});
```

### 模板 3：测试选择模式

```typescript
test('测试基地/随从选择 UI', async ({ browser, baseURL }) => {
    const match = await setupSUOnlineMatch(browser, baseURL);
    if (!match) throw new Error('创建对局失败');
    
    const { hostPage, hostContext, guestContext } = match;
    
    try {
        await waitForHandArea(hostPage);
        
        // 构造场景
        const fullState = await readFullState(hostPage);
        const core = fullState.core ?? fullState;
        const { currentPid, player } = getCurrentPlayer(core);
        
        // 在场上放一些随从
        core.bases[0].minions = [
            makeMinion('m1', 'test_minion', currentPid, currentPid, 3),
            makeMinion('m2', 'test_minion', currentPid, currentPid, 3),
        ];
        
        player.hand = [
            makeCard('card-1', 'card_that_targets_minion', 'action', currentPid),
        ];
        
        await applyCoreStateDirect(hostPage, core);
        await closeDebugPanel(hostPage);
        await hostPage.waitForTimeout(1000);
        
        // 打出卡牌
        await clickHandCard(hostPage, 0);
        
        // 等待随从选择模式
        await waitForMinionSelect(hostPage);
        
        // 验证随从高亮
        const highlightedCount = await hostPage.evaluate(() => {
            return document.querySelectorAll('[class*="ring-purple-400"]').length;
        });
        expect(highlightedCount).toBeGreaterThan(0);
        
        // 点击高亮的随从
        await clickHighlightedMinion(hostPage, 0);
        
        // 验证结果
        // ...
        
    } finally {
        await hostContext.close();
        await guestContext.close();
    }
});
```

## 最佳实践

### 1. 只测试 UI 交互，不测试业务逻辑

```typescript
// ❌ 错误：在 E2E 中验证业务逻辑
test('传送门应该召唤随从到场上', async ({ page }) => {
    // ... 打出传送门
    // ... 选择随从
    
    // ❌ 验证随从的力量值、技能等业务逻辑
    const minionPower = await page.evaluate(() => {
        const minion = document.querySelector('[data-minion-uid="m1"]');
        return minion?.getAttribute('data-power');
    });
    expect(minionPower).toBe('3');
});

// ✅ 正确：只验证 UI 交互
test('传送门应该显示随从选择弹窗', async ({ page }) => {
    // ... 打出传送门
    
    // ✅ 验证弹窗出现
    await waitForPrompt(page);
    
    // ✅ 验证选项可点击
    const optionCount = await page.evaluate(() => {
        return document.querySelectorAll('.cursor-pointer').length;
    });
    expect(optionCount).toBeGreaterThan(0);
    
    // ✅ 验证点击后弹窗消失
    await clickPromptOption(page, 0);
    const promptVisible = await isPromptVisible(page);
    expect(promptVisible).toBe(false);
});
```

### 2. 使用状态注入快速构造场景

```typescript
// ❌ 错误：通过真实游戏流程构造场景
test('测试消灭随从的 UI', async ({ page }) => {
    // 完成派系选择（30秒）
    // 打出 5 张牌构造场景（20秒）
    // 等待对手回合（10秒）
    // 总共 60 秒才能开始测试
});

// ✅ 正确：直接注入目标场景
test('测试消灭随从的 UI', async ({ page }) => {
    // 读取状态
    const fullState = await readFullState(page);
    const core = fullState.core;
    
    // 直接设置场景（<1秒）
    core.bases[0].minions = [
        makeMinion('m1', 'test', '0', '0', 3),
        makeMinion('m2', 'test', '1', '1', 3),
    ];
    
    await applyCoreStateDirect(page, core);
    // 立即开始测试
});
```

### 3. 使用辅助函数简化代码

```typescript
// ❌ 错误：手写选择器和等待逻辑
test('点击弹窗选项', async ({ page }) => {
    await page.waitForFunction(() => {
        const overlays = document.querySelectorAll('.fixed.inset-0');
        for (const overlay of overlays) {
            if (overlay.style.zIndex === '300') return true;
        }
        return false;
    });
    
    await page.evaluate(() => {
        const overlays = document.querySelectorAll('.fixed.inset-0');
        for (const overlay of overlays) {
            if (overlay.style.zIndex === '300') {
                const btns = overlay.querySelectorAll('button');
                btns[0]?.click();
            }
        }
    });
});

// ✅ 正确：使用辅助函数
test('点击弹窗选项', async ({ page }) => {
    await waitForPrompt(page);
    await clickPromptOption(page, 0);
});
```

### 4. 合理设置超时时间

```typescript
// UI 交互应该很快，不需要长超时
await waitForPrompt(page, 5000); // 5秒足够

// 状态注入后等待渲染
await page.waitForTimeout(500); // 500ms 足够

// 避免不必要的长等待
await page.waitForTimeout(5000); // ❌ 太长了
```

### 5. 清理资源

```typescript
test('测试', async ({ browser, baseURL }) => {
    const match = await setupSUOnlineMatch(browser, baseURL);
    if (!match) throw new Error('创建对局失败');
    
    const { hostPage, hostContext, guestContext } = match;
    
    try {
        // 测试代码
    } finally {
        // ✅ 总是清理资源
        await hostContext.close();
        await guestContext.close();
    }
});
```

## 常见问题

### Q: 为什么测试不稳定？

A: 检查以下几点：
1. 是否使用了状态注入？（避免依赖随机数）
2. 是否等待了足够的渲染时间？（`await page.waitForTimeout(500)`）
3. 是否使用了正确的选择器？（使用辅助函数而不是手写）
4. 是否有网络延迟？（在线模式需要 WebSocket 同步）

### Q: 如何调试 E2E 测试？

A: 使用以下方法：
1. 截图：`await page.screenshot({ path: 'debug.png' })`
2. 打印状态：`console.log(await readFullState(page))`
3. 慢速执行：`await page.waitForTimeout(2000)` 观察 UI 变化
4. Headed 模式：`npx playwright test --headed` 看到浏览器

### Q: 测试超时怎么办？

A: 检查以下几点：
1. 服务器是否启动？（`npm run dev`）
2. 是否卡在派系选择？（使用 `setupSUOnlineMatch` 自动完成）
3. 是否卡在等待交互？（检查 `waitForPrompt` 的超时时间）
4. 是否有死循环？（检查测试逻辑）

## 总结

**E2E UI 测试的黄金法则**：

1. **使用状态注入** - 快速构造场景，不走完整流程
2. **使用辅助函数** - 不要手写选择器和等待逻辑
3. **只测试 UI** - 业务逻辑用单元测试
4. **保持简单** - 一个测试只测一个交互流程
5. **清理资源** - 总是关闭 context

**记住**：E2E 测试是为了验证"UI 能点"，不是为了验证"逻辑对"。
