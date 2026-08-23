# 测试写法补充（旧最佳实践入口）

本文只保留旧链接兼容和少量写法提醒。测试规则正文以 [`testing-tdd`](../.spec/knowledge/standards/testing-tdd.md)、[`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md) 和 [`automated-testing`](automated-testing.md) 为准。

## 保留结论

- 测试保护公开行为，不默认保护内部字段、handler 调用顺序或临时 UI 文案。
- 游戏规则和命令行为优先走 GameTestRunner、`runCommand` 或游戏专用 helper；UI 交互只用 E2E 证明真实入口和可见结果。
- 交互测试优先通过游戏专用 prompt facade 读候选、响应和断言；除非目标就是底层系统合同，不直接摸 `sys.interaction.current`、handler registry 或 runtime prompt handler。
- 新增测试文件要按行为簇命名；不要继续扩写 `new*`、`misc`、`regression`、`feedback`、`fixes` 这类泛名文件。
- 新增或迁出的游戏行为测试不得带 `it.skip` / `test.skip` / `describe.skip`；无法跑通的旧用例保留为历史债务并说明原因。
- 为了测试方便，优先复用正式入口、测试模式、状态注入或项目已有调试入口；不要默认新增用户可见产品入口。

## 当前入口

- 命令、runner、fixture、截图产物目录：[`automated-testing`](automated-testing.md)。
- TestHarness API：[`testing-tools-quick-reference`](testing-tools-quick-reference.md)。
- 测试结构门禁：`npm run test:structure`。

旧版长清单、案例堆叠和重复 E2E 规则已删除；需要新增规则时回 `.spec` 主源。
