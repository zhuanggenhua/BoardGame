# E2E 并行测试快速参考

并行模式用于大量 E2E 或 CI。日常定向调试默认仍用单 worker：`npm run test:e2e -- e2e/<file>.e2e.ts`。

## 端口

端口真值来自 [`scripts/infra/e2e-port-config.js`](../scripts/infra/e2e-port-config.js)。

| 模式 | 前端 | 游戏服务器 | API 服务器 |
| --- | --- | --- | --- |
| 单 worker | 6174 | 20000 | 21000 |
| 多 worker 0 | 6273 | 20100 | 21100 |
| 多 worker N | `6273 + N*100` | `20100 + N*100` | `21100 + N*100` |

## 运行

```bash
npm run test:e2e:parallel
npm run test:e2e:parallel -- --grep "<case>"
```

`playwright.config.parallel.ts` 默认设置 `PW_WORKERS=3`，并复用主 Playwright 配置。

## 编写要求

- 不硬编码端口；从项目 fixture 或 worker 端口 helper 读取。
- 每个测试使用独立数据、独立房间、独立浏览器 context。
- 不写共享临时文件名；必须包含 worker、match 或 testInfo 维度。
- 清理只针对当前 worker 端口或当前测试资源，不影响其它 worker。

## 排查

- 端口配置：[`scripts/infra/e2e-port-config.js`](../scripts/infra/e2e-port-config.js)。
- 端口分配：[`scripts/infra/port-allocator.js`](../scripts/infra/port-allocator.js)。
- 通用命令和截图目录：[`automated-testing`](automated-testing.md)。
