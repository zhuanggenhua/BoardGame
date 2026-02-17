# E2E 测试安全指南

## 🛡️ 核心安全保证（完全隔离架构）

**默认模式（`npm run test:e2e`）100% 安全**：
- ✅ 使用独立端口（5173, 19000, 19001），与开发环境（3000, 18000, 18001）完全隔离
- ✅ 自动启动独立的测试服务器
- ✅ 不会影响正在运行的开发服务器
- ✅ 测试失败不会影响开发环境
- ✅ 可以同时运行开发服务器和测试

## 📋 端口架构

| 环境 | 前端 | 游戏服务器 | API 服务器 | 说明 |
|------|------|-----------|-----------|------|
| **开发环境** | 3000 | 18000 | 18001 | `npm run dev` |
| **E2E 测试** | 5173 | 19000 | 19001 | `npm run test:e2e` |
| **并行测试 Worker 0** | 6000 | 20000 | 20001 | `npm run test:e2e:parallel` |
| **并行测试 Worker 1** | 6100 | 20100 | 20101 | 每个 worker +100 |

## 📋 快速参考

### 日常测试（推荐，完全隔离）

```bash
# 直接运行，会自动启动独立的测试服务器
npm run test:e2e

# 检查配置和端口占用情况（可选）
npm run test:e2e:check

# 清理测试环境端口（测试异常退出时）
npm run test:e2e:cleanup
```

**优势**：
- 无需手动启动服务器
- 与开发环境完全隔离
- 可以同时运行 `npm run dev` 和 `npm run test:e2e`

### 开发模式（使用开发服务器，不推荐）

如果需要使用开发服务器进行测试（例如调试测试代码）：

```bash
# 1. 启动开发服务器
npm run dev

# 2. 设置环境变量使用开发服务器
PW_USE_DEV_SERVERS=true npm run test:e2e
```

**注意**：
- ⚠️ 测试会连接到开发环境的服务器（3000, 18000, 18001）
- ⚠️ 可能影响开发环境的状态
- ⚠️ 仅用于调试测试代码，不推荐日常使用

### 并行模式（实验性，适用于大量测试）

```bash
# 使用独立端口范围（6000+, 20000+, 20001+），不会冲突
npm run test:e2e:parallel
```

**特点**：
- 每个 worker 使用独立端口（Worker 0: 6000/20000/20001, Worker 1: 6100/20100/20101）
- 不会与开发环境（3000/18000/18001）或测试环境（5173/19000/19001）冲突
- 需要手动启动 worker 服务器或使用自动启动模式

### 检查配置

```bash
# 查看当前配置和端口占用情况
npm run test:e2e:check
```

输出示例：
```
🔍 E2E 测试环境检查...

测试模式: ✅ 独立测试环境（推荐）

✅ 测试环境完全隔离
   测试端口: 5173, 19000, 19001
   开发端口: 3000, 18000, 18001
   → 测试不会影响开发环境

开发环境端口占用:
  ✓ frontend (3000): 已占用
  ✓ gameServer (18000): 已占用
  ✓ apiServer (18001): 已占用

E2E 测试环境端口占用:
  ○ frontend (5173): 空闲
  ○ gameServer (19000): 空闲
  ○ apiServer (19001): 空闲

状态分析:
  ✅ 完全隔离模式
  → 开发环境: 3/3 服务运行中
  → 测试环境: 0/3 服务运行中
  → Playwright 会自动启动测试服务器
  → 测试不会影响开发环境 ✓

✅ 检查完成
```

### 清理端口

```bash
# 清理测试环境端口（5173, 19000, 19001）
npm run test:e2e:cleanup

# 清理开发环境端口（3000, 18000, 18001）
npm run test:e2e:cleanup -- --dev

# 清理两个环境
npm run test:e2e:cleanup -- --e2e --dev
```

## ⚠️ 注意事项

### 配置逻辑

```typescript
// playwright.config.ts

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
```

### 端口配置

| 环境 | 前端 | 游戏服务器 | API 服务器 | 环境变量 |
|------|------|-----------|-----------|---------|
| **开发环境** | 3000 | 18000 | 18001 | `VITE_DEV_PORT`, `GAME_SERVER_PORT`, `API_SERVER_PORT` |
| **E2E 测试** | 5173 | 19000 | 19001 | 硬编码在 `playwright.config.ts` |
| **并行测试** | 6000+ | 20000+ | 20001+ | 动态分配（基础端口 + worker ID × 100） |

