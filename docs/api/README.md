# API 接口文档

> 本目录包含所有后端 API 的接口文档

## 文档索引

| 模块 | 文件 | 说明 |
|------|------|------|
| 认证 | [auth.md](auth.md) | 注册、登录、JWT、邮箱验证 |
| 好友 | [friend.md](friend.md) | 好友添加/删除/搜索、在线状态 |
| 消息 | [message.md](message.md) | 私聊消息、会话列表 |
| 邀请 | [invite.md](invite.md) | 游戏邀请 |
| 评论 | [review.md](review.md) | 游戏评论、好评率统计 |
| 后台管理 | [admin.md](admin.md) | 用户管理、对局记录、统计数据 |

## 通用约定

### 基础 URL
- **开发环境**: `http://localhost:18001`
- **生产环境**: 与 Web 同域（单体部署）

### 认证方式
所有需认证的接口需在请求头携带 JWT：
```
Authorization: Bearer <token>
```

### 分页参数
列表接口统一使用以下分页参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码（从 1 开始） |
| limit | number | 50 | 每页数量（最大 100） |

### 分页响应格式
```typescript
interface PaginatedResponse<T> {
  items: T[];      // 数据列表
  page: number;    // 当前页码
  limit: number;   // 每页数量
  total: number;   // 总数
  hasMore: boolean; // 是否有更多
}
```

### 错误响应格式
```typescript
interface ErrorResponse {
  statusCode: number;  // HTTP 状态码
  message: string;     // 错误信息
  error?: string;      // 错误类型
}
```

### 常见状态码
| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 冲突（如用户名已存在） |
| 500 | 服务器错误 |

## 实时通信

### WebSocket 端点
| 端点 | 说明 |
|------|------|
| `/lobby-socket` | 大厅广播（房间列表更新） |
| `/social-socket` | 社交消息推送（好友状态、消息通知） |

### Social Socket 认证
连接时在握手信息中携带 JWT：
```
Authorization: Bearer <token>
```
或在 socket.io 的 `auth.token` 字段中传入。

### Social Socket 事件
客户端 → 服务端：
- `social:heartbeat` 心跳续期在线状态

服务端 → 客户端：
- `social:friendOnline` 好友上线 `{ userId }`
- `social:friendOffline` 好友离线 `{ userId }`
- `social:friendRequest` 新好友请求 `{ id, fromUser }`
- `social:newMessage` 新消息 `{ id, fromUser, content, type, inviteData, createdAt }`
- `social:gameInvite` 游戏邀请 `{ id, fromUser, content, type, inviteData, createdAt }`
