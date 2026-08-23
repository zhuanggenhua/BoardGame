# 游戏邀请接口

游戏邀请通过消息系统发送。

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/auth/invites/send` | 向好友发送对局邀请 |

## 请求

需要 `Authorization: Bearer <token>`。

```json
{
  "toUserId": "<friendUserId>",
  "matchId": "<matchId>",
  "gameName": "<gameId>"
}
```

## 响应

成功返回 `201`，主体包含消息 ID、接收用户、对局 ID 和游戏 ID。

常见错误：

- `400`：参数错误。
- `401`：未登录或 token 无效。
- `403`：双方不是好友，不可邀请。
- `404`：目标用户不存在。
