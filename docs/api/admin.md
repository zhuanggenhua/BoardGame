# 后台管理 API

> 所有接口需要管理员权限（`role: 'admin'`）

## 概述

后台管理 API 提供平台数据的查看和管理功能，包括：
- 统计数据
- 用户管理（列表、详情、封禁）
- 对局记录查看

---

## 统计数据

### GET /admin/stats

获取平台统计数据。

**缓存**: Redis 缓存 5 分钟

**请求示例**:
```http
GET /admin/stats
Authorization: Bearer <admin_token>
```

**响应示例**:
```json
{
  "users": {
    "total": 156,
    "today": 3,
    "banned": 2
  },
  "matches": {
    "total": 1024,
    "today": 12
  },
  "games": [
    { "name": "tictactoe", "count": 800 },
    { "name": "dicethrone", "count": 224 }
  ]
}
```

**响应字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| users.total | number | 总用户数 |
| users.today | number | 今日新增用户数 |
| users.banned | number | 被封禁用户数 |
| matches.total | number | 总对局数 |
| matches.today | number | 今日对局数 |
| games | array | 各游戏对局分布 |

---

## 用户管理

### GET /admin/users

获取用户列表。

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20，最大 100 |
| search | string | 否 | 搜索关键词（用户名或邮箱） |
| banned | boolean | 否 | 筛选封禁状态 |

**请求示例**:
```http
GET /admin/users?page=1&limit=20&search=test
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
      "role": "user",
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

### GET /admin/users/:id

获取用户详情（含对局历史）。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 用户 ID |

**请求示例**:
```http
GET /admin/users/507f1f77bcf86cd799439011
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
    "role": "user",
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

### POST /admin/users/:id/ban

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
POST /admin/users/507f1f77bcf86cd799439011/ban
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

### POST /admin/users/:id/unban

解封用户。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 用户 ID |

**请求示例**:
```http
POST /admin/users/507f1f77bcf86cd799439011/unban
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

## 对局记录

### GET /admin/matches

获取对局记录列表。

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
GET /admin/matches?gameName=tictactoe&limit=10
Authorization: Bearer <admin_token>
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

### GET /admin/matches/:id

获取对局详情。

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 对局 ID (matchID) |

**请求示例**:
```http
GET /admin/matches/abc123
Authorization: Bearer <admin_token>
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
