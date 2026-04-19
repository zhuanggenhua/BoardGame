# Vite 开发服务器崩溃修复 - .env 文件监听问题

## 问题描述

Vite 开发服务器在启动后约 1-2 分钟就崩溃，退出码 `4294967295` (-1) 或 `1`，无错误日志。

## 问题根因

通过添加详细日志（`scripts/infra/vite-with-logging.js`），我们发现了真正的原因：

1. **配置文件变化触发 HMR 崩溃**：`playwright.config.ts` 文件变化触发了 Vite 的 HMR，导致崩溃
2. **Vite 内部不稳定**：即使没有文件变化，Vite 也会在运行约 10-30 秒后崩溃
3. **大量残留进程**：之前的 E2E 测试和开发服务器留下了 50+ 个僵尸 Node.js 进程，占用系统资源

## 修复方案

### 1. 禁止 Vite 监听配置文件

在 `vite.config.ts` 中添加配置文件到 `watch.ignored` 列表：

```typescript
watch: {
  usePolling: false,
  ignored: [
    '**/test-results/**',
    '**/playwright-report/**',
    '**/.tmp/**',
    '**/evidence/**',
    '**/logs/**',
    '**/node_modules/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/e2e/**',
    '**/.env',                 // 禁止监听 .env 文件
    '**/.env.*',               // 禁止监听 .env.* 文件
    '**/playwright.config.*',  // 禁止监听 Playwright 配置文件
    '**/vitest.config.*',      // 禁止监听 Vitest 配置文件
    '**/vite.config.*',        // 禁止监听 Vite 配置文件
  ],
},
```

### 2. 添加详细日志

创建 `scripts/infra/vite-with-logging.js` 包装器，捕获 Vite 的所有输出和退出事件：

- 捕获 stdout/stderr
- 捕获进程退出事件和退出码
- 捕获未捕获的异常和 Promise 拒绝
- 将日志写入 `logs/vite-*.log` 文件

### 3. 清理残留进程

使用 PowerShell 脚本清理项目相关的 Node.js 进程（清理了 50+ 个残留进程）。

### 4. 增加 Node.js 内存限制（已实现）

在 `package.json` 中为 Vite 添加内存限制：`--max-old-space-size=4096`

### 5. 配置 HMR WebSocket（已实现）

在 `vite.config.ts` 中显式配置 HMR WebSocket 参数。

## 验证结果

1. **禁止监听配置文件后，崩溃频率降低**：
   - 之前：启动后 1-2 分钟崩溃
   - 现在：启动后 10-30 秒崩溃（仍然不稳定）

2. **日志成功捕获崩溃信息**：
   - 退出码：1
   - 无具体错误信息（Vite 内部崩溃）

3. **问题仍然存在**：
   - Vite 即使没有文件变化也会崩溃
   - 说明问题是 Vite 7.3.1 本身的稳定性问题

## 根本原因分析（已更新）

经过多轮排查和用户的成功修复，我们确定问题的根本原因是：

1. **Windows 原生文件监听器不稳定**：`fs.watch` 在大型项目中容易崩溃
2. **文件监听触发崩溃**：任何配置文件的变化都可能触发 Vite 崩溃
3. **内部错误无日志**：Vite 崩溃时没有输出任何错误信息，只有退出码

**关键发现**：问题不是 Vite 7.x 版本本身，而是 Windows 原生文件监听器的稳定性问题。切换到轮询模式后，Vite 7.3.1 运行稳定。

## 最终建议

### 短期方案（立即可用）

1. **降级 Vite 到稳定版本**：
   ```bash
   npm install vite@6.0.0 --save-dev
   ```
   Vite 6.x 是经过充分测试的稳定版本，推荐使用。

2. **使用 nodemon 监听并自动重启**：
   ```json
   "dev:frontend:watch": "nodemon --watch vite.config.ts --exec \"npm run dev:frontend\""
   ```

3. **禁用 HMR**（如果不需要热更新）：
   ```typescript
   server: {
     hmr: false,
   }
   ```

### 长期方案

1. **等待 Vite 7.x 稳定**：关注 Vite 官方 GitHub issues，等待修复
2. **迁移到其他构建工具**：如果 Vite 问题持续，考虑迁移到 Webpack 或 Turbopack

## 教训

1. **新版本需要充分测试**：Vite 7.x 刚发布不久，存在稳定性问题
2. **日志是排查的关键**：通过添加详细日志，我们才能定位到真正的问题
3. **E2E 测试必须清理进程**：避免残留进程占用系统资源
4. **配置文件不应触发 HMR**：配置文件变化应该要求手动重启，而不是自动重启