### 安全检查脚本

`scripts/infra/check-e2e-safety.js` 会：
1. 检查 `PW_USE_DEV_SERVERS` 环境变量
2. 扫描开发环境和测试环境的端口占用情况
3. 给出安全建议和隔离状态

## ⚠️ 危险操作警告（强制）

**禁止使用以下命令清理进程**：

```bash
# ❌ 禁止：杀掉所有 Node.js 进程
taskkill /F /IM node.exe
killall node
pkill node

# ❌ 禁止：杀掉所有进程（包括其他项目、IDE、工具）
taskkill /F /IM node.exe 2>$null
Get-Process node | Stop-Process -Force
```

**为什么禁止**：
- 会杀掉所有 Node.js 进程，包括：
  - 其他项目的开发服务器
  - VS Code 的语言服务器、调试器、扩展
  - 正在运行的其他测试
  - 任何 Node.js 工具（npm、pnpm、yarn 等）
- 会导致数据丢失和状态不一致
- 会破坏其他开发者的工作环境（如果在共享机器上）

**正确做法**：

```bash
# ✅ 清理单个测试的端口（推荐，不影响其他并行测试）
# 1. 查找占用端口的 PID
netstat -ano | findstr :5173    # Windows
lsof -ti:5173                   # Linux/Mac

# 2. 只杀掉该测试的进程
taskkill /F /PID <PID>          # Windows
kill -9 <PID>                   # Linux/Mac

# ✅ 清理所有测试环境端口（会影响所有并行测试，谨慎使用）
npm run test:e2e:cleanup        # 清理测试环境端口（5173/19000/19001）

# ✅ 清理开发环境端口（不影响测试）
npm run clean:ports             # 清理开发环境端口（3000/18000/18001）

# ✅ 清理特定 worker 的端口（并行测试）
node scripts/infra/port-allocator.js <workerId>  # workerId: 0, 1, 2...
```

**并行测试端口分配**：
- Worker 0: 3000, 18000, 18001
- Worker 1: 3100, 18100, 18101
- Worker 2: 3200, 18200, 18201
- 每个 worker 使用独立端口范围（+100 偏移）

**如果测试环境混乱**：

1. 先检查端口占用：`npm run test:e2e:check`
2. **优先清理单个测试的端口**（不影响其他测试）：
   ```bash
   # 查找并杀掉特定端口的进程
   netstat -ano | findstr :5173
   taskkill /F /PID <PID>
   ```
3. 如果需要清理所有测试端口（会中断其他并行测试）：`npm run test:e2e:cleanup`
4. 最后手段：重启终端/IDE（不要杀掉所有进程）

## 🚨 常见问题

### Q: 运行测试会杀掉我的开发服务器吗？

A: **不会**。默认模式使用完全不同的端口（5173, 19000, 19001），与开发环境（3000, 18000, 18001）完全隔离。

### Q: 如何确认测试不会影响我的服务器？

A: 运行 `npm run test:e2e:check` 查看端口配置和隔离状态。

### Q: 什么时候会影响现有服务器？

A: 只有在设置 `PW_USE_DEV_SERVERS=true` 时，测试才会连接到开发环境的服务器。默认情况下完全隔离。

### Q: 测试失败会影响开发服务器吗？

A: **不会**。测试使用独立的端口和服务器实例，完全隔离。

### Q: 可以同时运行开发服务器和测试吗？

A: **可以**。这正是完全隔离架构的优势，两者使用不同端口，互不干扰。

## 📚 相关文档

- [E2E 测试指南](./e2e-testing-guide.md) - 完整的测试指南
- [并行测试快速入门](./e2e-parallel-quickstart.md) - 并行测试配置
- [README.md](../README.md#e2e-测试) - 项目文档

## 🎯 最佳实践

1. **日常测试**：使用 `npm run test:e2e`（完全隔离，自动启动测试服务器）
2. **测试前检查**：运行 `npm run test:e2e:check` 确认隔离状态
3. **测试后清理**：如果测试异常退出，运行 `npm run test:e2e:cleanup` 清理测试环境端口
4. **开发调试**：如需调试测试代码，可设置 `PW_USE_DEV_SERVERS=true` 使用开发服务器
5. **大量测试**：使用 `npm run test:e2e:parallel`（并行执行，每个 worker 独立端口）
6. **同时开发和测试**：可以同时运行 `npm run dev` 和 `npm run test:e2e`，完全不冲突
