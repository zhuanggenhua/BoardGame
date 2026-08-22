# 后台管理 API

> 默认需要 `admin` 权限；其中统计概览（`/admin-api/stats`、`/admin-api/stats/trend`）与对局记录只读接口（`GET /admin-api/matches`、`GET /admin-api/matches/:id`）对游客开放，更新日志管理接口允许 `admin` 与 `developer` 访问。`developer` 仅可访问被放行的只读能力，并仅可操作自己被分配到的游戏更新日志。

## 概述

后台管理 API 提供平台数据的查看和管理功能，包括：
- 统计数据
- 用户管理（列表、详情、角色、封禁）
- 游戏更新日志管理
- 对局记录查看

---

## 统计数据

### GET /admin-api/stats

获取平台统计数据。

> 公开只读接口，游客可访问。

**缓存**: Redis 缓存 5 分钟

**请求示例**:
```http
GET /admin-api/stats
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "totalUsers": 156,
  "todayUsers": 3,
  "bannedUsers": 2,
  "totalMatches": 1024,
  "todayMatches": 12,
  "onlineUsers": 8,
  "activeUsers24h": 32,
  "games": [
    { "name": "tictactoe", "count": 800 },
    { "name": "dicethrone", "count": 224 }
  ]
}
```

**响应字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| totalUsers | number | 总用户数 |
| todayUsers | number | 今日新增用户数 |
| bannedUsers | number | 被封禁用户数 |
| totalMatches | number | 总对局数 |
| todayMatches | number | 今日对局数 |
| onlineUsers | number | 当前在线用户数（基于 Redis 在线心跳） |
| activeUsers24h | number | 24 小时内活跃用户数（含在线/最近在线） |
| games | array | 各游戏对局分布 |

---

### GET /admin-api/stats/trend

获取最近 7/30 天每日新增用户、每日对局数与游戏分布。

> 公开只读接口，游客可访问。

**缓存**: Redis 缓存 5 分钟

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| days | number | 否 | 统计天数，可选 7 或 30，默认 7 |

**请求示例**:
```http
GET /admin-api/stats/trend?days=30
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "days": 7,
  "startDate": "2026-01-19T00:00:00.000Z",
  "endDate": "2026-01-25T23:59:59.999Z",
  "dailyUsers": [
    { "date": "2026-01-19", "count": 2 },
    { "date": "2026-01-20", "count": 0 }
  ],
  "dailyMatches": [
    { "date": "2026-01-19", "count": 1 },
    { "date": "2026-01-20", "count": 0 }
  ],
  "games": [
    { "name": "tictactoe", "count": 5 }
  ]
}
```

**响应字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| days | number | 统计天数 |
| startDate | string | 起始日期（ISO 8601） |
| endDate | string | 结束日期（ISO 8601） |
| dailyUsers | array | 每日新增用户数（date=yyyy-mm-dd） |
| dailyMatches | array | 每日对局数（date=yyyy-mm-dd） |
| games | array | 统计周期内对局分布 |

---

## 用户管理

### GET /admin-api/users

获取用户列表。

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20，最大 100 |
| search | string | 否 | 搜索关键词（用户名或邮箱） |
| role | string | 否 | 角色筛选，支持 `user` / `developer` / `admin` |
| banned | boolean | 否 | 筛选封禁状态 |

**请求示例**:
```http
GET /admin-api/users?page=1&limit=20&search=test
Authorization: Bearer <admin_token>
```

**响应示例**:
```json
{
  "items": [
    {
      "id": "507f1f77bcf86cd799439011",
      "username": "testuser",
      "email": "test@example.com",
      "emailVerified": true,
      "role": "developer",
      "developerGameIds": ["smashup", "dicethrone"],
      "banned": false,
      "matchCount": 42,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "lastOnline": "2026-01-25T10:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 156,
  "hasMore": true
}
```

---

### GET /admin-api/users/:id

获取用户详情（含对局历史）。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 用户 ID |

**请求示例**:
```http
GET /admin-api/users/507f1f77bcf86cd799439011
Authorization: Bearer <admin_token>
```