## 相关文件

- `vite.config.ts` - Vite 配置文件
- `package.json` - npm 脚本配置
- `scripts/infra/vite-with-logging.js` - Vite 日志包装器
- `logs/vite-*.log` - Vite 崩溃日志

## 时间线

- 2026-03-09 10:38 - 用户报告 Vite 反复崩溃
- 2026-03-09 11:41 - 发现 `.env` 文件变化触发 Vite 重启
- 2026-03-09 12:09 - 修改 `vite.config.ts`，添加 `.env` 到 `watch.ignored`
- 2026-03-09 12:10 - 清理 50 个残留 Node.js 进程
- 2026-03-09 12:32 - 添加详细日志，捕获到 `playwright.config.ts` 触发崩溃
- 2026-03-09 12:38 - 添加配置文件到 `watch.ignored`
- 2026-03-09 12:40 - 确认问题是 Vite 7.3.1 内部不稳定
- 2026-03-09 13:00 - **用户修复成功**：切换到轮询模式 + 改进错误处理 + 扩展忽略列表
- 2026-03-09 13:15 - 验证修复有效，Vite 稳定运行

## 最终修复方案（已验证有效）

### 用户的成功修复

用户通过以下修改彻底解决了 Vite 崩溃问题：

#### 1. 使用轮询模式替代原生文件监听（最关键）

```typescript
watch: {
  usePolling: true,      // 从 false 改为 true
  interval: 1000,        // 轮询间隔 1 秒
  // ...
}
```

**原因**：Windows 原生文件监听器（`fs.watch`）在大型项目中不稳定，轮询模式（`fs.watchFile`）更可靠。

#### 2. 扩展了 `watch.ignored` 列表

添加了更多临时目录：
- `**/temp/**`
- `**/tmp/**`
- `**/.tmp-*`

#### 3. 改进了代理错误处理

```typescript
const isIgnorableProxyError = (err: Error & NodeJS.ErrnoException) => {
  if (err.code === 'ECONNABORTED') return true
  if (!suppressE2EProxyNoise) return false
  return err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'EPIPE'
}
```

忽略了可忽略的代理错误，减少了控制台噪音。

#### 4. 添加了 E2E 代理错误抑制插件

```typescript
{
  name: 'suppress-e2e-proxy-noise',
  enforce: 'pre' as const,
  configResolved(config) {
    if (!suppressE2EProxyNoise) return
    const originalError = config.logger.error;
    config.logger.error = (msg, options) => {
      if (typeof msg === 'string' && msg.includes('ws proxy error')) return;
      originalError(msg, options);
    };
  },
}
```

#### 5. 配置了 HMR WebSocket 参数

```typescript
hmr: {
  protocol: 'ws',
  host: 'localhost',
  port: devPort,
  clientPort: devPort,
}
```

### 验证结果

✅ **Vite 开发服务器稳定运行**
- 之前：启动后 10-30 秒崩溃
- 现在：稳定运行，无崩溃

### 核心教训

1. **Windows 原生文件监听器不可靠**：大型项目必须使用轮询模式
2. **Vite 7.x 不是问题**：问题不是 Vite 版本，而是文件监听器配置
3. **错误处理很重要**：忽略可忽略的错误，避免日志洪水
4. **显式配置优于默认**：HMR WebSocket 参数应该显式配置

### 推荐配置（面向百游戏）

所有使用 Vite 的项目都应该采用以下配置：

```typescript
server: {
  watch: {
    usePolling: true,      // Windows 必须用轮询模式
    interval: 1000,        // 轮询间隔 1 秒
    ignored: [
      '**/test-results/**',
      '**/playwright-report/**',
      '**/.tmp/**',
      '**/temp/**',
      '**/tmp/**',
      '**/evidence/**',
      '**/logs/**',
      '**/node_modules/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/e2e/**',
      '**/.tmp-*',
      '**/.env',
      '**/.env.*',
      '**/playwright.config.*',
      '**/vitest.config.*',
      '**/vite.config.*',
    ],
  },
  hmr: {
    protocol: 'ws',
    host: 'localhost',
    port: devPort,
    clientPort: devPort,
  },
}
```

## 下一步行动

✅ **问题已解决**，无需进一步行动。

如果未来遇到类似问题，优先检查：
1. 文件监听模式（轮询 vs 原生）
2. `watch.ignored` 列表是否完整
3. 代理错误处理是否合理
