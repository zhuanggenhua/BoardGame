# JWT Token 过期问题诊断

## 问题描述

用户反馈创建房间时收到 401 错误：
```
Failed to create match: Error: 401: {"error":"Invalid token"}
```

用户疑问：明明设置了 30 天有效期，为什么会过期？

## 配置检查

### JWT 有效期配置

在 `apps/api/src/modules/auth/auth.service.ts` 中：

```typescript
const JWT_EXPIRES_IN = '30d'; // 30 天有效期
```

配置是正确的，token 确实应该有 30 天有效期。

### JWT_SECRET 配置

在根目录 `.env` 中：
```
JWT_SECRET=bce5d42d92d70133da7ac2742622d282a3f4df901c4cf79a189273372e827651
```

- API 服务器和游戏服务器使用相同的 JWT_SECRET ✅
- 没有发现 `apps/api/.env` 文件，所有服务使用根目录配置 ✅

## 可能原因分析

### 1. Token 真的过期了（可能性低）

虽然配置了 30 天，但如果用户确实 30 天没有登录，token 会过期。

### 2. Token 未正确传递（可能性高）

客户端代码检查：
- `GameDetailsModal.tsx` 正确从 `useAuth()` 获取 token ✅
- 正确传递 `Authorization: Bearer ${token}` 头 ✅
- 服务端正确验证 token ✅

但可能的问题：
- localStorage 中的 token 被清除
- 浏览器隐私模式/无痕模式
- 跨域问题导致 localStorage 不可用

### 3. Token 刷新机制问题（可能性中等）

项目实现了 `useTokenRefresh` hook，但可能：
- Refresh token 也过期了（也是 30 天）
- 刷新请求失败但未正确处理
- 跨标签页同步问题

### 4. 服务器时间不同步（可能性低）

如果服务器时间与客户端时间相差很大，可能导致：
- Token 签发时间异常
- 过期时间计算错误

## 诊断工具

我创建了三个诊断工具来帮助排查问题：

### 1. JWT 配置检查

```bash
npm run check:jwt
```

检查：
- 根目录 `.env` 的 JWT_SECRET
- `apps/api/.env` 的 JWT_SECRET（如果存在）
- 两者是否一致

### 2. Token 验证工具

```bash
npm run debug:token <your_token>
```

验证：
- Token 格式是否正确
- Token 签名是否有效
- Token 是否过期
- Token payload 内容

### 3. 完整诊断工具

```bash
npm run diagnose:auth <your_token>
```

执行完整诊断：
1. 检查 JWT_SECRET 配置
2. 验证 token 格式和签名
3. 检查过期时间
4. 给出具体的解决建议

## 使用方法

### 步骤 1：获取 token

在浏览器控制台（F12）执行：
```javascript
localStorage.getItem('auth_token')
```

### 步骤 2：运行诊断

```bash
npm run diagnose:auth <复制的token>
```

### 步骤 3：根据诊断结果处理

#### 如果 token 已过期
```javascript
// 在浏览器控制台执行
localStorage.removeItem('auth_token');
localStorage.removeItem('auth_user');
location.reload();
```

#### 如果 JWT_SECRET 不一致
1. 删除 `apps/api/.env`（如果存在）
2. 重启所有服务
3. 重新登录

#### 如果 token 格式错误
1. 清除浏览器缓存
2. 重新登录

## 预防措施

### 1. 监控 token 有效期

在 `AuthContext` 中添加监控（建议实现）：

```typescript
useEffect(() => {
    if (!token) return;
    
    try {
        const decoded = jwt.decode(token);
        if (decoded?.exp) {
            const remainingDays = Math.floor(
                (decoded.exp * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
            );
            
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

### 2. 优化错误提示

在 `GameDetailsModal.tsx` 中增加更友好的错误提示（建议实现）：

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
    }
}
```

### 3. 自动刷新机制

确保 `useTokenRefresh` 正确工作：
- 在 token 过期前 7 天自动刷新
- 刷新失败时提示用户重新登录
- 跨标签页同步 token 更新

## 相关文档

- `docs/troubleshooting/token-expiration.md` - 完整的排查指南
- `scripts/check-jwt-config.mjs` - JWT 配置检查工具
- `scripts/debug-token.mjs` - Token 验证工具
- `scripts/diagnose-auth.mjs` - 完整诊断工具

## 总结

JWT token 配置本身没有问题（30 天有效期），但可能由以下原因导致 401 错误：

1. **Token 确实过期**（30 天未登录）
2. **localStorage 被清除**（浏览器清理、隐私模式）
3. **Refresh token 失效**（刷新机制问题）
4. **服务器时间不同步**（罕见）

建议用户：
1. 先运行 `npm run diagnose:auth <token>` 诊断
2. 如果 token 过期，重新登录
3. 如果频繁过期，检查 refresh token 机制

建议开发者：
1. 添加 token 有效期监控
2. 优化错误提示（区分过期/无效/缺失）
3. 确保 refresh token 机制正常工作
4. 考虑延长有效期（如 90 天）或实现"记住我"功能