**响应示例**:
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser",
    "email": "test@example.com",
    "emailVerified": true,
    "role": "developer",
    "developerGameIds": ["smashup", "dicethrone"],
    "banned": false,
    "bannedAt": null,
    "bannedReason": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "lastOnline": "2026-01-25T10:00:00.000Z"
  },
  "stats": {
    "totalMatches": 42,
    "wins": 25,
    "losses": 15,
    "draws": 2,
    "winRate": 0.595
  },
  "recentMatches": [
    {
      "matchID": "abc123",
      "gameName": "tictactoe",
      "result": "win",
      "opponent": "player2",
      "endedAt": "2026-01-24T20:00:00.000Z"
    }
  ]
}
```

---

### PATCH /admin-api/users/:id/role

更新用户角色（`user` / `developer` / `admin`）。操作会写入审计日志，仅 `admin` 可调用。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 用户 ID |

**请求体**:
```json
{
  "role": "developer",
  "developerGameIds": ["smashup", "dicethrone"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| role | string | 是 | `user` / `developer` / `admin` |
| developerGameIds | string[] | 否 | 当 `role='developer'` 时必填，表示该开发者可管理的多个游戏 |

**请求示例**:
```http
PATCH /admin-api/users/507f1f77bcf86cd799439011/role
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "developer",
  "developerGameIds": ["smashup", "dicethrone"]
}
```

**响应示例**:
```json
{
  "message": "用户角色已更新",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser",
    "role": "developer",
    "developerGameIds": ["smashup", "dicethrone"]
  },
  "changed": true
}
```

**错误响应**:
- `400` - 不能修改自己的管理员身份
- `400` - 至少需要保留一个管理员账号
- `400` - 将用户设为 `developer` 时未提供可管理游戏
- `404` - 用户不存在

---

## 游戏更新日志管理

> 以下接口允许 `admin` 与 `developer` 访问。`developer` 只能读取/写入其 `developerGameIds` 内的游戏。

### GET /admin-api/game-changelogs

获取后台可管理的更新日志列表。

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gameId | string | 否 | 按目标游戏筛选 |

**请求示例**:
```http
GET /admin-api/game-changelogs?gameId=smashup
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "items": [
    {
      "id": "507f1f77bcf86cd799439031",
      "gameId": "smashup",
      "title": "平衡性调整",
      "versionLabel": "v1.2.0",
      "content": "修正若干卡牌数值。",
      "published": true,
      "pinned": false,
      "publishedAt": "2026-03-12T10:00:00.000Z",
      "createdBy": "507f1f77bcf86cd799439001",
      "updatedBy": "507f1f77bcf86cd799439001",
      "createdAt": "2026-03-12T09:00:00.000Z",
      "updatedAt": "2026-03-12T10:00:00.000Z"
    }
  ],
  "availableGameIds": ["smashup", "dicethrone"]
}
```

**响应字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| items | array | 当前角色可管理的更新日志列表 |
| availableGameIds | string[] \| null | `developer` 返回可管理游戏列表；`admin` 返回 `null` |

---

### POST /admin-api/game-changelogs

创建更新日志。

**请求体**:
```json
{
  "gameId": "smashup",
  "title": "平衡性调整",
  "versionLabel": "v1.2.0",
  "content": "修正若干卡牌数值。",
  "published": true,
  "pinned": false
}
```

**错误响应**:
- `403` - `developer` 试图操作未分配的游戏
- `403` - 当前 `developer` 未分配任何游戏

---

### PUT /admin-api/game-changelogs/:id

更新、发布或撤回发布指定更新日志。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 更新日志 ID |

**请求体**: 所有字段可选，字段语义与创建接口一致。

**错误响应**:
- `403` - `developer` 试图修改未分配游戏的日志
- `404` - 更新日志不存在

---

### DELETE /admin-api/game-changelogs/:id

删除指定更新日志。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 更新日志 ID |

**响应示例**:
```json
{
  "deleted": true
}
```

**错误响应**:
- `403` - `developer` 试图删除未分配游戏的日志
- `404` - 更新日志不存在

---

### POST /admin-api/users/:id/ban

封禁用户。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 用户 ID |

**请求体**:
```json
{
  "reason": "违规行为"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reason | string | 是 | 封禁原因 |

**请求示例**:
```http
POST /admin-api/users/507f1f77bcf86cd799439011/ban
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "多次恶意退出对局"
}
```

**响应示例**:
```json
{
  "message": "用户已封禁",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser",
    "banned": true,
    "bannedAt": "2026-01-25T10:30:00.000Z",
    "bannedReason": "多次恶意退出对局"
  }
}
```

**错误响应**:
- `400` - 不能封禁管理员账号
- `404` - 用户不存在

---

### POST /admin-api/users/:id/unban

解封用户。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 用户 ID |

**请求示例**:
```http
POST /admin-api/users/507f1f77bcf86cd799439011/unban
Authorization: Bearer <admin_token>
```

**响应示例**:
```json
{
  "message": "用户已解封",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser",
    "banned": false,
    "bannedAt": null,
    "bannedReason": null
  }
}
```

---

### DELETE /admin-api/users/:id

硬删除用户并清理关联数据（好友关系、私信、评论），对局记录会匿名化玩家名。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 用户 ID |

**请求示例**:
```http
DELETE /admin-api/users/507f1f77bcf86cd799439011
Authorization: Bearer <admin_token>
```

**响应示例**:
```json
{
  "message": "用户已删除",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "testuser"
  }
}
```

**错误响应**:
- `400` - 不能删除管理员账号
- `404` - 用户不存在

---

## 房间管理

### GET /admin-api/rooms

获取房间列表。

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20，最大 100 |
| gameName | string | 否 | 游戏类型筛选 |

**请求示例**:
```http
GET /admin-api/rooms?gameName=tictactoe&limit=10
Authorization: Bearer <admin_token>
```

**响应示例**:
```json
{
  "items": [
    {
      "matchID": "room-1",
      "gameName": "tictactoe",
      "roomName": "测试房间",
      "ownerKey": "user:507f1f77bcf86cd799439011",
      "ownerType": "user",
      "isLocked": true,
      "players": [
        { "id": 0, "name": "player-a", "isConnected": true },
        { "id": 1, "name": "player-b", "isConnected": false }
      ],
      "createdAt": "2026-01-24T19:30:00.000Z",
      "updatedAt": "2026-01-24T20:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1,
  "hasMore": false
}
```

---

### DELETE /admin-api/rooms/:id

销毁房间。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 对局 ID (matchID) |

**请求示例**:
```http
DELETE /admin-api/rooms/room-1
Authorization: Bearer <admin_token>
```

**响应示例**:
```json
{
  "message": "房间已销毁",
  "matchID": "room-1"
}
```

**错误响应**:
- `404` - 房间不存在

---

## 对局记录

### GET /admin-api/matches

获取对局记录列表。

> 公开只读接口，游客可访问。

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20，最大 100 |
| gameName | string | 否 | 游戏类型筛选 |
| startDate | string | 否 | 开始日期（ISO 8601） |
| endDate | string | 否 | 结束日期（ISO 8601） |

**请求示例**:
```http
GET /admin-api/matches?gameName=tictactoe&limit=10
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "items": [
    {
      "matchID": "abc123",
      "gameName": "tictactoe",
      "players": [
        { "id": "0", "name": "player1", "result": "win" },
        { "id": "1", "name": "player2", "result": "loss" }
      ],
      "winnerID": "0",
      "createdAt": "2026-01-24T19:30:00.000Z",
      "endedAt": "2026-01-24T19:35:00.000Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 800,
  "hasMore": true
}
```

---

### GET /admin-api/matches/:id

获取对局详情。

> 公开只读接口，游客可访问。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 对局 ID (matchID) |

**请求示例**:
```http
GET /admin-api/matches/abc123
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "matchID": "abc123",
  "gameName": "tictactoe",
  "players": [
    {
      "id": "0",
      "name": "player1",
      "result": "win",
      "userId": "507f1f77bcf86cd799439011"
    },
    {
      "id": "1",
      "name": "player2",
      "result": "loss",
      "userId": "507f1f77bcf86cd799439012"
    }
  ],
  "winnerID": "0",
  "createdAt": "2026-01-24T19:30:00.000Z",
  "endedAt": "2026-01-24T19:35:00.000Z",
  "duration": 300
}
```

**响应字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| duration | number | 对局时长（秒） |

**错误响应**:
- `404` - 对局不存在

### DELETE /admin-api/matches/:id

删除对局记录，仅 `admin` 可用。


---

## 系统通知

### GET /notifications

获取当前有效的系统通知（公开接口，无需登录）。

只返回 `published=true` 且未过期的通知，按创建时间倒序。

**请求示例**:
```http
GET /notifications
```

**响应示例**:
```json
{
  "notifications": [
    {
      "_id": "507f1f77bcf86cd799439099",
      "title": "维护公告",
      "content": "今晚 22:00-23:00 进行系统维护",
      "published": true,
      "expiresAt": "2026-02-16T23:00:00.000Z",
      "createdAt": "2026-02-15T10:00:00.000Z",
      "updatedAt": "2026-02-15T10:00:00.000Z"
    }
  ]
}
```

---

### GET /admin-api/notifications

获取所有通知（含草稿和已过期），按创建时间倒序。需要管理员权限。

**请求示例**:
```http
GET /admin-api/notifications
Authorization: Bearer <admin_token>
```

**响应示例**:
```json
{
  "notifications": [
    {
      "_id": "507f1f77bcf86cd799439099",
      "title": "维护公告",
      "content": "今晚 22:00-23:00 进行系统维护",
      "published": true,
      "expiresAt": "2026-02-16T23:00:00.000Z",
      "createdAt": "2026-02-15T10:00:00.000Z",
      "updatedAt": "2026-02-15T10:00:00.000Z"
    }
  ]
}
```

---

### POST /admin-api/notifications

创建通知。需要管理员权限。

**请求体**:
```json
{
  "title": "维护公告",
  "content": "今晚 22:00-23:00 进行系统维护",
  "expiresAt": "2026-02-16T23:00:00.000Z",
  "published": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 通知标题 |
| content | string | 是 | 通知正文 |
| expiresAt | string | 否 | 过期时间（ISO 8601），不填则永不过期 |
| published | boolean | 否 | 是否立即发布，默认 true |

**响应示例**:
```json
{
  "notification": {
    "_id": "507f1f77bcf86cd799439099",
    "title": "维护公告",
    "content": "今晚 22:00-23:00 进行系统维护",
    "published": true,
    "expiresAt": "2026-02-16T23:00:00.000Z",
    "createdAt": "2026-02-15T10:00:00.000Z",
    "updatedAt": "2026-02-15T10:00:00.000Z"
  }
}
```

---

### PUT /admin-api/notifications/:id

更新通知。需要管理员权限。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 通知 ID |

**请求体**（所有字段可选）:
```json
{
  "title": "更新后的标题",
  "published": false
}
```

**响应示例**:
```json
{
  "notification": { ... }
}
```

**错误响应**:
- `404` - 通知不存在

---

### DELETE /admin-api/notifications/:id

删除通知。需要管理员权限。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 通知 ID |

**请求示例**:
```http
DELETE /admin-api/notifications/507f1f77bcf86cd799439099
Authorization: Bearer <admin_token>
```

**响应示例**:
```json
{
  "deleted": true
}
```

**错误响应**:
- `404` - 通知不存在

---

## 反馈管理

> `GET /admin-api/feedback` 允许匿名只读；登录后会按当前用户补充可管理范围。普通用户可配合 `mineOnly=true` 查看自己的反馈，后台角色可按权限范围查看。
> `GET /admin-api/feedback/:id` 同样允许匿名只读，用于公开查看单条反馈完整内容；响应里的 `canManage` 只表示当前登录用户是否可修改或删除该反馈，不限制读取。
> `PATCH /admin-api/feedback/:id/status`、`DELETE /admin-api/feedback/:id` 按当前用户可管理范围执行：普通用户仅限自己的反馈，developer 仅限自己或负责游戏反馈，admin 不受游戏范围限制。批量删除接口仅用于后台管理批量操作。

### GET /admin-api/feedback

获取反馈列表。

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20，最大 100 |
| status | string | 否 | 按状态筛选，支持 `open` / `in_progress` / `resolved` / `closed` |
| type | string | 否 | 按类型筛选，支持 `bug` / `suggestion` / `other` |
| severity | string | 否 | 按严重程度筛选，支持 `low` / `medium` / `high` / `critical` |
| sort | string | 否 | 时间排序，支持 `newest`（默认） / `oldest` |
| preferMine | boolean | 否 | 是否优先显示当前登录用户自己的反馈，默认 `false` |
| mineOnly | boolean | 否 | 是否只返回当前登录用户自己的反馈，默认 `false` |
| summaryOnly | boolean | 否 | 是否只返回轻量摘要，默认 `false`。后台列表和“我的反馈”推荐使用 `true`，再通过单条详情接口懒加载完整内容 |

当 `summaryOnly=true` 时，列表项不会返回完整 `content`、`actionLog`、`stateSnapshot`；会返回 `contentPreview` 和 `hasEmbeddedImage` / `hasActionLog` / `hasStateSnapshot` 等布尔标记，用于先渲染标题和附件提示。

**响应示例**:
```json
{
  "items": [
    {
      "_id": "feedback_001",
      "content": "某张卡牌效果与描述不一致",
      "type": "bug",
      "severity": "medium",
      "status": "open",
      "gameName": "smashup",
      "contactInfo": "tester@example.com",
      "clientContext": {
        "route": "/play/smashup/match/abc",
        "mode": "online",
        "matchId": "abc",
        "playerId": "0",
        "gameId": "smashup",
        "appVersion": "0.6.1",
        "appCommitSha": "abc123def456",
        "appBuildTime": "2026-06-19T10:00:00.000Z",
        "appReleaseChannel": "production",
        "lastUserAction": {
          "type": "click",
          "at": "2026-06-20T08:00:00.000Z",
          "target": { "tagName": "button", "testId": "confirm-play" }
        },
        "recentUserActions": [
          { "type": "pointerdown", "at": "2026-06-20T07:59:59.000Z" },
          { "type": "click", "at": "2026-06-20T08:00:00.000Z" }
        ],
        "lastRouteChange": {
          "from": "/play/smashup/match/abc?seat=0",
          "to": "/play/smashup/match/abc?seat=0&step=confirm",
          "trigger": "pushState",
          "at": "2026-06-20T08:00:01.000Z"
        },
        "pageFlags": {
          "isGamePage": true,
          "gameId": "smashup"
        }
      },
      "errorContext": {
        "name": "TypeError",
        "message": "Cannot read properties of undefined",
        "source": "react.error_boundary",
        "jsStack": "TypeError: ...",
        "componentStack": "at CardPanel"
      },
      "createdAt": "2026-03-14T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "page": 1
}
```

### GET /admin-api/feedback/:id

获取单条反馈完整详情。该接口是公开只读接口，允许匿名用户按反馈 ID 查看完整正文、内嵌截图、操作日志和状态快照；登录用户会额外得到当前账号是否可管理该反馈的 `canManage` 标记。用于列表已用 `summaryOnly=true` 时，点击或选中单条反馈后再加载完整内容。

**响应示例**:
```json
{
  "_id": "feedback_001",
  "content": "某张卡牌效果与描述不一致",
  "type": "bug",
  "severity": "medium",
  "status": "open",
  "gameName": "smashup",
  "actionLog": "[12:00] P1: play card",
  "stateSnapshot": "{\"gameId\":\"smashup\"}",
  "canManage": true,
  "createdAt": "2026-03-14T10:00:00.000Z"
}
```

### PATCH /admin-api/feedback/:id/status

更新反馈状态，按当前用户可管理范围执行。

**请求体**:
```json
{
  "status": "resolved"
}
```

### DELETE /admin-api/feedback/:id

删除单条反馈，按当前用户可管理范围执行。普通用户只能删除自己提交的反馈。

### POST /admin-api/feedback/bulk-delete

按 ID 批量删除反馈，按当前用户可管理范围执行。

### POST /admin-api/feedback/bulk-delete-by-filter

按筛选条件批量删除反馈，按当前用户可管理范围执行。
