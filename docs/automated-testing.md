# 自动化测试入口

本文只记录测试命令、工具入口、端口和产物目录。测试分层、TDD、真实 E2E、截图证据和黄金链命名以 [`.spec/knowledge/README.md`](../.spec/knowledge/README.md) 路由的项目标准为准。

## 快速命令

| 目标 | 命令 |
| --- | --- |
| 变更相关测试 | `npm run test:changed` |
| 全量单元 / 集成 | `npm test` |
| 核心测试 | `npm run test:core` |
| 游戏测试 | `npm run test:games` |
| 游戏核心测试 | `npm run test:games:core` |
| API 测试 | `npm run test:api` |
| 指定 E2E | `npm run test:e2e -- e2e/<file>.e2e.ts` |
| AI / Windows 定向 E2E | `node scripts/infra/run-e2e-command.mjs default e2e/<gameId>/<file>.e2e.ts` |
| 单文件 E2E runtime | `node scripts/infra/run-e2e-single.mjs e2e/<gameId>/<file>.e2e.ts` |

游戏专用脚本以 `package.json` 为准；本文不维护单游戏脚本清单。

## 选择验证层

| 目标 | 默认验证 |
| --- | --- |
| 规则、结算、状态机、AI | Vitest / GameTestRunner / 最窄集成测试 |
| 真实 UI 入口、联机同步、截图证据 | Playwright E2E |
| TestHarness、状态注入、骰子 / 随机数 | 场景注入测试；不登记为真实黄金链 |
| API / 持久化 | `npm run test:api` 或对应 API 测试 |
| 文档、skill、knowledge | `npm run spec:lint` |

新增阻断测试、是否需要 RED、场景注入是否可外推，回到 [`testing-tdd`](../.spec/knowledge/standards/testing-tdd.md) 和 [`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md) 判断。

## 目录

| 目录 | 用途 |
| --- | --- |
| `src/games/<gameId>/__tests__/` | 游戏规则、领域、组件和配置合同 |
| `src/engine/**/__tests__/` | 引擎原语和共享系统 |
| `e2e/<gameId>/` | 游戏真实入口或场景注入 E2E |
| `e2e/_shared/` | 跨游戏 E2E |
| `apps/api/test/` | API / 服务端集成测试 |

新增游戏 E2E 放在 `e2e/<gameId>/`；根级 `e2e/*.e2e.ts` 只保留跨游戏或历史债务。

## E2E 端口

端口真值来自 [`e2e-port-config.js`](../scripts/infra/e2e-port-config.js)。

| 模式 | 前端 | 游戏服务器 | API 服务器 |
| --- | --- | --- | --- |
| 默认 E2E | 6174 | 20000 | 21000 |
| 多 worker 0 | 6273 | 20100 | 21100 |
| 多 worker N | `6273 + N*100` | `20100 + N*100` | `21100 + N*100` |
| 开发环境 | 由 `.env` / dev runtime 决定，常见为 4273 | 18000 | 18001 |

需要连接开发服务器时才显式使用 `PW_USE_DEV_SERVERS=true`。并行模式见 [`e2e-parallel-quickstart`](e2e-parallel-quickstart.md)。

## 工具入口

| 工具 | 入口 |
| --- | --- |
| GameTestContext / fixture | `e2e/framework/` |
| TestHarness API | [`testing-tools-quick-reference`](testing-tools-quick-reference.md) |
| 场景注入边界 | [`e2e-state-injection-guide`](e2e-state-injection-guide.md) |
| Fixture 迁移说明 | [`e2e-fixture-migration-guide`](e2e-fixture-migration-guide.md) |
| 端口安全 | [`e2e-safety-guide`](e2e-safety-guide.md) |

GameTestRunner 用于游戏领域测试：输入命令序列，执行 pipeline，断言最终状态。非法命令或拒绝路径才使用 `expectError`；成功路径除了断言最终状态，也要断言没有失败步骤。

## 产物目录

| 产物 | 目录 |
| --- | --- |
| Playwright 自动附件 | `test-results/playwright-artifacts/` |
| 显式证据截图 | `test-results/evidence-screenshots/` |
| 临时输出 | `test-results/`、`temp/`、`tmp/` |

`test-results/` 已被 Git 忽略，不应提交。需要在 evidence 或交接里引用截图时，写完整工作区绝对路径，不只写目录名。

## API 测试

```bash
$env:MONGO_URI="mongodb://localhost:27017/boardgame_test"
npm run test:api
```

未设置 `MONGO_URI` 时，API 测试按项目配置使用临时内存 MongoDB。

## 调试

- 调试面板测试模式：[`debugging/test-mode.md`](debugging/test-mode.md)。
- Chrome DevTools 噪声过滤：[`troubleshooting/chrome-devtools-ignore-list.md`](troubleshooting/chrome-devtools-ignore-list.md)。
- TDZ 错误排查：[`troubleshooting/tdz-errors.md`](troubleshooting/tdz-errors.md)。
- 游戏专项调试命令放 `docs/games/<gameId>/records/`，通用测试入口不复制单游戏命令。

不要杀所有 Node 进程。端口异常时先查目标端口，再只清理本轮测试端口或运行项目 cleanup。

## CI 口径

主门禁以仓库实际脚本和 CI 配置为准，通常包含 `typecheck`、`test:games`、`i18n:check` 和关键 E2E smoke。

本地开发默认从最窄命令开始；只有共享引擎、共享 UI、公共协议、CI 回归或用户明确要求时才扩大到全量。
