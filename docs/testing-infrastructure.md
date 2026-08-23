# 测试基础设施索引

本文只记录 TestHarness 和测试基础设施的当前入口。旧设计草案、阶段计划和未完成清单不再作为执行依据。

## 当前对象

- 全局测试工具：`window.__BG_TEST_HARNESS__`。
- E2E 测试环境标记：`window.__E2E_TEST_MODE__`。
- helper 入口：`e2e/helpers/common.ts`、`e2e/helpers/state-injection.ts`。
- API 快查：[`testing-tools-quick-reference`](testing-tools-quick-reference.md)。

## 能力范围

| 能力 | 用途 |
| --- | --- |
| 随机数控制 | 固定抽牌、洗牌或其他随机路径 |
| 骰子注入 | 固定掷骰结果 |
| 状态读取 / 注入 | 构造代表态或断言当前状态 |
| 命令分发 | 走测试入口派发领域命令 |
| reset / status | 清理测试工具状态、排查工具是否就绪 |

## 边界

- TestHarness 只在测试环境启用，生产代码不能依赖。
- 状态注入和命令分发是测试工具能力，不等于玩家真实链路。
- 新增测试基础设施前先确认现有 helper 是否能承接；不要为单个用例新增第二套测试真相。

运行命令、端口、截图产物和测试分层见 [`automated-testing`](automated-testing.md)。
