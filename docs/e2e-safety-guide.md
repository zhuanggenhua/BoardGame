# E2E 安全指南

本文只保留 E2E 运行环境和端口安全边界。测试分层和截图证据看 [`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md)。

## 端口隔离

| 环境 | 前端 | 游戏服务器 | API 服务器 |
| --- | --- | --- | --- |
| 开发环境 | 由 `.env` / dev runtime 决定，常见为 4273 | 18000 | 18001 |
| 默认 E2E | 6174 | 20000 | 21000 |
| 并行 worker | 6273+ | 20100+ | 21100+ |

日常定向测试使用：

```bash
npm run test:e2e -- e2e/<file>.e2e.ts
```

需要连接正在运行的开发服务器时，才显式使用 `PW_USE_DEV_SERVERS=true`。

## 清理边界

- 默认只清理测试端口，不杀所有 Node 进程。
- 异常退出后优先运行 `npm run test:e2e:cleanup` 或按端口查 PID 后只终止目标进程。
- 并行测试只清理对应 worker 的端口范围，不影响其他 worker 或开发服务器。
- 清理动作会影响占用目标端口的进程；执行前确认端口属于本轮测试。

更多命令见 [`automated-testing`](automated-testing.md)，并行模式见 [`e2e-parallel-quickstart`](e2e-parallel-quickstart.md)。
