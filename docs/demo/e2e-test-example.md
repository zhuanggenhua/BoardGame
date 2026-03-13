# E2E 测试示例：雷霆万钧技能（可视化）

> **文件位置**：`e2e/dicethrone-thunder-strike.e2e.ts`  
> **测试框架**：Playwright  
> **测试对象**：DiceThrone 游戏中武僧的"雷霆万钧"技能

---

## 🎬 测试流程可视化

```
┌─────────────────────────────────────────────────────────────┐
│  第 1 步：创建在线对局                                        │
│  ┌─────────────┐              ┌─────────────┐               │
│  │  Host 浏览器 │◄────────────►│ Guest 浏览器 │               │
│  └─────────────┘              └─────────────┘               │
│         │                            │                       │
│         └────────────┬───────────────┘                       │
│                      ▼                                       │
│              ┌──────────────┐                                │
│              │  游戏服务器   │                                │
│              └──────────────┘                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  第 2 步：选择角色                                            │
│  Host: 选择武僧 🥋    Guest: 选择武僧 🥋                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  第 3 步：注入测试状态                                        │
│  ┌──────────────────────────────────────────┐               │
│  │  window.__BG_TEST_HARNESS__              │               │
│  │  ├─ state.patch({ tokens: { taiji: 2 }}) │  添加太极标记  │
│  │  └─ dice.setValues([3,3,3,1,1])          │  控制骰子结果  │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  第 4 步：执行用户操作                                        │
│                                                              │
│  🎲 点击掷骰按钮                                              │
│     ↓                                                        │
│  ⏱️  等待动画（2.5秒）                                        │
│     ↓                                                        │
│  ✅ 点击确认按钮                                              │
│     ↓                                                        │
│  ⚡ 点击"雷霆万钧"技能按钮                                     │
│     ↓                                                        │
│  ➡️  推进到防御阶段                                           │
│     ↓                                                        │
│  🎲 Guest 掷骰 + 确认                                         │
│     ↓                                                        │
│  ⏭️  推进到攻击结算                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  第 5 步：验证结果                                            │
│                                                              │
│  📸 截图验证：页面显示"重掷"相关文本                           │
│  📊 状态验证：                                                │
│     ✅ pendingBonusDiceSettlement 存在                        │
│     ✅ 奖励骰数量 = 3                                         │
│     ✅ 重掷消耗 = 2 个太极标记                                 │
└─────────────────────────────────────────────────────────────┘

---

## 📸 关键截图时刻

### 时刻 1：掷骰后（3 个掌面）

```
┌──────────────────────────────────────┐
│  🎲 骰子结果                          │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐     │
│  │ 掌 │ │ 掌 │ │ 掌 │ │ 拳 │ │ 拳 │     │
│  └───┘ └───┘ └───┘ └───┘ └───┘     │
│                                      │
│  [确认] 按钮                          │
└──────────────────────────────────────┘
```

### 时刻 2：技能激活

```
┌──────────────────────────────────────┐
│  ⚡ 可用技能                          │
│  ┌────────────────────────────┐     │
│  │  雷霆万钧                    │     │
│  │  需要：3 个掌面              │     │
│  │  效果：投掷 3 个奖励骰       │     │
│  └────────────────────────────┘     │
│                                      │
│  [激活] 按钮                          │
└──────────────────────────────────────┘
```

### 时刻 3：重掷交互（有太极标记）

```
┌──────────────────────────────────────┐
│  🎲 奖励骰结果                        │
│  ┌───┐ ┌───┐ ┌───┐                  │
│  │ 4 │ │ 2 │ │ 6 │                  │
│  └───┘ └───┘ └───┘                  │
│                                      │
│  💎 消耗 2 个太极标记可重掷           │
│                                      │
│  [重掷] [跳过]                        │
└──────────────────────────────────────┘
```

---

## 🔧 核心代码片段

### 1. 创建对局（使用 Fixture）

```typescript
const setup = await setupDTOnlineMatch(browser, baseURL);
const { hostPage, guestPage, matchId } = setup;
```

### 2. 注入测试状态

```typescript
// 添加太极标记
await hostPage.evaluate(() => {
  window.__BG_TEST_HARNESS__!.state.patch({
    core: {
      players: {
        '0': { tokens: { taiji: 2 } }
      }
    }
  });
});

// 控制骰子结果
await hostPage.evaluate(() => {
  window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
});
```

### 3. 执行用户操作

```typescript
// 掷骰
const rollButton = hostPage.locator('[data-tutorial-id="dice-roll-button"]');
await rollButton.click();
await hostPage.waitForTimeout(2500);

// 确认
const confirmButton = hostPage.locator('button').filter({ hasText: /确认|Confirm/i });
await confirmButton.click();

// 激活技能
const thunderStrikeButton = hostPage.locator('button').filter({ hasText: /雷霆万钧/i });
await thunderStrikeButton.click();
```

### 4. 验证结果

```typescript
// UI 验证
const pageText = await hostPage.textContent('body');
expect(pageText?.includes('重掷')).toBeTruthy();

