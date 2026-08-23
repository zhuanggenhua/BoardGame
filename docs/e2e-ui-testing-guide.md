# E2E UI 交互测试指南（旧入口）

本文是旧 UI E2E 指南的兼容入口。当前真实 E2E 规则以 [`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md) 为准；测试命令和 helper 以 [`automated-testing`](automated-testing.md) 为准。

## 保留结论

- 真实 UI E2E 只能通过用户可执行的页面交互推进。
- `page.evaluate(...)` 只能做只读采样、辅助断言或调试；写状态后不再是纯真实 E2E。
- 依赖 fixture、状态注入或 TestHarness 的用例应登记为场景注入测试，用于边界局面、回归定位或代表态合同。
- 真实 E2E 只证明入口可达、控件可操作、可见结果成立和关键同步正常；规则正确性应由更低层测试补足。
- 一个 E2E 用例只承担一个关键交互面或流程片段；完整流程默认拆成入口、开局、中段、近终局和复盘等组合证据。

## 当前入口

- E2E 总指南：[`e2e-testing-guide`](e2e-testing-guide.md)。
- 状态注入：[`e2e-state-injection-guide`](e2e-state-injection-guide.md)。
- 截图证据：[`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md)。
