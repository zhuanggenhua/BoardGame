# E2E UI 交互测试指南

## 核心原则

**真实 E2E 测试用于验证用户可实际完成的 UI 交互链路，不是用于验证业务逻辑，也不是用于通过测试后门改状态。**

## 真实 E2E 的硬规则

1. 只能通过真实 UI 交互推进：点击、输入、键盘、hover、正常确认/取消、正常页面导航。
2. 禁止用测试后门或页面内注入替代用户操作，包括但不限于：
   - `inject...Scene`
   - `applyCoreStateDirect`
   - `dispatchLocalCommand`
   - `setPlayerToken`
   - `applyDiceValues`
   - `page.evaluate(...)` 改写游戏状态
3. `page.evaluate(...)` 在真实 E2E 中只允许做只读检查、辅助断言、调试采样，不允许写状态。
4. 如果某个测试必须依赖状态注入来构造局面，它应归类为“场景注入测试 / harness test / fixture test”，而不应继续声称自己是纯真实 E2E。

## 关于场景构造

真实 E2E 可以使用稳定的非业务捷径来完成测试准备，例如进入固定页面、使用公开可见的测试入口、消除非目标噪声；但不能直接跳过用户决策链路去修改核心对局状态。

如需通过调试面板或 harness 直接构造状态，请改参考 `docs/e2e-state-injection-guide.md`，并将该测试按场景注入测试管理，而非真实 E2E。

### 为什么这里不再推荐状态注入？

因为状态注入会绕过真实用户链路。

它适合做：
- 夹具测试
- 场景复现测试
- 回归最小化定位
- 难以稳定复现的边界局面验证

但它不适合继续被定义为真实 E2E，因为那会掩盖：
- 实际按钮是否可达
- 实际弹窗/高亮/确认链路是否完整
- 真实事件时序是否成立
- 真实用户是否真的能走到目标状态

### 真实 E2E 的使用方法

优先通过页面真实交互完成准备与执行；只有只读调试/断言可以使用 `page.evaluate(...)`。

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
4. 默认项目脚本（如 `npm run test:e2e`）会强制无头运行，不会因为终端残留的 `PW_HEADED` / `PWDEBUG` 突然弹出一批窗口
5. 需要看浏览器时，显式使用 Headed 模式：`npx playwright test --headed`
6. 默认禁止无目标全量跑；本地调试时必须指定相关文件或 `--grep`

### Q: 测试超时怎么办？

A: 检查以下几点：
1. 服务器是否启动？（`npm run dev`）
2. 是否卡在派系选择？（使用 `setupSUOnlineMatch` 自动完成）
3. 是否卡在等待交互？（检查 `waitForPrompt` 的超时时间）
4. 是否有死循环？（检查测试逻辑）

## 总结

**真实 E2E UI 测试的黄金法则**：

1. **只走真实 UI 链路** - 不用状态注入替代用户操作
2. **允许只读采样，不允许写状态** - `page.evaluate(...)` 只能读不能改
3. **只测试 UI 可达性与交互成立** - 业务逻辑用单元/集成/场景注入测试补足
4. **保持简单** - 一个测试只测一个关键交互流程
5. **清理资源** - 总是关闭 context

**记住**：真实 E2E 测试验证的是“用户真的能这样完成操作”，不是“测试 harness 能把状态摆成这样”。
