# 认证 API

本文是认证接口索引。精确校验逻辑以 [`auth.controller.ts`](../../apps/api/src/modules/auth/auth.controller.ts) 和 [`auth.dto.ts`](../../apps/api/src/modules/auth/dtos/auth.dto.ts) 为准。

## 约定

- Access Token 通过 `Authorization: Bearer <token>` 传入。
- Refresh Token 使用 httpOnly Cookie：`refresh_token`，path 为 `/auth`。
- `login`、`refresh`、`logout` 使用 `{ success, code, message, data }` 包装响应；其它接口多为普通 JSON 或 `{ error }`。
- Access Token 当前有效期 30 天；Refresh Token 当前有效期 180 天。

## 路由

| 方法 | 路径 | 权限 | 请求体 / 参数 | 说明 |
| --- | --- | --- | --- | --- |
| POST | `/auth/send-register-code` | 公开 | `email` | 发送注册验证码；60 秒冷却，10 分钟内最多 5 次；邮箱已注册返回 `409` 和 `suggestLogin` |
| POST | `/auth/register` | 公开 | `username`、`email`、`code`、`password` | 注册并签发 Access Token + Refresh Cookie；用户名 2-20，密码至少 4 |
| POST | `/auth/send-reset-code` | 公开 | `email` | 发送重置密码验证码；邮箱不存在返回 `404` |
| POST | `/auth/reset-password` | 公开 | `email`、`code`、`newPassword` | 校验验证码后更新密码，并撤销该用户 Refresh Token |
| POST | `/auth/login` | 公开 | `account`、`password` | 仅邮箱登录；失败也返回 200，但 `success=false` |
| POST | `/auth/refresh` | Refresh Cookie | 无 | 轮换 Refresh Token，并返回新的 Access Token |
| POST | `/auth/logout` | 登录用户 | 无 | 当前 Access Token 进黑名单；Refresh Token 同步撤销 |
| GET | `/auth/me` | 登录用户 | 无 | 当前用户、头像、后台角色、封禁状态和反馈积分 |
| POST | `/auth/send-email-code` | 登录用户 | `email` | 给当前登录用户发送绑定 / 换绑邮箱验证码 |
| POST | `/auth/verify-email` | 登录用户 | `email`、`code` | 绑定 / 更新邮箱 |
| POST | `/auth/update-username` | 登录用户 | `username` | 更新昵称并返回新 JWT |
| POST | `/auth/update-avatar` | 登录用户 | `avatar` | 更新头像 URL / 标识 |
| POST | `/auth/upload-avatar` | 登录用户 | multipart `file`，可选裁剪参数 | 上传头像；允许 jpeg / png / webp / gif，最大 5MB |
| POST | `/auth/change-password` | 登录用户 | `currentPassword`、`newPassword` | 校验旧密码后更新 |

## 主要错误

| 状态 / code | 含义 |
| --- | --- |
| `400` | 缺字段、邮箱格式错误、验证码错误 / 过期、用户名或密码长度不合法 |
| `401` | 未登录、Token 无效、旧密码错误 |
| `404` | 用户或邮箱不存在 |
| `409` | 邮箱已注册 / 已绑定 |
| `429` | 验证码发送或重置尝试过于频繁 |
| `AUTH_INVALID_EMAIL` | 登录账号不是邮箱格式 |
| `AUTH_EMAIL_NOT_REGISTERED` | 登录邮箱未注册 |
| `AUTH_INVALID_PASSWORD` | 登录密码错误 |
| `AUTH_LOGIN_LOCKED` | 登录失败次数过多，需等待 `retryAfterSeconds` |
| `AUTH_MISSING_TOKEN` / `AUTH_INVALID_TOKEN` | Refresh Token 缺失或无效 |
| `AUTH_USER_NOT_FOUND` | Refresh Token 对应用户不存在 |

## 初始化管理员

CLI 入口：`npm run init:admin -- --email=admin@example.com --password=admin1234 --username=管理员 --actor=cli`

生产环境禁止执行。CLI 按邮箱查找用户：已存在则确保 `role=admin`、`emailVerified=true`；不存在则创建管理员。

可用环境变量：`ADMIN_EMAIL`、`ADMIN_PASSWORD`、`ADMIN_USERNAME`、`ADMIN_ACTOR`、`ADMIN_ACTOR_IP`。
