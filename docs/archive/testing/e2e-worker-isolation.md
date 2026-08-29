# E2E Worker 隔离旧方案归档

本文是旧 E2E worker 隔离方案记录，不作为当前 Playwright 配置真相。当前端口、命令和脚本以 [`automated-testing`](../../automated-testing.md)、[`e2e-parallel-quickstart`](../../e2e-parallel-quickstart.md) 和当前配置文件为准。

## 当时目标

旧方案要解决的是 E2E 并行时多个 worker 争用同一组前端、游戏服务器和 API 端口，导致测试互相污染或随机失败。

## 当时模式

### 单 worker 模式

旧记录中的单 worker 模式：

```bash
npm run test:e2e
npm run test:e2e -- e2e/smashup/framework-pilot-ninja-infiltrate.e2e.ts
```

旧端口：

| 服务 | 端口 |
| --- | --- |
| 前端 | 5173 |
| 游戏服务器 | 19000 |
| API 服务器 | 19001 |

### 多 worker 模式

旧记录中的多 worker 模式：

```bash
npm run test:e2e:parallel
cross-env PW_WORKERS=5 npm run test:e2e
```

旧端口分配按 worker 偏移：

| Worker | 前端 | 游戏服务器 | API 服务器 |
| --- | --- | --- | --- |
| 0 | 6000 | 20000 | 21000 |
| 1 | 6100 | 20100 | 21100 |
| 2 | 6200 | 20200 | 21200 |
| 3 | 6300 | 20300 | 21300 |

这些端口是历史值；当前端口已经以项目脚本为准，不能照抄。

## 当时工作原理

旧方案设计：

- Playwright 检测 worker 数量。
- 单 worker 使用固定端口。
- 多 worker 通过 global setup 为每个 worker 分配独立端口。
- 端口信息写入 `.tmp/worker-{id}-ports.json`。
- 测试通过 fixture 读取自己的 worker 端口。
- global teardown 清理 worker 端口。

## 当时测试写法

普通测试不需要硬编码端口：

```ts
import { test, expect } from './framework';

test('测试名称', async ({ page, game }) => {
  await page.goto('/play/smashup');
  await game.setupScene({ ... });
});
```

如果确实需要访问端口，当时通过 `workerPorts` fixture：

```ts
test('测试名称', async ({ page, workerPorts }) => {
  await page.goto(`http://localhost:${workerPorts.frontend}/play/smashup`);
});
```

当前 fixture 名称和路径要看现有 `e2e/framework/`。

## 当时排查命令

旧文档记录过：

```bash
npm run test:e2e:cleanup
node scripts/infra/port-allocator.js 0
node scripts/infra/port-allocator.js 1
```

以及 Windows 上检查端口：

```bat
netstat -ano | findstr "5173 19000 19001"
```

当前是否仍可用，要看 `package.json` 和 `scripts/infra/`。

## 当时最佳实践

- 日常开发默认单 worker。
- CI 或大量测试才启用多 worker。
- 调试单个测试时指定文件并保持单 worker。
- 测试不要硬编码端口。
- 每个测试使用独立数据、独立房间和独立 browser context。
- 临时文件名必须包含 worker、match 或 testInfo 维度。
- 清理动作只能清当前 worker 或当前测试资源，不影响其它 worker。

## 当前使用口径

- 本文只保留历史设计背景。
- 当前并行端口真值必须查 `scripts/infra/e2e-port-config.js` 或当前测试入口。
- 若当前并行失败，先判断是端口冲突、共享数据污染、服务启动慢，还是测试本身依赖顺序。
