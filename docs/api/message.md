# 消息 API

本文是私聊接口索引。精确行为以 [`message.controller.ts`](../../apps/api/src/modules/message/message.controller.ts) 和 [`message.dto.ts`](../../apps/api/src/modules/message/dtos/message.dto.ts) 为准。

所有接口都需要 `Authorization: Bearer <token>`。

## 路由

| 方法 | 路径 | 请求体 / 参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/auth/messages/conversations` | 无 | 获取会话列表，包含最近一条消息和未读数 |
| GET | `/auth/messages/:userId` | query `page`、`limit` | 获取与目标用户的消息历史；默认分页口径见 [`README`](README.md) |
| POST | `/auth/messages/send` | `toUserId`、`content`、可选 `type` | 发送文本消息或邀请消息 |
| POST | `/auth/messages/read/:userId` | 路径 `userId` | 将与目标用户的消息标记已读 |

## 邀请消息

发送邀请时 `type` 为 `invite`，`content` 必须是 JSON 字符串，并至少包含：

```json
{ "matchId": "<matchId>", "gameName": "<gameName>" }
```

## 主要错误

| 状态 | 含义 |
| --- | --- |
| `400` | 参数错误、目标用户无效，或邀请数据不是合法 JSON |
| `401` | 未登录 |
| `403` | 双方不是好友，不能查看、发送或标记已读 |
| `404` | 目标用户不存在 |
