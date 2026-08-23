# TestHarness 迁移指南（历史入口）

本文是旧 E2E 测试迁移说明的兼容入口。当前 TestHarness API 以 [`testing-tools-quick-reference`](testing-tools-quick-reference.md) 为准；测试运行方式以 [`automated-testing`](automated-testing.md) 为准；状态注入与真实链路资格以 [`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md) 为准。

## 仍然有效的迁移判断

- 依赖随机骰子、随机抽牌或条件 `test.skip()` 的 E2E，应优先改成可控骰子 / 随机数队列或更低层行为测试。
- 通过调试面板或 UI 手工绕路构造场景的测试，应优先改成 TestHarness、服务端测试注入或 GameTestRunner 的最窄合同。
- 状态注入只能证明代表态合同；不能把它登记为主黄金链或连续真实玩家链。
- 迁移时必须补断言证明注入后的状态或 UI 已实际生效，不能只调用 `state.patch()` / `dice.setValues()` 后默认成功。

## 当前入口

- TestHarness API：[`testing-tools-quick-reference`](testing-tools-quick-reference.md)。
- E2E 状态注入：[`e2e-state-injection-guide`](e2e-state-injection-guide.md)。
- 示例 E2E：[`demo/e2e-test-example`](demo/e2e-test-example.md)。

旧版长示例、学习路径和故障排除已删除，避免与当前 API 快查重复。
