# TestHarness 快速参考

本文只记录 E2E 测试工具 API。测试分层、黄金链、截图证据和状态注入资格以 [`.spec` 测试标准](../.spec/knowledge/standards/e2e-verification.md) 为准。

## 前置

```ts
import { waitForTestHarness } from './helpers/common';

await waitForTestHarness(page);
```

`initContext()` 会启用测试模式、固定默认语言为 `zh-CN`，并保留真实图片加载链路。需要英文文案时再显式调用 `setEnglishLocale()`。

## API

### 随机数

```ts
window.__BG_TEST_HARNESS__!.random.setQueue([0.1, 0.5]);
window.__BG_TEST_HARNESS__!.random.enqueue(0.9);
window.__BG_TEST_HARNESS__!.random.clear();
window.__BG_TEST_HARNESS__!.random.queueLength();
window.__BG_TEST_HARNESS__!.random.consumedLength();
window.__BG_TEST_HARNESS__!.random.hasQueue();
window.__BG_TEST_HARNESS__!.random.isEnabled();
```

### 骰子

```ts
window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
window.__BG_TEST_HARNESS__!.dice.enqueue(6, 6);
window.__BG_TEST_HARNESS__!.dice.clear();
window.__BG_TEST_HARNESS__!.dice.remaining();
window.__BG_TEST_HARNESS__!.dice.getValues();
```

骰子值必须在 `1-6` 范围内；注入必须发生在掷骰动作之前。

### 状态

```ts
const state = window.__BG_TEST_HARNESS__!.state.get();

window.__BG_TEST_HARNESS__!.state.set(state);
window.__BG_TEST_HARNESS__!.state.patch({
  core: { players: { '0': { resources: { hp: 10 } } } },
});
window.__BG_TEST_HARNESS__!.state.isRegistered();
```

状态注入后要等待目标 UI 或状态条件真正生效；优先用项目 wait helper，不用固定等待冒充同步完成。

### 命令

```ts
await window.__BG_TEST_HARNESS__!.command.dispatch({
  type: 'ADVANCE_PHASE',
  playerId: '0',
  payload: {},
});
window.__BG_TEST_HARNESS__!.command.isRegistered();
```

### 工具状态

```ts
const status = window.__BG_TEST_HARNESS__!.getStatus();
window.__BG_TEST_HARNESS__!.reset();
```

## 使用边界

- 先 `waitForTestHarness(page)`，再访问 `window.__BG_TEST_HARNESS__`。
- 每次注入后验证状态确实改变；不要只写入、不断言。
- 测试结束前按需 `reset()`，避免随机数、骰子或状态污染后续用例。
- TestHarness 只在测试环境可用，生产代码不能依赖它。
- 状态注入、fixture 和代表态只证明对应合同；不能登记为主黄金链的连续真实玩家动作。

## 相关文档

- 测试运行入口：[`automated-testing`](automated-testing.md)。
- 状态注入说明：[`e2e-state-injection-guide`](e2e-state-injection-guide.md)。
- 示例 E2E：[`demo/e2e-test-example`](demo/e2e-test-example.md)。
