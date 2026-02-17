# E2E 测试指南

## 端口架构（完全隔离）

| 环境 | 前端 | 游戏服务器 | API 服务器 | 说明 |
|------|------|-----------|-----------|------|
| **开发环境** | 3000 | 18000 | 18001 | `npm run dev` |
| **E2E 测试** | 5173 | 19000 | 19001 | `npm run test:e2e` |
| **并行测试 Worker 0** | 6000 | 20000 | 20001 | `npm run test:e2e:parallel` |
| **并行测试 Worker 1** | 6100 | 20100 | 20101 | 每个 worker +100 |

**核心优势**：
- ✅ 测试与开发完全隔离，互不影响
- ✅ 可以同时运行开发服务器和测试
- ✅ 测试失败不会影响开发环境
- ✅ 支持并行测试，每个 worker 独立端口

## 测试模式对比

| 模式 | 并行度 | 端口管理 | 清理方式 | 适用场景 |
|------|--------|----------|----------|----------|
| **默认模式** | 1 worker | 独立端口（5173, 19000, 19001） | `npm run test:e2e:cleanup` | 日常测试（推荐） |
| **开发模式** | 1 worker | 共享开发端口（3000, 18000, 18001） | `npm run test:e2e:cleanup -- --dev` | 调试测试代码 |
| **并行模式** | 多 worker | 独立端口（6000+, 20000+, 20001+） | `node scripts/infra/port-allocator.js <workerId>` | CI/CD、大量测试 |

## 为什么需要完全隔离？

传统方案中，测试和开发共享同一组端口（3000, 18000, 18001），导致：
- ❌ 测试会影响正在运行的开发服务器
- ❌ 不能同时运行开发和测试
- ❌ 测试失败可能导致开发服务器崩溃

完全隔离方案为测试分配独立的端口范围（5173, 19000, 19001），实现：
- ✅ 测试与开发完全独立
- ✅ 可以同时运行，互不干扰
- ✅ 测试失败只影响测试环境

并行模式进一步为每个 worker 分配独立端口（6000+, 20000+, 20001+），实现真正的并行执行。

## 推荐工作流

### 默认模式（日常测试，推荐）

适用于日常开发和测试，完全隔离：

```bash
# 直接运行，会自动启动独立的测试服务器（端口 5173, 19000, 19001）
npm run test:e2e

# 检查配置和端口占用情况（可选）
npm run test:e2e:check

# 清理测试环境端口（测试异常退出时）
npm run test:e2e:cleanup
```

**优点**：
- 无需手动启动服务器
- 与开发环境完全隔离（不同端口）
- 可以同时运行 `npm run dev` 和 `npm run test:e2e`
- 测试失败不影响开发环境

### 开发模式（调试测试代码）

适用于需要调试测试代码的场景：

```bash
# 1. 启动开发服务器
npm run dev

# 2. 设置环境变量使用开发服务器（端口 3000, 18000, 18001）
PW_USE_DEV_SERVERS=true npm run test:e2e
```

**注意**：
- ⚠️ 测试会连接到开发环境的服务器
- ⚠️ 可能影响开发环境的状态
- ⚠️ 仅用于调试测试代码，不推荐日常使用

### 并行模式（大量测试）

适用于 CI/CD 或需要快速运行大量测试：

```bash
# 方式 1：手动启动每个 worker 的服务器（推荐）
# 终端 1: Worker 0 (端口 6000, 20000, 20001)
npm run test:e2e:worker 0

# 终端 2: Worker 1 (端口 6100, 20100, 20101)
npm run test:e2e:worker 1

# 终端 3: Worker 2 (端口 6200, 20200, 20201)
npm run test:e2e:worker 2

# 终端 4: 运行并行测试
npm run test:e2e:parallel

# 方式 2：自动启动（需要更多配置）
PW_WORKERS=3 npm run test:e2e:parallel
```

**优点**：
- 真正的并行执行，速度提升 N 倍（N = worker 数量）
- 每个 worker 独立端口，互不干扰
- 测试失败只影响单个 worker
- 不会与开发环境（3000/18000/18001）或测试环境（5173/19000/19001）冲突

**注意事项**：
- 需要足够的系统资源（每个 worker 需要 3 个服务进程）
- 端口范围：6000-6900, 20000-20900, 20001-20901（支持最多 10 个 worker）

### 清理端口占用

**默认模式**：

测试异常退出后，运行清理脚本：

```bash
# 清理测试环境端口（5173, 19000, 19001）
npm run test:e2e:cleanup
```

**开发模式**：

清理开发环境端口：

```bash
# 清理开发环境端口（3000, 18000, 18001）
npm run test:e2e:cleanup -- --dev
```

**并行模式**：

清理指定 worker 的端口：

```bash
# 清理 Worker 0 的端口 (6000, 20000, 20001)
node scripts/infra/port-allocator.js 0

# 清理 Worker 1 的端口 (6100, 20100, 20101)
node scripts/infra/port-allocator.js 1

# 清理 Worker 2 的端口 (6200, 20200, 20201)
node scripts/infra/port-allocator.js 2
```

