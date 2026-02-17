# E2E 并行测试快速入门

## 5 分钟上手并行测试

### 1. 启动 Worker 服务器

打开 3 个终端，分别启动 3 个 worker 的服务器：

```bash
# 终端 1: Worker 0 (端口 3000, 18000, 18001)
npm run test:e2e:worker 0

# 终端 2: Worker 1 (端口 3100, 18100, 18101)
npm run test:e2e:worker 1

# 终端 3: Worker 2 (端口 3200, 18200, 18201)
npm run test:e2e:worker 2
```

等待所有服务器启动完成（看到 "✅ Worker X 服务器已启动"）。

### 2. 运行并行测试

打开第 4 个终端，运行测试：

```bash
npm run test:e2e:parallel
```

### 3. 清理（可选）

测试完成后，如果需要清理端口：

```bash
# 清理 Worker 0
node scripts/infra/port-allocator.js 0

# 清理 Worker 1
node scripts/infra/port-allocator.js 1

# 清理 Worker 2
node scripts/infra/port-allocator.js 2
```

## 编写并行安全的测试

### 基本模板

```typescript
import { test, expect } from '@playwright/test';
import { getWorkerPorts, injectWorkerUrls } from './helpers/parallel';

test.describe('我的测试套件', () => {
  // 在每个测试前注入 worker 专属的服务器 URL
  test.beforeEach(async ({ context }, testInfo) => {
    await injectWorkerUrls(context, testInfo);
  });

  test('测试用例 1', async ({ page }, testInfo) => {
    const ports = getWorkerPorts(testInfo);
    const workerId = testInfo.parallelIndex;
    
    console.log(`[Worker ${workerId}] 使用端口: ${JSON.stringify(ports)}`);
    
    // 导航到当前 worker 的前端服务器
    await page.goto(`http://localhost:${ports.frontend}`);
    
    // 你的测试逻辑...
  });
});
```

### 关键点

1. **使用 `getWorkerPorts(testInfo)`** 获取当前 worker 的端口
2. **使用 `injectWorkerUrls(context, testInfo)`** 注入服务器 URL
3. **不要硬编码端口号**，始终从 `getWorkerPorts()` 获取

## 常见问题

### Q: 为什么需要手动启动 worker 服务器？

A: 自动启动需要更复杂的进程管理。手动启动更稳定，且可以查看每个 worker 的日志。

### Q: 可以只启动 1 个或 2 个 worker 吗？

A: 可以。修改 `playwright.config.parallel.ts` 中的 `workers` 配置，或设置环境变量：

```bash
PW_WORKERS=2 npm run test:e2e:parallel
```

### Q: 如何调试单个 worker 的测试？

A: 使用 Playwright 的 `--grep` 选项：

```bash
npx playwright test --config=playwright.config.parallel.ts --grep "测试用例名称"
```

### Q: 并行测试比串行测试快多少？

A: 理论上快 N 倍（N = worker 数量）。实际加速比取决于测试的 I/O 密集程度和系统资源。

## 性能优化建议

1. **合理设置 worker 数量**：
   - 2-4 核 CPU：2 workers
   - 4-8 核 CPU：3-4 workers
   - 8+ 核 CPU：4-6 workers

2. **监控资源使用**：
   - 每个 worker 需要约 500MB 内存
   - 确保有足够的 CPU 和内存

3. **分组测试**：
   - 将快速测试和慢速测试分开
   - 快速测试用串行模式，慢速测试用并行模式

4. **避免资源竞争**：
   - 不要在测试中使用共享的文件系统资源
   - 每个测试使用独立的测试数据

## 故障排查

### 端口冲突

```bash
# 检查端口占用
netstat -ano | findstr :3000
netstat -ano | findstr :18000

# 清理指定 worker
node scripts/infra/port-allocator.js 0
```

### 服务器启动失败

1. 检查 `.env` 文件配置
2. 确认没有其他进程占用端口
3. 查看服务器日志输出

### 测试超时

1. 确认所有 worker 服务器都已启动
2. 检查网络连接
3. 增加测试超时时间（在 `playwright.config.parallel.ts` 中）

## 下一步

- 阅读完整的 [E2E 测试指南](./e2e-testing-guide.md)
- 查看 [示例测试](../e2e/example-parallel.e2e.ts)
- 了解 [端口分配器](../scripts/infra/port-allocator.js) 的实现
