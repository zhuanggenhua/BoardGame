# Token 401 错误修复

## 问题描述

用户在使用过程中遇到 401 Unauthorized 错误，导致无法创建房间和进行游戏操作。

### 错误日志

```
useTokenRefresh.ts:127 [TokenRefresh] 将在 40372 分钟后刷新 token
useTokenRefresh.ts:131 [TokenRefresh] 延迟超过 setTimeout 上限，分段等待
GameDetailsModal.tsx:291 Failed to create match: Error: 401: {"error":"Invalid token"}
```

## 根本原因

1. **Token 失效但未及时检测**：
   - 客户端认为 token 还有 28 天有效期
   - 但服务器返回 401，说明 token 实际已失效

2. **可能的触发因素**：
   - 服务器重启后 JWT_SECRET 变化（旧 token 无法验证）
   - Token 在 localStorage 中被截断或损坏
   - 服务器和客户端时钟不同步

3. **缺少全局 401 处理**：
   - `matchApi.ts` 中的 API 函数没有处理 401 错误
   - 用户看到错误但不知道需要重新登录

## 解决方案

### 1. 增强错误日志

在 `useTokenRefresh.ts` 中添加更详细的错误信息：

```typescript
console.error('[TokenRefresh] Token 刷新失败且已过期，退出登录');
console.error('[TokenRefresh] 可能原因：服务器 JWT_SECRET 变化、token 被截断、时钟不同步');
```

### 2. 添加全局 401 拦截

在 `matchApi.ts` 中添加 401 错误处理：

```typescript
if (response.status === 401) {
    console.error('[matchApi] 401 Unauthorized - Token 失效');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    // 不自动跳转，让 AuthContext 处理
}
```

### 3. 用户操作指南

当遇到 401 错误时，用户应该：

1. 打开浏览器控制台（F12）
2. 执行以下代码清除 token：
   ```javascript
   localStorage.removeItem('auth_token');
   localStorage.removeItem('refresh_token');
   location.reload();
   ```
3. 重新登录

## 预防措施

### 开发环境

1. **避免频繁重启服务器**：每次重启可能导致 JWT_SECRET 变化
2. **使用固定的 JWT_SECRET**：在 `.env` 中设置固定值
3. **监控 token 刷新日志**：关注 `[TokenRefresh]` 日志

### 生产环境

1. **JWT_SECRET 必须持久化**：不能每次部署都变化
2. **Token 有效期设置合理**：当前 30 天，可以考虑缩短到 7 天
3. **添加 token 健康检查**：定期验证 token 是否有效

## 测试验证

### 手动测试

1. 清除 localStorage 中的 token
2. 尝试创建房间，应该看到 401 错误
3. 检查控制台日志，应该看到 `[matchApi] 401 Unauthorized` 提示
4. 刷新页面，应该自动跳转到登录页

### 自动化测试

TODO: 添加 E2E 测试验证 401 错误处理

## 相关文档

- `docs/troubleshooting/token-expiration.md` - Token 过期问题排查
- `docs/quick-reference/auth-troubleshooting.md` - 认证问题快速参考
- `scripts/diagnose-auth.mjs` - 认证诊断工具

## 修改文件

- `src/hooks/useTokenRefresh.ts` - 增强错误日志
- `src/services/matchApi.ts` - 添加 401 拦截

## 后续优化

1. **添加 token 健康检查**：在应用启动时验证 token 是否有效
2. **优化刷新策略**：提前更多时间刷新（当前提前 1 天，可以改为提前 3 天）
3. **添加用户友好的错误提示**：401 错误时显示 Modal 提示用户重新登录
4. **监控 token 刷新失败率**：添加日志上报，及时发现问题
