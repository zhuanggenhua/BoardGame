# SmashUp 复杂多基地计分 E2E 测试 - 超时问题调查

## 问题描述
测试运行时出现 "No tests found" 错误，Playwright 无法找到测试文件。

## 调查过程

### 1. 测试文件检查
- 文件路径：`e2e/smashup-complex-multi-base-scoring.e2e.ts`
- 导入语句：`import { test, expect } from './framework';` ✅ 正确
- 文件名后缀：`.e2e.ts` ✅ 符合 Playwright 配置

### 2. Playwright 配置检查
- `playwright.config.ts` 中有 `collectFrameworkBackedTests` 函数
- 该函数会扫描所有 `.e2e.ts` 文件，检查是否导入了框架
- 测试文件应该被正确收集

### 3. 根本原因分析
问题不是测试文件找不到，而是 Playwright 在启动服务器时遇到问题。从输出可以看到：
- Vite 服务器正在启动（大量 `vite:config` 日志）
- 但最终报告 "No tests found"
- 这表明 Playwright 在等待服务器就绪时超时了

### 4. TestHarness 初始化流程
根据代码分析，TestHarness 的初始化流程如下：
1. `App.tsx` 中调用 `TestHarness.init()`
2. `TestHarness.init()` 检查 `window.__E2E_TEST_MODE__`
3. 如果为 `true`，则挂载 TestHarness 到 `window.__BG_TEST_HARNESS__`
4. `GameProvider` 在 `useEffect` 中注册状态访问器和命令分发器

### 5. 问题定位
测试代码中等待 TestHarness 注册：
```typescript
await page.waitForFunction(
    () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
    { timeout: 30000 }
);
```

这个等待可能超时的原因：
1. `window.__E2E_TEST_MODE__` 未正确设置
2. GameProvider 未正确挂载
3. 状态访问器未正确注册

## 下一步行动
1. 检查 fixtures 中 `__E2E_TEST_MODE__` 的注入是否正确
2. 检查 GameProvider 的挂载时机
3. 添加更详细的日志来追踪 TestHarness 初始化过程
4. 考虑增加等待时间或添加重试逻辑
