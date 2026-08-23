# E2E 测试指南

本文只保留 E2E 运行模式和入口索引。真实链路、状态注入边界、截图证据和黄金链命名以 [`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md) 为准；命令和 API 细节以 [`automated-testing`](automated-testing.md) 为准。

## 分类

| 类型 | 推进方式 | 能证明什么 |
| --- | --- | --- |
| 真实 E2E | 点击、输入、键盘、hover、页面控件、合法系统结算 | 玩家是否真的能通过 UI 完成该链路 |
| 场景注入 / harness test | TestHarness、fixture、服务端测试注入、代表态 | 指定局部合同、边界状态或回归位点 |

真实 E2E 中 `page.evaluate(...)` 只能做只读采样、辅助断言和调试；一旦写入核心状态，就必须按场景注入测试登记。

## 端口

| 环境 | 前端 | 游戏服务器 | API 服务器 | 入口 |
| --- | --- | --- | --- | --- |
| 开发环境 | 由 `.env` / dev runtime 决定，常见为 4273 | 18000 | 18001 | `npm run dev` |
| 默认 E2E | 6174 | 20000 | 21000 | `npm run test:e2e -- e2e/<file>.e2e.ts` |
| 并行 worker | 6273+ | 20100+ | 21100+ | `npm run test:e2e:parallel` |

默认不要清理所有 Node 进程；只清理目标测试端口或使用项目提供的 E2E cleanup 脚本。

## 常用入口

- E2E 命令、GameTestContext、截图目录：[`automated-testing`](automated-testing.md)。
- TestHarness API：[`testing-tools-quick-reference`](testing-tools-quick-reference.md)。
- 状态注入细节：[`e2e-state-injection-guide`](e2e-state-injection-guide.md)。
- 并行测试：[`e2e-parallel-quickstart`](e2e-parallel-quickstart.md)。
- 安全边界：[`e2e-safety-guide`](e2e-safety-guide.md)。
