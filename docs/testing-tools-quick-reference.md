# 测试工具快速参考

> 快速查找测试工具的常用 API 和使用方法

## 🚀 快速开始

### 1. 启用测试模式

测试模式会在 `initContext()` 中自动启用，无需手动操作。

默认也会把语言固定到 `zh-CN`，并保留真实图片加载链路。
如果某条用例必须验证英文文案，再显式调用 `setEnglishLocale()`。

### 2. 等待测试工具就绪

```typescript
import { waitForTestHarness } from './helpers/common';

await waitForTestHarness(page);
```

### 3. 使用测试工具

```typescript
await page.evaluate(() => {
    // 所有测试工具都在这里
    window.__BG_TEST_HARNESS__
});
```

## 📚 API 参考

### 随机数控制

```typescript
// 设置随机数队列（替换现有队列）
window.__BG_TEST_HARNESS__.random.setQueue([0.1, 0.5, 0.9]);

// 添加随机数到队列末尾
window.__BG_TEST_HARNESS__.random.enqueue(0.2, 0.7);

// 清空队列
window.__BG_TEST_HARNESS__.random.clear();

// 检查状态
window.__BG_TEST_HARNESS__.random.queueLength();    // 剩余数量
window.__BG_TEST_HARNESS__.random.consumedLength(); // 已消费数量
window.__BG_TEST_HARNESS__.random.hasQueue();       // 是否有队列
window.__BG_TEST_HARNESS__.random.isEnabled();      // 是否启用
```

### 骰子注入

```typescript
// 设置骰子值（1-6）
window.__BG_TEST_HARNESS__.dice.setValues([3, 3, 3, 1, 1]);

// 添加骰子值到队列末尾
window.__BG_TEST_HARNESS__.dice.enqueue(6, 6);

// 清空队列
window.__BG_TEST_HARNESS__.dice.clear();

// 检查状态
window.__BG_TEST_HARNESS__.dice.remaining();  // 剩余骰子数
window.__BG_TEST_HARNESS__.dice.getValues();  // 已设置的骰子值
```

### 状态注入

```typescript
// 获取当前状态
const state = window.__BG_TEST_HARNESS__.state.get();

// 设置状态（完全替换）
state.core.players['0'].resources.hp = 10;
window.__BG_TEST_HARNESS__.state.set(state);

// 部分更新（深度合并）
window.__BG_TEST_HARNESS__.state.patch({
    core: {
        players: {
            '0': { resources: { hp: 10 } }
        }
    }
});

// 检查状态
window.__BG_TEST_HARNESS__.state.isRegistered(); // 是否已注册
```

### 命令分发

```typescript
// 分发命令
await window.__BG_TEST_HARNESS__.command.dispatch({
    type: 'ADVANCE_PHASE',
    playerId: '0',
    payload: {}
});

// 检查状态
window.__BG_TEST_HARNESS__.command.isRegistered(); // 是否已注册
```

### 工具管理

```typescript
// 获取所有工具状态
const status = window.__BG_TEST_HARNESS__.getStatus();
console.log(status);
// {
//     random: { enabled: true, queueLength: 5, consumed: 3 },
//     dice: { remaining: 5, values: [3,3,3,1,1] },
//     state: { registered: true },
//     command: { registered: true }
// }

// 重置所有工具
window.__BG_TEST_HARNESS__.reset();
```

## 💡 常用模式

### 模式 1：控制骰子投掷

```typescript
// 1. 等待测试工具就绪
await waitForTestHarness(page);

// 2. 注入骰子值
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
});

// 3. 执行掷骰操作
await page.click('[data-tutorial-id="dice-roll-button"]');
await page.waitForTimeout(2500);
await page.click('button:has-text("确认")');

// 4. 验证结果
const state = await page.evaluate(() => {
    return window.__BG_TEST_HARNESS__!.state.get();
});
expect(state.core.dice.map(d => d.value)).toEqual([3, 3, 3, 1, 1]);
```

### 模式 2：修改玩家状态

```typescript
// 1. 等待测试工具就绪
await waitForTestHarness(page);

// 2. 修改状态
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({
        core: {
            players: {
                '0': {
                    resources: { hp: 10, cp: 5 },
                    tokens: { taiji: 2 }
                }
            }
        }
    });
});

// 3. 验证状态
const state = await page.evaluate(() => {
    return window.__BG_TEST_HARNESS__!.state.get();
});
expect(state.core.players['0'].resources.hp).toBe(10);
```

### 模式 3：直接执行命令

```typescript
// 1. 等待测试工具就绪
await waitForTestHarness(page);

// 2. 分发命令
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.command.dispatch({
        type: 'ADVANCE_PHASE',
        playerId: '0',
        payload: {}
    });
});

// 3. 等待命令执行
await page.waitForTimeout(1000);

// 4. 验证结果
const state = await page.evaluate(() => {
    return window.__BG_TEST_HARNESS__!.state.get();
});
expect(state.sys.phase).toBe('offensiveRoll');
```

### 模式 4：调试测试

