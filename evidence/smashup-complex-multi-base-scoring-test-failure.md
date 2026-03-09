# 大杀四方 - 复杂多基地计分测试失败分析

## 测试文件
`e2e/smashup-complex-multi-base-scoring.e2e.ts`

## 失败原因

### 1. 框架迁移不完整
测试文件使用了旧的测试模式，直接访问 `window.__BG_TEST_HARNESS__`，而不是使用新的 `game` fixture 提供的方法。

**问题代码示例**：
```typescript
const state = await page.evaluate(() => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness.state.get();
    return {
        phase: state.sys.phase,
        responseWindow: state.sys.responseWindow,
        // ...
    };
});
```

**正确做法**：
```typescript
const state = await game.getState();
const stateInfo = {
    phase: state.sys.phase,
    responseWindow: state.sys.responseWindow,
    // ...
};
```

### 2. 直接访问 TestHarness 的位置

测试文件中有多处直接访问 `__BG_TEST_HARNESS__`：

1. **Line 34**: 等待游戏加载
2. **Line 87**: 验证初始状态
3. **Line 153**: 注入 P1 RESPONSE_PASS 命令
4. **Line 166**: 检查自动推进前状态（已修复）
5. **Line 189**: 检查自动推进后状态
6. **Line 212**: 检查当前交互
7. **Line 241**: 解决交互
8. **Line 291**: 验证最终状态

### 3. Vite 服务器崩溃
测试运行过程中，Vite 服务器因内存不足崩溃：
```
[WebServer] [2026-03-09T14:51:06.765Z] [EXIT] Vite 进程退出
[WebServer] [2026-03-09T14:51:06.772Z] [EXIT] 异常退出！退出码: 1
[WebServer] [2026-03-09T14:51:06.774Z] [EXIT] 可能的原因:
[WebServer] [2026-03-09T14:51:06.775Z] [EXIT] - 内存不足 (OOM)
```

这可能是因为测试陷入无限循环，不断轮询状态导致内存泄漏。

### 4. 测试陷入循环
测试在等待响应窗口关闭时陷入循环：
```
[TEST] 状态 1: { "type": "responseWindow", ... }
[TEST] 处理响应窗口
[TEST] 状态 2: { "type": "responseWindow", ... }
[TEST] 处理响应窗口
...
[TEST] 状态 14: { "type": "responseWindow", ... }
[TEST] 处理响应窗口
```

响应窗口一直没有关闭，导致测试超时。

## 修复方案

### 方案 1：完全重写测试（推荐）
使用新的 E2E 测试框架和 `game` fixture 重写整个测试：

1. 使用 `game.getState()` 替代直接访问 `__BG_TEST_HARNESS__`
2. 使用 `game.setupScene()` 构建测试场景
3. 使用 `game.screenshot()` 保存截图
4. 简化测试逻辑，避免复杂的轮询循环

### 方案 2：逐步迁移（临时方案）
保留测试逻辑，但将所有直接访问 `__BG_TEST_HARNESS__` 的地方改为使用 `game` fixture：

1. 将 `page.evaluate(() => { const harness = ...; const state = harness.state.get(); ... })` 改为 `const state = await game.getState(); ...`
2. 将 `harness.command.dispatch(...)` 改为使用 `game` fixture 提供的命令分发方法（如果有）
3. 简化轮询逻辑，使用 `page.waitForFunction()` 等待特定条件

## 下一步工作

1. **优先级 1**：修复 `e2e/framework/fixtures.ts` 中的 ESLint 错误（已完成）
2. **优先级 2**：决定使用方案 1 还是方案 2
3. **优先级 3**：重写或迁移测试
4. **优先级 4**：运行测试并验证通过
5. **优先级 5**：创建证据文档，包含测试截图和分析

## 相关文件

- `e2e/smashup-complex-multi-base-scoring.e2e.ts` - 测试文件
- `e2e/framework/fixtures.ts` - 测试框架 fixtures（已修复 ESLint 错误）
- `e2e/framework/GameTestContext.ts` - 游戏测试上下文（提供 `getState()` 等方法）
- `docs/automated-testing.md` - E2E 测试文档

## 教训

1. **框架迁移必须完整**：迁移到新框架时，必须同时更新所有测试文件，不能留下使用旧 API 的测试
2. **避免复杂的轮询逻辑**：使用 `page.waitForFunction()` 等 Playwright 提供的等待方法，而不是手动轮询
3. **测试必须有超时保护**：避免无限循环导致测试挂起和内存泄漏
4. **使用 fixture 提供的方法**：不要直接访问全局变量（如 `__BG_TEST_HARNESS__`），使用 fixture 提供的封装方法
