# 游戏评论接口

> 负责游戏评论的增删改查与好评率统计。

## 1. 获取游戏评论列表

**GET** `/auth/reviews/:gameId?page=1&limit=20`

### 请求参数
- `gameId`: 游戏标识
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20，最大 50）

### 成功响应（200）
```json
{
  "items": [
    {
      "id": "评论ID",
      "user": {
        "id": "用户ID",
        "username": "玩家名",
        "avatar": null
      },
      "isPositive": true,
      "content": "很好玩",
      "createdAt": "2026-01-25T10:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 12,
  "hasMore": false
}
```

### 常见错误
- 400 缺少游戏标识

---

## 2. 获取好评率统计

**GET** `/auth/reviews/:gameId/stats`

### 成功响应（200）
```json
{
  "gameId": "dicethrone",
  "positive": 10,
  "negative": 2,
  "total": 12,
  "rate": 83
}
```

### 常见错误
- 400 缺少游戏标识

---

## 3. 获取我的评论

**GET** `/auth/reviews/:gameId/mine`

### 请求头
```
Authorization: Bearer <token>
```

### 成功响应（200）
```json
{
  "id": "评论ID",
  "user": {
    "id": "用户ID",
    "username": "玩家名",
    "avatar": null
  },
  "isPositive": true,
  "content": "很好玩",
  "createdAt": "2026-01-25T10:00:00.000Z"
}
```

### 常见错误
- 400 缺少游戏标识
- 401 未登录

---

## 4. 创建/更新评论

**POST** `/auth/reviews/:gameId`

### 请求头
```
Authorization: Bearer <token>
```

### 请求体
```json
{
  "isPositive": true,
  "content": "很好玩"
}
```

### 成功响应（201）
```json
{
  "message": "评论已保存",
  "review": {
    "id": "评论ID",
    "user": {
      "id": "用户ID",
      "username": "玩家名",
      "avatar": null
    },
    "isPositive": true,
    "content": "很好玩",
    "createdAt": "2026-01-25T10:00:00.000Z"
  }
}
```

### 常见错误
- 400 评论内容超过 500 字
- 400 内容包含违规词汇
- 401 未登录

---

## 5. 删除评论

**DELETE** `/auth/reviews/:gameId`

### 请求头
```
Authorization: Bearer <token>
```

### 成功响应（200）
```json
{
  "message": "评论已删除"
}
```

### 常见错误
- 400 缺少游戏标识
- 401 未登录
- 404 评论不存在
