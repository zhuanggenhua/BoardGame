# E2E Fixture 迁移指南（旧入口）

本文是旧 Playwright fixture 迁移说明的兼容入口。当前 E2E 运行、fixture、GameTestContext 和截图目录以 [`automated-testing`](automated-testing.md) 为准。

## 保留结论

- 迁移 fixture 的目标是减少重复 setup / teardown，不是新增第二套测试入口。
- fixture 可以管理浏览器上下文、房间创建、清理和常用 helper；业务断言仍应写在用例里。
- 清理必须由 fixture 或 `finally` 保证，不得让页面、context、WebSocket 或端口泄漏。
- 使用 fixture 后仍要明确测试类型：真实 E2E 不能因为用了 fixture 就写状态；场景注入测试不能伪装成真实 E2E。

## 当前入口

- E2E 总指南：[`e2e-testing-guide`](e2e-testing-guide.md)。
- 场景注入：[`e2e-state-injection-guide`](e2e-state-injection-guide.md)。
- TestHarness API：[`testing-tools-quick-reference`](testing-tools-quick-reference.md)。
