# API 文档入口

本目录只做后端接口导航和通用约定；精确字段、校验和返回结构以 controller / DTO / 测试为准。

## 索引

| 模块 | 文件 | 主源 |
| --- | --- | --- |
| 认证 | [`auth.md`](auth.md) | `apps/api/src/modules/auth/` |
| 好友 | [`friend.md`](friend.md) | `apps/api/src/modules/social/` |
| 消息 | [`message.md`](message.md) | `apps/api/src/modules/social/` |
| 邀请 | [`invite.md`](invite.md) | `apps/api/src/modules/social/` |
| 评论 | [`review.md`](review.md) | `apps/api/src/modules/review/` |
| 后台管理 | [`admin.md`](admin.md) | `apps/api/src/modules/admin/` 和相关 controller |

## 通用约定

- 开发 API 默认端口：`http://localhost:18001`。
- 生产 API 与 Web 同域，除非部署文档另行指定。
- 需要登录的 HTTP 接口使用 `Authorization: Bearer <token>`。
- 列表接口通常使用 `page`、`limit`，返回 `items`、`page`、`limit`、`total`、`hasMore`；例外以对应接口文档或源码为准。
- 常见错误：`400` 参数错误，`401` 未登录或 token 无效，`403` 无权限，`404` 资源不存在，`409` 冲突，`500` 服务端错误。

## 实时通信

| 端点 | 用途 | 认证 |
| --- | --- | --- |
| `/lobby-socket` | 大厅房间列表更新 | 按具体事件要求 |
| `/social-socket` | 好友状态、私聊和邀请推送 | `Authorization: Bearer <token>` 或 socket.io `auth.token` |

`social-socket` 事件：

- 客户端发送：`social:heartbeat`。
- 服务端推送：`social:friendOnline`、`social:friendOffline`、`social:friendRequest`、`social:newMessage`、`social:gameInvite`。
