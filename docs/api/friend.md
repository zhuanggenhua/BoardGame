# 好友 API

本文是好友接口索引。精确行为以 [`friend.controller.ts`](../../apps/api/src/modules/friend/friend.controller.ts) 和 [`friend.dto.ts`](../../apps/api/src/modules/friend/dtos/friend.dto.ts) 为准。

所有接口都需要 `Authorization: Bearer <token>`。

## 路由

| 方法 | 路径 | 请求体 / 参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/auth/friends` | 无 | 获取好友列表，返回 `friends` |
| GET | `/auth/friends/requests` | 无 | 获取待处理好友请求，返回 `requests` |
| GET | `/auth/friends/search` | query `q` | 搜索用户，并返回当前关系状态 |
| POST | `/auth/friends/request` | `userId` | 向目标用户发送好友请求 |
| POST | `/auth/friends/accept/:id` | 路径 `id` 为请求 ID | 接受好友请求 |
| POST | `/auth/friends/reject/:id` | 路径 `id` 为请求 ID | 拒绝好友请求 |
| DELETE | `/auth/friends/:id` | 路径 `id` 为好友用户 ID | 删除好友关系 |

## 关系状态

| 状态 | 含义 |
| --- | --- |
| `none` | 无关系 |
| `pending` | 当前用户已发送请求 |
| `incoming` | 对方已发送请求 |
| `accepted` | 已是好友 |

## 主要错误

| 状态 | 含义 |
| --- | --- |
| `400` | 缺少搜索关键词、目标用户 ID，或不能添加自己 |
| `401` | 未登录 |
| `404` | 目标用户、好友请求或好友关系不存在 |
| `409` | 已是好友、请求已存在，或对方已有待处理请求 |
