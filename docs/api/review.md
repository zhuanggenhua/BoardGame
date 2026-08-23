# 游戏评论 API

本文是游戏评论接口索引。精确行为以 [`review.controller.ts`](../../apps/api/src/modules/review/review.controller.ts)、[`create-review.dto.ts`](../../apps/api/src/modules/review/dtos/create-review.dto.ts) 和 [`review-query.dto.ts`](../../apps/api/src/modules/review/dtos/review-query.dto.ts) 为准。

## 路由

| 方法 | 路径 | 权限 | 请求体 / 参数 | 说明 |
| --- | --- | --- | --- | --- |
| GET | `/auth/reviews/:gameId` | 公开 | query `page`、`limit` | 获取评论列表；`limit` 默认 20，最大 50 |
| GET | `/auth/reviews/:gameId/stats` | 公开 | 路径 `gameId` | 获取好评、差评、总数和好评率 |
| GET | `/auth/reviews/:gameId/mine` | 登录用户 | 路径 `gameId` | 获取当前用户在该游戏下的评论 |
| POST | `/auth/reviews/:gameId` | 登录用户 | `isPositive`、`content` | 创建或更新当前用户评论 |
| DELETE | `/auth/reviews/:gameId` | 登录用户 | 路径 `gameId` | 删除当前用户评论 |

## 主要错误

| 状态 | 含义 |
| --- | --- |
| `400` | 缺少游戏标识、评论超过 500 字或内容命中过滤 |
| `401` | 未登录 |
| `404` | 评论不存在 |
