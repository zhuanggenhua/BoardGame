# JWT Token 过期问题排查指南

## 问题现象

创建房间时收到 401 错误：`Failed to create match: Error: 401: {"error":"Invalid token"}`

## 可能原因

### 1. Token 真的过期了

Access Token 配置为 30 天有效期；Refresh Token 配置为 180 天，用于在用户重新打开页面时无感续签。但如果：
- 用户 30 天没有登录
- 用户超过 180 天没有打开页面或 refresh cookie 已失效
- 服务器时间与客户端时间不同步
- Token 签发时间有误

**检查方法**：

```bash
# 1. 在浏览器控制台获取 token
localStorage.getItem('auth_token')

# 2. 使用调试工具验证
node scripts/debug-token.mjs <your_token>
```

### 2. JWT_SECRET 不一致（可能性中等）

如果 API 服务器和游戏服务器使用不同的 JWT_SECRET，会导致：
- API 服务器签发的 token 无法被游戏服务器验证
- 即使 token 未过期也会返回 401

**检查方法**：

```bash
node scripts/check-jwt-config.mjs
```

**解决方案**：
- 确保根目录 `.env` 和 `apps/api/.env`（如果存在）的 JWT_SECRET 完全一致
- 推荐：删除 `apps/api/.env`，让所有服务使用根目录的 `.env`

### 3. Token 未正确传递（可能性高）

客户端可能：
- localStorage 中没有 token（用户未登录或 token 被清除）
- Token 格式错误（缺少 `Bearer ` 前缀）
- Token 在传递过程中被截断或修改

**检查方法**：

```javascript
// 在浏览器控制台执行
console.log('Token:', localStorage.getItem('auth_token'));
console.log('User:', localStorage.getItem('auth_user'));
```

### 4. 浏览器清除了 localStorage

某些情况下浏览器会清除 localStorage：
- 用户手动清除浏览器数据
- 隐私模式/无痕模式
- 浏览器存储空间不足
- 跨域问题（不同子域名）

### 5. Token 刷新机制失效

项目使用了 refresh token 机制（`useTokenRefresh.ts`），如果刷新失败：
- Refresh token 过期（当前 180 天）
- Refresh token 被撤销
- 网络问题导致刷新请求失败

## 排查步骤

### 第 1 步：检查客户端 token

```javascript
// 在浏览器控制台执行
const token = localStorage.getItem('auth_token');
const user = localStorage.getItem('auth_user');

console.log('Token 存在:', !!token);
console.log('Token 长度:', token?.length);
console.log('User 存在:', !!user);
console.log('User 信息:', user ? JSON.parse(user) : null);
```

如果 token 不存在 → **用户需要重新登录**

### 第 2 步：验证 token 有效性

```bash
# 复制浏览器控制台中的 token，然后运行
node scripts/debug-token.mjs <your_token>
```

输出示例：
```
✅ Token 验证成功！
  userId: 507f1f77bcf86cd799439011
  username: testuser

⏰ 过期时间:
  到期时间: 2024-04-15 10:30:00
  剩余天数: 25 天
  ✅ Token 有效
```

如果验证失败 → **检查 JWT_SECRET 是否一致**

### 第 3 步：检查 JWT_SECRET 配置

```bash
node scripts/check-jwt-config.mjs
```

如果发现不一致 → **统一 JWT_SECRET**

### 第 4 步：检查网络请求

1. 打开浏览器开发者工具（F12）
2. 切换到 Network 标签
3. 尝试创建房间
4. 查看 `/games/dicethrone/create` 请求：
   - Request Headers 中是否有 `Authorization: Bearer <token>`
   - Response 的状态码和错误信息

### 第 5 步：检查服务器日志

```bash
# 查看游戏服务器日志
tail -f logs/app-*.log | grep -i "invalid token"

# 查看 API 服务器日志（如果使用 Docker）
docker logs boardgame-api-server-1 --tail 100 -f
```

## 解决方案

### 方案 1：重新登录（最简单）

