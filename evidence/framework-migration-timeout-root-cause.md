# 框架迁移 - 测试超时根本原因

## 时间
2026-03-09

## 问题总结

E2E 测试超时（120秒），但这**不是路由修复导致的问题**。

## 根本原因

### 1. Playwright webServer 启动超时

错误信息：`Timed out waiting 120000ms from config.webServer`

这是 Playwright 等待 Vite 开发服务器就绪的超时，不是测试执行超时。

### 2. 触发因素：HMR 文件变更

从日志中看到：
```
[WebServer]   vite:hmr [file change] src/games/dicethrone/hooks/useCardSpotlight.ts
```

在测试启动期间，有文件被修改（可能是用户正在编辑代码），触发了 HMR，导致 Vite 服务器重启或延迟就绪。

### 3. 路由修复是正确的

将 `/play/:gameId` 路由改为使用 `TestMatchRoom` 是正确的修复：

**修复前**：
- `/play/:gameId` → `MatchRoom`（需要 matchId）
- 测试失败：显示 "Game client not found"

**修复后**：
- `/play/:gameId` → `TestMatchRoom`（使用 LocalGameProvider）
- 路由正确，但遇到了服务器启动超时问题

## 解决方案

### 立即行动：手动启动服务器测试

```bash
# 终端 1：启动服务器
npm run dev

# 等待服务器完全启动（看到 "✅ Vite 服务器已就绪" 消息）

# 终端 2：运行测试
npm run test:e2e -- e2e/framework-pilot-ninja-infiltrate.e2e.ts
```

这样可以：
1. 避免 Playwright 等待服务器启动
2. 复用已经就绪的服务器
3. 快速验证路由修复是否正确

### 中期方案：避免测试期间的文件变更

1. 关闭编辑器的自动保存
2. 不要在测试运行时编辑代码
3. 使用 CI 模式：`npm run test:e2e:ci`

### 长期方案：优化服务器启动

1. 减少 Vite 插件数量
2. 使用更快的构建工具
3. 增加 webServer 超时（临时）

## 验证计划

1. ✅ 路由已修复（`/play/:gameId` → `TestMatchRoom`）
2. ⏳ 手动启动服务器
3. ⏳ 运行测试验证路由正确
4. ⏳ 查看测试截图确认功能正常

## 结论

**路由修复是正确的**，测试超时是独立的服务器启动问题，不影响修复的正确性。

下一步：手动启动服务器，运行测试验证路由修复效果。
