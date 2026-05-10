# 认证接口

> 负责注册、登录、JWT、邮箱验证、登出、修改密码。

## 1. 注册

**POST** `/auth/register`

### 请求体
```json
{
  "username": "昵称",
  "email": "user@example.com",
  "code": "123456",
  "password": "密码"
}
```

### 成功响应（201）
```json
{
  "message": "注册成功",
  "user": {
    "id": "用户ID",
    "username": "昵称",
    "email": "user@example.com",
    "emailVerified": true
  },
  "token": "JWT Token"
}
```

### 常见错误
- 400 字段缺失
- 400 昵称长度不合法
- 400 密码长度不足
- 400 邮箱格式错误
- 400 邮箱验证码错误或过期
- 409 邮箱已存在

---

## 2. 登录（仅邮箱）

**POST** `/auth/login`

### 请求体
```json
{
  "account": "user@example.com",
  "password": "密码"
}
```

### 成功响应（200）
```json
{
  "success": true,
  "code": "AUTH_LOGIN_OK",
  "message": "登录成功",
  "data": {
    "token": "JWT Token",
    "user": {
      "id": "用户ID",
      "username": "昵称",
      "email": "user@example.com",
      "emailVerified": true
    }
  }
}
```

### 常见错误（统一 200 返回，success=false）
```json
{
  "success": false,
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "邮箱或密码错误",
  "data": {}
}
```

```json
{
  "success": false,
  "code": "AUTH_LOGIN_LOCKED",
  "message": "登录失败次数过多，请在 1800 秒后再试",
  "data": { "retryAfterSeconds": 1800 }
}
```

---

## 3. 获取当前用户

**GET** `/auth/me`

### 请求头
```
Authorization: Bearer <token>
```

### 成功响应（200）
```json
{
  "user": {
    "id": "用户ID",
    "username": "玩家名",
    "email": "user@example.com",
    "emailVerified": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### 常见错误
- 401 未登录或 Token 无效
- 404 用户不存在

---

## 4. 发送邮箱验证码

**POST** `/auth/send-email-code`

### 请求头
```
Authorization: Bearer <token>
```

### 请求体
```json
{
  "email": "user@example.com"
}
```

### 成功响应（200）
```json
{
  "message": "验证码已发送"
}
```

### 常见错误
- 400 缺少邮箱
- 400 邮箱格式错误
- 409 邮箱已被占用
- 401 未登录

---

## 5. 验证邮箱

**POST** `/auth/verify-email`

### 请求头
```
Authorization: Bearer <token>
```

### 请求体
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

### 成功响应（200）
```json
{
  "message": "邮箱绑定成功",
  "user": {
    "id": "用户ID",
    "username": "玩家名",
    "email": "user@example.com",
    "emailVerified": true
  }
}
```

### 常见错误
- 400 邮箱或验证码缺失
- 400 验证码错误或过期
- 401 未登录

---

## 6. 登出

**POST** `/auth/logout`

### 请求头
```
Authorization: Bearer <token>
```

### 成功响应（200）
```json
{
  "success": true,
  "code": "AUTH_LOGOUT_OK",
  "message": "退出登录成功",
  "data": {}
}
```

### 说明
- 登出后 Token 会写入黑名单，直到过期为止。

---

## 7. 刷新访问令牌

**POST** `/auth/refresh`

### 请求体
无需请求体，Refresh Token 来自 Cookie。

### 说明
- Access Token 当前有效期为 30 天。
- Refresh Token 通过 httpOnly Cookie 保存，当前有效期为 180 天。
- 客户端启动、页面恢复可见、或 Access Token 即将/已经过期时，会优先调用本接口续签；续签失败后才要求重新登录。

### 成功响应（200）
```json
{
  "success": true,
  "code": "AUTH_REFRESH_OK",
  "message": "令牌刷新成功",
  "data": { "token": "JWT Token" }
}
```

### 常见错误（统一 200 返回，success=false）
- `AUTH_MISSING_TOKEN` Refresh Token 缺失
- `AUTH_INVALID_TOKEN` Refresh Token 无效
- `AUTH_USER_NOT_FOUND` 用户不存在


## 8. 修改密码

**POST** `/auth/change-password`

### 请求头
```
Authorization: Bearer <token>
```

### 请求体
```json
{
  "currentPassword": "旧密码",
  "newPassword": "新密码"
}
```

### 成功响应（200）
```json
{
  "message": "密码修改成功"
}
```

### 常见错误
- 401 未登录
- 400 缺少字段
- 401 旧密码错误

---

## 9. 初始化管理员（CLI，一次性）

### 说明
- **生产环境禁止执行**，执行会写入审计日志并报错。
- CLI 会按 `email` 查找用户：
  - 已存在：不会重复创建；会确保 `role=admin`、`emailVerified=true`。
  - 不存在：创建管理员用户，`role=admin`、`emailVerified=true`。

### 使用方式
```bash
npm run init:admin -- --email=admin@example.com --password=admin1234 --username=管理员 --actor=cli
```

可用环境变量（供 CLI 读取）：
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_USERNAME`
- `ADMIN_ACTOR`
- `ADMIN_ACTOR_IP`