如果 token 确实过期或无效，让用户重新登录：

```javascript
// 在浏览器控制台执行
localStorage.removeItem('auth_token');
localStorage.removeItem('auth_user');
location.reload();
```

### 方案 2：统一 JWT_SECRET

如果 JWT_SECRET 不一致：

1. 检查 `apps/api/.env` 是否存在
2. 如果存在且与根目录 `.env` 不一致，删除它或修改为一致
3. 重启所有服务

### 方案 3：实现自动刷新

项目已经实现了 `useTokenRefresh` hook：

```typescript
// src/hooks/useTokenRefresh.ts
// 启动时本地无 token 会尝试 refresh
// 本地 token 已过期时，先尝试 refresh，失败后才退出登录
// 当 token 即将过期时（剩余 < 1 天），自动刷新
```

### 方案 4：增加错误提示

在 `GameDetailsModal.tsx` 中增加更友好的错误提示：

```typescript
catch (error) {
    const errorMessage = String(error);
    if (errorMessage.includes('401') || errorMessage.includes('Invalid token')) {
        toast.error({
            kind: 'i18n',
            key: 'error.createRoomInvalidToken',
            ns: 'lobby'
        });
        // 可选：自动跳转到登录页
        // navigate('/login');
    } else {
        // 其他错误处理
    }
}
```

## 预防措施

### 1. 监控 token 有效期

在 `AuthContext` 中添加 token 有效期检查：

```typescript
useEffect(() => {
    if (!token) return;
    
    try {
        const decoded = jwt.decode(token);
        if (decoded?.exp) {
            const expiresAt = new Date(decoded.exp * 1000);
            const now = new Date();
            const remainingDays = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));
            
            if (remainingDays < 7) {
                console.warn('Token 即将过期，剩余', remainingDays, '天');
                // 触发自动刷新
            }
        }
    } catch (error) {
        console.error('Token 解析失败', error);
    }
}, [token]);
```

### 2. 检查 refresh token 机制

确保 `useTokenRefresh` 正确工作：
- 在 token 过期前自动刷新
- 启动时可通过 refresh cookie 恢复登录态
- 本地 token 过期时先 refresh，失败后再退出
- 刷新失败时提示用户重新登录
- 跨标签页同步 token 更新

### 3. 添加 token 验证中间件

在客户端发送请求前验证 token：

```typescript
// src/services/matchApi.ts
const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('未登录');
    }
    
    // 可选：验证 token 格式
    try {
        const decoded = jwt.decode(token);
        if (!decoded?.exp || decoded.exp * 1000 < Date.now()) {
            throw new Error('Token 已过期');
        }
    } catch (error) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        throw new Error('Token 无效，请重新登录');
    }
    
    return {
        Authorization: `Bearer ${token}`
    };
};
```

## 常见问题

### Q: 为什么我刚登录就提示 token 过期？

A: 可能原因：
1. 服务器时间与客户端时间不同步
2. JWT_SECRET 不一致
3. Token 签发时 `expiresIn` 配置错误

### Q: 为什么有时候能创建房间，有时候不能？

A: 可能原因：
1. Token 刚好在临界点过期
2. 多个浏览器标签页，某个标签页的 token 被刷新，其他标签页未同步
3. 网络问题导致 refresh token 请求失败

### Q: 如何延长 token 有效期？

A: 修改 `apps/api/src/modules/auth/auth.service.ts`：

```typescript
const JWT_EXPIRES_IN = '90d'; // 从 30 天改为 90 天
```

注意：延长有效期会增加安全风险，建议配合 refresh token 机制使用。

## 相关文件

- `apps/api/src/modules/auth/auth.service.ts` - JWT 签发逻辑
- `server.ts` - 游戏服务器 token 验证
- `src/contexts/AuthContext.tsx` - 客户端 token 管理
- `src/hooks/useTokenRefresh.ts` - Token 自动刷新
- `src/services/matchApi.ts` - API 请求封装
- `src/components/lobby/GameDetailsModal.tsx` - 创建房间逻辑