```typescript
// 检查测试工具状态
const status = await page.evaluate(() => {
    return window.__BG_TEST_HARNESS__!.getStatus();
});
console.log('测试工具状态:', status);

// 检查是否在测试环境
const isTest = await page.evaluate(() => {
    return !!(window as any).__E2E_TEST_MODE__;
});
console.log('测试环境:', isTest);

// 检查测试工具是否就绪
const isReady = await page.evaluate(() => {
    return !!(window as any).__BG_TEST_HARNESS__;
});
console.log('测试工具就绪:', isReady);
```

## 🎯 最佳实践

### 1. 总是等待测试工具就绪

```typescript
// ✅ 正确
await waitForTestHarness(page);
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3]);
});

// ❌ 错误（可能测试工具还未初始化）
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3]);
});
```

### 2. 使用类型断言

```typescript
// ✅ 正确（使用 ! 断言非空）
window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3]);

// ❌ 错误（TypeScript 会报错）
window.__BG_TEST_HARNESS__.dice.setValues([3, 3, 3]);
```

### 3. 在测试结束时清理

```typescript
test('我的测试', async ({ page }) => {
    // ... 测试代码 ...

    // 清理测试工具
    await page.evaluate(() => {
        window.__BG_TEST_HARNESS__!.reset();
    });
});
```

### 4. 使用有意义的骰子值

```typescript
// ✅ 正确（注释说明骰子含义）
await page.evaluate(() => {
    // 武僧骰子：3=掌面，1=拳头
    window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
});

// ❌ 错误（没有说明）
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
});
```

### 5. 验证状态变更

```typescript
// ✅ 正确（验证状态确实改变了）
const before = await page.evaluate(() => {
    return window.__BG_TEST_HARNESS__!.state.get().core.players['0'].resources.hp;
});

await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({
        core: { players: { '0': { resources: { hp: 10 } } } }
    });
});

const after = await page.evaluate(() => {
    return window.__BG_TEST_HARNESS__!.state.get().core.players['0'].resources.hp;
});

expect(after).toBe(10);
expect(after).not.toBe(before);

// ❌ 错误（没有验证）
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({
        core: { players: { '0': { resources: { hp: 10 } } } }
    });
});
```

## ⚠️ 常见陷阱

### 1. 忘记等待测试工具就绪

```typescript
// ❌ 错误
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3]);
});
// 可能报错：Cannot read property 'dice' of undefined

// ✅ 正确
await waitForTestHarness(page);
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3]);
});
```

### 2. 骰子值超出范围

```typescript
// ❌ 错误（骰子值必须是 1-6）
window.__BG_TEST_HARNESS__!.dice.setValues([0, 7, 10]);

// ✅ 正确
window.__BG_TEST_HARNESS__!.dice.setValues([1, 6, 3]);
```

### 3. 状态注入后没有等待

```typescript
// ❌ 错误（状态可能还没更新）
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({ ... });
});
await page.click('button'); // 可能使用旧状态

// ✅ 正确
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({ ... });
});
await page.waitForTimeout(500); // 等待 React 重新渲染
await page.click('button');
```

### 4. 在生产环境使用

```typescript
// ❌ 错误（生产环境没有测试工具）
if (window.__BG_TEST_HARNESS__) {
    window.__BG_TEST_HARNESS__.dice.setValues([3, 3, 3]);
}

// ✅ 正确（只在测试环境使用）
// 测试工具只在 E2E 测试中可用，不要在生产代码中使用
```

## 📖 更多资源

- [完整设计文档](./testing-infrastructure.md)
- [示例测试](../e2e/dicethrone/example-test-harness-usage.e2e.ts)
- [自动化测试指南](./automated-testing.md)

## 🆘 故障排除

### 问题：测试工具未定义

```typescript
// 错误：Cannot read property 'dice' of undefined
```

**解决方案**：
1. 确保调用了 `waitForTestHarness(page)`
2. 确保 `initContext()` 被调用（自动启用测试模式）
3. 检查浏览器控制台是否有错误

### 问题：骰子注入不生效

```typescript
// 设置了骰子值，但实际投掷结果不同
```

**解决方案**：
1. 确保在掷骰之前注入骰子值
2. 检查骰子值是否在 1-6 范围内
3. 检查是否有足够的骰子值（队列不能为空）
4. 查看控制台日志确认注入成功

### 问题：状态注入后 UI 没有更新

```typescript
// 修改了状态，但 UI 没有变化
```

**解决方案**：
1. 在状态注入后等待一段时间（`await page.waitForTimeout(500)`）
2. 确保修改的是正确的状态路径
3. 检查是否有其他代码覆盖了状态
4. 使用 `state.patch()` 而不是直接修改对象

## 🎓 学习路径

1. **阅读设计文档**：了解架构和原理
2. **运行示例测试**：看看测试工具如何工作
3. **修改示例测试**：尝试不同的骰子值和状态
4. **编写自己的测试**：应用到实际测试场景
5. **查阅 API 参考**：需要时快速查找

---

**提示**：将此文档加入书签，方便随时查阅！
