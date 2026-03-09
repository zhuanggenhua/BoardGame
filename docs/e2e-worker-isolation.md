# E2E 测试 Worker 隔离方案

## 概述

E2E 测试框架现在支持两种模式：

1. **单 worker 模式**（默认）：所有测试串行执行，使用固定端口
2. **多 worker 模式**：测试并行执行，每个 worker 使用独立端口

## 使用方式

### 单 worker 模式（默认）

```bash
# 运行所有测试（串行）
npm run test:e2e

# 运行单个测试文件
npm run test:e2e -- e2e/framework-pilot-ninja-infiltrate.e2e.ts
```

**特点**：
- 端口固定：5173（前端）、19000（游戏服务器）、19001（API 服务器）
- 测试串行执行，不会互相干扰
- 适合日常开发和调试

### 多 worker 模式（并行）

```bash
# 运行所有测试（3 个 worker 并行）
npm run test:e2e:parallel

# 自定义 worker 数量
cross-env PW_WORKERS=5 npm run test:e2e
```

**特点**：
- 每个 worker 使用独立端口范围
- Worker 0: 6000, 20000, 21000
- Worker 1: 6100, 20100, 21100
- Worker 2: 6200, 20200, 21200
- ...
- 测试并行执行，速度更快
- 适合 CI 环境和大量测试

## 端口分配规则

### 单 worker 模式

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 5173 | Vite 开发服务器 |
| 游戏服务器 | 19000 | Socket.IO 游戏服务器 |
| API 服务器 | 19001 | NestJS API 服务器 |

### 多 worker 模式

每个 worker 的端口偏移量为 100：

| Worker | 前端 | 游戏服务器 | API 服务器 |
|--------|------|-----------|-----------|
| 0 | 6000 | 20000 | 21000 |
| 1 | 6100 | 20100 | 21100 |
| 2 | 6200 | 20200 | 21200 |
| 3 | 6300 | 20300 | 21300 |
| ... | ... | ... | ... |

### 开发环境端口（不冲突）

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3000 | `npm run dev` |
| 游戏服务器 | 18000 | `npm run dev` |
| API 服务器 | 18001 | `npm run dev` |

## 工作原理

### 单 worker 模式

1. Playwright 启动时，检测到 `workers=1`
2. 使用固定端口（5173, 19000, 19001）
3. `webServer` 配置启动测试服务器
4. 所有测试串行执行，共享同一组服务器

### 多 worker 模式

1. Playwright 启动时，检测到 `workers>1`
2. `globalSetup` 为每个 worker 分配独立端口
3. 端口信息保存到 `.tmp/worker-{id}-ports.json`
4. 每个测试通过 `workerPorts` fixture 获取自己的端口
5. 测试并行执行，每个 worker 完全隔离
6. `globalTeardown` 清理所有 worker 的端口

## 测试代码示例

### 基本用法（自动适配）

```typescript
import { test, expect } from './framework';

test('测试名称', async ({ page, game }) => {
  // 框架自动处理端口，无需手动配置
  await page.goto('/play/smashup');
  await game.setupScene({ ... });
  // ...
});
```

### 高级用法（访问 worker 端口）

```typescript
import { test, expect } from './framework';

test('测试名称', async ({ page, game, workerPorts }) => {
  console.log(`当前 worker 端口: ${workerPorts.frontend}`);
  
  // 可以直接访问特定端口
  await page.goto(`http://localhost:${workerPorts.frontend}/play/smashup`);
  // ...
});
```

## 故障排查

### 端口冲突

如果遇到端口冲突，清理测试端口：

```bash
# 清理所有测试端口（5173, 19000, 19001）
npm run test:e2e:cleanup

# 清理特定 worker 的端口
node scripts/infra/port-allocator.js 0  # Worker 0
node scripts/infra/port-allocator.js 1  # Worker 1
```

### 服务器启动慢

如果服务器启动超时（120 秒），可能是：

1. **僵尸进程过多**：清理所有 node 进程
2. **端口被占用**：使用 `npm run test:e2e:cleanup`
3. **资源不足**：减少 worker 数量

### 测试失败

1. **检查端口占用**：`netstat -ano | findstr "5173 19000 19001"`
2. **查看测试日志**：Playwright 会输出详细的错误信息
3. **查看截图**：失败的测试会自动保存截图到 `test-results/`

## 最佳实践

1. **日常开发**：使用单 worker 模式（`npm run test:e2e`）
2. **CI 环境**：使用多 worker 模式（`npm run test:e2e:parallel`）
3. **调试单个测试**：使用单 worker 模式 + 指定文件
4. **清理端口**：测试结束后运行 `npm run test:e2e:cleanup`
5. **避免手动启动服务器**：让 Playwright 自动管理服务器生命周期

## 配置文件

- `playwright.config.ts` - 主配置文件（支持单/多 worker）
- `playwright.config.parallel.ts` - 旧的并行配置（已废弃，保留向后兼容）
- `scripts/infra/port-allocator.js` - 端口分配器
- `e2e/framework/fixtures.ts` - Worker 端口 fixture

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PW_WORKERS` | Worker 数量 | 1 |
| `PW_START_SERVERS` | 强制启动服务器 | false |
| `PW_USE_DEV_SERVERS` | 使用开发服务器 | false |

## 迁移指南

### 从旧框架迁移

旧的测试代码无需修改，框架会自动适配：

```typescript
// 旧代码（仍然有效）
import { test, expect } from './framework';

test('测试', async ({ page, game }) => {
  await page.goto('/play/smashup');
  // ...
});
```

### 启用并行测试

只需修改 npm 脚本：

```bash
# 旧方式（串行）
npm run test:e2e

# 新方式（并行）
npm run test:e2e:parallel
```

## 性能对比

| 模式 | 测试数量 | 执行时间 | 资源占用 |
|------|---------|---------|---------|
| 单 worker | 10 | ~5 分钟 | 低 |
| 3 workers | 10 | ~2 分钟 | 中 |
| 5 workers | 10 | ~1.5 分钟 | 高 |

**建议**：
- 本地开发：1 worker
- CI 环境：3-5 workers（根据 CPU 核心数）