// 状态验证
const finalState = await hostPage.evaluate(() => {
  return window.__BG_TEST_HARNESS__!.state.get();
});
expect(finalState.core.pendingBonusDiceSettlement?.dice).toHaveLength(3);
```

---

## 🎯 测试覆盖点

| 验证项 | 类型 | 说明 |
|--------|------|------|
| ✅ 房间创建 | 集成 | Host + Guest 成功连接 |
| ✅ 角色选择 | UI | 武僧角色选择成功 |
| ✅ 骰子注入 | 工具 | TestHarness 控制随机性 |
| ✅ 技能触发 | 逻辑 | 3 个掌面触发雷霆万钧 |
| ✅ 奖励骰投掷 | 逻辑 | 投掷 3 个奖励骰 |
| ✅ 重掷交互 | UI | 显示重掷选项（有太极标记） |
| ✅ 状态同步 | 网络 | Host 和 Guest 状态一致 |

---

## 🚀 运行测试

### 方式 1：开发模式（推荐）

```bash
# 终端 1：启动所有服务
npm run dev

# 终端 2：运行测试（带 UI）
npm run test:e2e -- dicethrone-thunder-strike --headed
```

说明：
- 默认 `npm run test:e2e` 会强制无头运行。
- 只有这里显式追加 `--headed` 时，才应该弹出可见浏览器用于调试。

### 方式 2：CI 模式

```bash
# 自动启动服务 + 运行测试
npm run test:e2e:ci -- dicethrone-thunder-strike
```

### 查看测试报告

```bash
# 生成 HTML 报告
npx playwright show-report

# 查看截图和视频
# 位置：test-results/dicethrone-thunder-strike/
```

---

## 📊 测试输出示例

```
Running 1 test using 1 worker

[Test] 对局创建成功: match-abc123
[Test] 角色选择完成
[Test] 游戏开始
[Test] 游戏棋盘已加载
[Test] 测试工具已就绪
[Test] 已设置玩家0有2个太极标记
[Test] 已注入骰子值: [3,3,3,1,1]（3个掌面）
[Test] 已点击掷骰按钮
[Test] 已确认掷骰
[Test] 骰子值: [3, 3, 3, 1, 1]
[Test] ✅ 骰子验证通过：有 3 个掌面
[Test] 已点击雷霆万钧技能
[Test] 已推进到防御阶段
[Test] Guest 已确认掷骰
[Test] Guest 已跳过防御技能
[Test] 已推进到攻击结算
[Test] 页面是否显示重掷文本: true
[Test] ✅ 测试通过：奖励骰投掷和重掷交互正确显示

  ✓ dicethrone-thunder-strike.e2e.ts:15:5 › 应该正确显示奖励骰投掷和重掷交互（有太极标记） (45s)

  1 passed (45s)
```

---

## 💡 测试设计亮点

### 1. 使用 TestHarness 控制随机性

```typescript
// ❌ 不稳定：依赖真随机
await rollButton.click();
// 可能投出任意结果，测试不稳定

// ✅ 稳定：注入固定值
window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
await rollButton.click();
// 保证每次都是 3 个掌面
```

### 2. 使用 Fixture 简化房间创建

```typescript
// ❌ 繁琐：手动创建房间
const hostPage = await browser.newPage();
await hostPage.goto('/lobby');
await hostPage.click('button:has-text("创建房间")');
// ... 20+ 行代码

// ✅ 简洁：使用 Fixture
const { hostPage, guestPage } = await setupDTOnlineMatch(browser, baseURL);
// 1 行搞定
```

### 3. 双重验证（UI + 状态）

```typescript
// UI 验证：用户看到的
const pageText = await hostPage.textContent('body');
expect(pageText?.includes('重掷')).toBeTruthy();

// 状态验证：底层数据
const state = await hostPage.evaluate(() => {
  return window.__BG_TEST_HARNESS__!.state.get();
});
expect(state.core.pendingBonusDiceSettlement).toBeDefined();
```

---

## 🐛 常见问题

### Q1: 测试超时

**原因**：服务未启动或端口占用

**解决**：
```bash
# 检查服务状态
npm run test:e2e:cleanup

# 重新启动
npm run dev
```

### Q2: 截图不清晰

**原因**：默认分辨率较低

**解决**：
```typescript
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 }  // 提高分辨率
});
```

### Q3: 找不到元素

**原因**：动画未完成或元素未渲染

**解决**：
```typescript
// 增加超时时间
await expect(button).toBeVisible({ timeout: 10000 });

// 等待状态变化
await hostPage.waitForTimeout(1000);
```

---

## 📚 相关文档

- [自动化测试指南](../automated-testing.md)
- [E2E Fixture 迁移指南](../e2e-fixture-migration-guide.md)
- [测试工具快速参考](../testing-tools-quick-reference.md)
- [TestHarness 使用文档](../testing-infrastructure.md)