**清理内容**：
- 终止占用指定端口的所有进程
- 清理遗留的 WebSocket 连接
- 重置测试环境

## 常见问题

### ❌ 测试超时/连接失败

**原因**：服务未启动或端口配置错误

**解决方案**：
1. 检查测试服务器是否启动成功（查看终端日志）
2. 确认三个服务都在运行：
   - 前端：访问 `http://localhost:5173`（测试环境）或 `http://localhost:3000`（开发环境）
   - 游戏服务器：访问 `http://localhost:19000/games`（测试环境）或 `http://localhost:18000/games`（开发环境）
   - API 服务器：访问 `http://localhost:19001/auth/status`（测试环境）或 `http://localhost:18001/auth/status`（开发环境）

### ❌ 端口被占用（默认模式）

**原因**：上次测试异常退出，测试环境端口未清理

**解决方案**：
```bash
# 清理测试环境端口（5173, 19000, 19001）
npm run test:e2e:cleanup
```

### ❌ 端口被占用（开发模式）

**原因**：开发环境端口被占用

**解决方案**：
```bash
# 清理开发环境端口（3000, 18000, 18001）
npm run test:e2e:cleanup -- --dev
```

### ❌ 端口被占用（并行模式）

**原因**：指定 worker 的进程未清理

**解决方案**：
```bash
# 清理 Worker 0
node scripts/infra/port-allocator.js 0

# 清理 Worker 1
node scripts/infra/port-allocator.js 1
```

### ❌ 并行测试互相干扰

**原因**：多个 worker 使用了相同的端口

**解决方案**：
1. 确认每个 worker 使用了独立的端口范围
2. 检查 `.tmp/worker-<id>-ports.json` 文件是否正确生成
3. 在测试中使用 `getWorkerPorts(testInfo)` 获取当前 worker 的端口

### ❌ WebSocket 连接失败

**原因**：端口配置不一致或代理配置错误

**解决方案**：
1. 检查 `.env` 中的端口配置（开发环境）
2. 检查 `playwright.config.ts` 中的 `E2E_PORTS` 配置（测试环境）
3. 检查 `vite.config.ts` 中的 `server.proxy` 配置
4. 确认防火墙未阻止 WebSocket 连接

### ❌ 测试通过但服务器挂掉

**原因**：测试结束后 BrowserContext 未正确关闭

**解决方案**：
1. 确保测试中使用了 `try...finally` 清理资源：
   ```typescript
   try {
     // 测试代码
   } finally {
     await hostContext.close();
     await guestContext.close();
   }
   ```
2. 运行 `npm run test:e2e:cleanup` 清理遗留连接

## 配置说明

### 默认模式配置（playwright.config.ts）

```typescript
// E2E 测试使用独立的端口范围，与开发环境完全隔离
const E2E_PORTS = {
    frontend: 5173,      // Vite 默认端口，与开发环境的 3000 不同
    gameServer: 19000,   // 与开发环境的 18000 不同
    apiServer: 19001,    // 与开发环境的 18001 不同
};

// E2E 测试默认启动独立的服务器实例（完全隔离）
// 设置 PW_USE_DEV_SERVERS=true 可以使用开发环境的服务器（不推荐）
const useDevServers = process.env.PW_USE_DEV_SERVERS === 'true';
const shouldStartServers = !useDevServers;

// 串行执行（避免服务器状态冲突）
fullyParallel: false,
workers: 1,

// 自动启动独立的测试服务器
webServer: shouldStartServers ? [...] : undefined,
```

### 并行模式配置（playwright.config.parallel.ts）

```typescript
// 启用并行执行
fullyParallel: true,
workers: 3,  // 可通过 PW_WORKERS 环境变量调整

// 全局 setup：为每个 worker 分配端口
globalSetup: async () => {
  for (let i = 0; i < workers; i++) {
    const ports = allocatePorts(i);
    saveWorkerPorts(i, ports);
  }
},

// 全局 teardown：清理所有 worker 的端口
globalTeardown: async () => {
  for (let i = 0; i < workers; i++) {
    cleanupWorkerPorts(i);
  }
},
```

### 端口分配规则

```javascript
// 开发环境
frontend: 3000
gameServer: 18000
apiServer: 18001

// E2E 测试环境（完全隔离）
frontend: 5173
gameServer: 19000
apiServer: 19001

// 并行测试 Worker 0
frontend: 6000
gameServer: 20000
apiServer: 20001

// 并行测试 Worker 1
frontend: 6100
gameServer: 20100
apiServer: 20101

// 并行测试 Worker N
frontend: 6000 + N * 100
gameServer: 20000 + N * 100
apiServer: 20001 + N * 100
```

### 环境变量

在 `.env` 中配置开发环境端口：

```env
VITE_DEV_PORT=3000
GAME_SERVER_PORT=18000
API_SERVER_PORT=18001
```

测试环境端口硬编码在 `playwright.config.ts` 中，无需配置。

## 最佳实践

### 默认模式

1. **日常测试**：直接运行 `npm run test:e2e`，无需手动启动服务器
2. **测试前检查**：运行 `npm run test:e2e:check` 确认隔离状态
3. **测试后清理**：如果测试异常退出，运行 `npm run test:e2e:cleanup`
4. **同时开发和测试**：可以同时运行 `npm run dev` 和 `npm run test:e2e`，完全不冲突
5. **使用 try...finally**：确保测试中的 BrowserContext 总是被关闭

### 开发模式

1. **仅用于调试**：只在需要调试测试代码时使用 `PW_USE_DEV_SERVERS=true`
2. **注意状态污染**：测试可能影响开发环境的状态
3. **及时清理**：测试后运行 `npm run test:e2e:cleanup -- --dev` 清理开发环境

### 并行模式

1. **合理设置 worker 数量**：根据 CPU 核心数和内存大小调整（推荐 2-4 个）
2. **手动启动服务器**：为每个 worker 手动启动独立的服务器实例，更稳定
3. **独立清理**：测试失败时只清理对应 worker 的端口，不影响其他 worker
4. **监控资源使用**：每个 worker 需要 3 个服务进程，确保系统资源充足
5. **使用辅助函数**：在测试中使用 `getWorkerPorts(testInfo)` 获取当前 worker 的端口
6. **不会冲突**：并行测试使用独立端口（6000+），不会与开发环境（3000）或测试环境（5173）冲突

### 编写并行安全的测试

```typescript
import { test, expect } from '@playwright/test';
import { getWorkerPorts, injectWorkerUrls } from './helpers/parallel';

test.describe('我的测试', () => {
  test.beforeEach(async ({ context }, testInfo) => {
    // 注入当前 worker 的服务器 URL
    await injectWorkerUrls(context, testInfo);
  });

  test('测试用例', async ({ page }, testInfo) => {
    // 获取当前 worker 的端口
    const ports = getWorkerPorts(testInfo);
    
    // 使用 worker 专属的前端 URL
    await page.goto(`http://localhost:${ports.frontend}`);
    
    // 测试逻辑...
  });
});
```

## 技术细节

### 完全隔离的实现

完全隔离方案通过以下机制实现：

1. **独立端口范围**：测试环境使用 5173/19000/19001，与开发环境的 3000/18000/18001 完全不同
2. **自动启动测试服务器**：Playwright 自动启动独立的测试服务器实例
3. **环境变量控制**：通过 `PW_USE_DEV_SERVERS` 环境变量切换模式
4. **独立清理**：测试环境和开发环境可以独立清理，互不影响

### 并行模式的实现

并行模式通过以下机制实现真正的隔离：

1. **动态端口分配**：每个 worker 使用独立的端口范围（基础端口 6000/20000/20001 + worker ID × 100）
2. **独立服务器实例**：每个 worker 启动自己的前端、游戏服务器、API 服务器
3. **端口信息持久化**：将端口配置保存到 `.tmp/worker-<id>-ports.json`，测试间共享
4. **独立清理**：每个 worker 只清理自己的端口，不影响其他 worker

### WebSocket 连接管理

每个 BrowserContext 会创建独立的 WebSocket 连接到游戏服务器。测试结束时必须：
1. 关闭所有 Page 对象
2. 关闭 BrowserContext
3. 等待 WebSocket 连接完全断开

如果跳过任何一步，连接可能会泄漏，导致端口持续被占用。

### 清理脚本工作原理

**默认模式清理**（`cleanup_test_connections.js`）：
1. 扫描测试环境端口（5173、19000、19001）
2. 找到占用这些端口的所有进程 PID
3. 强制终止这些进程（Windows: `taskkill /F`，Unix: `kill -9`）

**开发模式清理**（`cleanup_test_connections.js --dev`）：
1. 扫描开发环境端口（3000、18000、18001）
2. 找到占用这些端口的所有进程 PID
3. 强制终止这些进程

**并行模式清理**（`port-allocator.js`）：
1. 根据 worker ID 计算端口范围
2. 只扫描该 worker 的端口（如 Worker 1 的 6100、20100、20101）
3. 终止占用这些端口的进程
4. 不影响其他 worker 的端口

**注意**：清理脚本会终止所有占用指定端口的进程，包括手动启动的服务器。使用前请确认没有其他重要进程在使用这些端口。

### 性能对比

假设有 30 个测试，每个测试平均耗时 10 秒：

- **默认模式（串行）**：30 × 10 = 300 秒（5 分钟）
- **并行模式（3 workers）**：30 ÷ 3 × 10 = 100 秒（1.7 分钟）
- **并行模式（5 workers）**：30 ÷ 5 × 10 = 60 秒（1 分钟）

实际加速比取决于：
- 测试的 I/O 密集程度
- 系统资源（CPU、内存、网络）
- 服务器启动时间
- 测试间的依赖关系

**完全隔离的优势**：
- 可以同时运行开发服务器和测试，不影响开发效率
- 测试失败不会导致开发服务器崩溃
- 更安全、更可靠的测试环境
