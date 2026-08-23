# 后台管理 API

本文是后台 API 的维护索引，不再复制大段请求 / 响应样例。精确 DTO 与返回结构以源码为准：

| 模块 | 主源 |
| --- | --- |
| 后台核心、统计、用户、房间、对局、UGC、移动发布 | [`admin.controller.ts`](../../apps/api/src/modules/admin/admin.controller.ts) |
| 游戏更新日志 | [`game-changelog.controller.ts`](../../apps/api/src/modules/game-changelog/game-changelog.controller.ts) |
| 通知 | [`notification.controller.ts`](../../apps/api/src/modules/notification/notification.controller.ts) |
| 反馈 | [`feedback.controller.ts`](../../apps/api/src/modules/feedback/feedback.controller.ts) |
| 赞助 | [`sponsor.controller.ts`](../../apps/api/src/modules/sponsor/sponsor.controller.ts) |

## 权限

| 权限 | 现实含义 |
| --- | --- |
| 公开 | 不需要登录，或登录后只补充当前用户可管理标记 |
| 登录用户 | 需要有效 JWT |
| `admin` | 后台管理员 |
| `developer` | 仅可操作自己被分配到的游戏范围 |
| 可管理范围 | 普通用户仅自己的反馈；developer 仅自己或负责游戏；admin 不限游戏 |

需要登录的接口在请求头传：

```http
Authorization: Bearer <token>
```

通用分页仍沿用 [`README`](README.md) 的 `page / limit / total / hasMore` 口径。

## 统计与测试

| 方法 | 路径 | 权限 | 关键参数 / 用途 |
| --- | --- | --- | --- |
| GET | `/admin-api/stats` | 公开 | 平台总用户、今日用户、总对局、在线和活跃统计 |
| GET | `/admin-api/stats/trend` | 公开 | `days=7|30`，每日新增用户、每日对局和游戏分布 |
| GET | `/admin-api/stats/retention` | `admin` | 留存数据 |
| GET | `/admin-api/stats/activity-tiers` | `admin` | 用户活跃层级 |
| GET | `/admin-api/test-latency` | `admin` | 当前后台测试延迟配置 |
| PATCH | `/admin-api/test-latency` | `admin` | 更新测试延迟配置 |

## 用户

| 方法 | 路径 | 权限 | 关键参数 / 用途 |
| --- | --- | --- | --- |
| GET | `/admin-api/users` | `admin` | `page`、`limit`、`search`、`role`、`banned` |
| GET | `/admin-api/users/:id` | `admin` | 用户详情和对局摘要 |
| PATCH | `/admin-api/users/:id/role` | `admin` | `role`、`developerGameIds`；不能改自己角色，至少保留一个管理员 |
| POST | `/admin-api/users/:id/ban` | `admin` | `reason` 必填；不能封禁管理员 |
| POST | `/admin-api/users/:id/unban` | `admin` | 解封用户 |
| DELETE | `/admin-api/users/:id` | `admin` | 硬删除用户；不能删除管理员，对局记录匿名化 |
| POST | `/admin-api/users/bulk-delete` | `admin` | `ids[]` 批量删除 |

## 房间与对局

| 方法 | 路径 | 权限 | 关键参数 / 用途 |
| --- | --- | --- | --- |
| GET | `/admin-api/rooms` | `admin` | `page`、`limit`、`gameName` |
| DELETE | `/admin-api/rooms/:id` | `admin` | 销毁指定房间，`:id` 为 `matchID` |
| POST | `/admin-api/rooms/bulk-delete` | `admin` | `ids[]` 批量销毁房间 |
| POST | `/admin-api/rooms/bulk-delete-by-filter` | `admin` | 按筛选条件批量销毁房间 |
| GET | `/admin-api/matches` | 公开 | `page`、`limit`、`gameName`、`startDate`、`endDate` |
| GET | `/admin-api/matches/:id` | 公开 | 对局详情，`:id` 为 `matchID` |
| DELETE | `/admin-api/matches/:id` | `admin` | 删除对局记录 |
| POST | `/admin-api/matches/bulk-delete` | `admin` | `ids[]` 批量删除对局 |

## 游戏更新日志

| 方法 | 路径 | 权限 | 关键参数 / 用途 |
| --- | --- | --- | --- |
| GET | `/game-changelogs/:gameId` | 公开 | 读取指定游戏已发布更新日志 |
| GET | `/admin-api/game-changelogs` | `admin` / `developer` | `gameId` 可选；developer 只返回可管理游戏 |
| POST | `/admin-api/game-changelogs` | `admin` / `developer` | 创建更新日志 |
| PUT | `/admin-api/game-changelogs/:id` | `admin` / `developer` | 更新、发布或撤回 |
| DELETE | `/admin-api/game-changelogs/:id` | `admin` / `developer` | 删除更新日志 |

`developer` 写入时必须落在自己的 `developerGameIds` 内，否则返回无权限。

## 通知

| 方法 | 路径 | 权限 | 关键参数 / 用途 |
| --- | --- | --- | --- |
| GET | `/notifications` | 公开 | 当前有效通知，只返回 `published=true` 且未过期项 |
| GET | `/notifications/read-state` | 登录用户 | 当前用户最后已读时间 |
| POST | `/notifications/read-state` | 登录用户 | `seenAt` 可选；不传则使用当前时间 |
| GET | `/admin-api/notifications` | `admin` | 全部通知，含草稿和过期项 |
| POST | `/admin-api/notifications` | `admin` | `title`、`content`、`expiresAt?`、`published?` |
| PUT | `/admin-api/notifications/:id` | `admin` | 所有字段可选 |
| DELETE | `/admin-api/notifications/:id` | `admin` | 删除通知 |

## 反馈

| 方法 | 路径 | 权限 | 关键参数 / 用途 |
| --- | --- | --- | --- |
| POST | `/feedback` | 公开 / 登录用户 | 创建反馈；登录用户会绑定用户 ID，匿名用户按匿名反馈处理 |
| POST | `/internal/feedback/system` | 内部 token | 创建系统反馈 |
| GET | `/admin-api/feedback` | 公开可读 | `page`、`limit`、`status`、`type`、`severity`、`sort`、`preferMine`、`mineOnly`、`summaryOnly` |
| GET | `/admin-api/feedback/:id` | 公开可读 | 读取单条反馈完整内容；登录后额外返回是否可管理 |
| PATCH | `/admin-api/feedback/:id/status` | 可管理范围 | 更新状态 |
| DELETE | `/admin-api/feedback/:id` | 可管理范围 | 删除单条反馈 |
| POST | `/admin-api/feedback/bulk-delete` | 可管理范围 | 按 `ids[]` 批量删除 |
| POST | `/admin-api/feedback/bulk-delete-by-filter` | 可管理范围 | 按筛选条件批量删除 |

`summaryOnly=true` 时，列表不会返回完整 `content`、`actionLog` 和 `stateSnapshot`，只返回预览和附件布尔标记；单条详情接口负责懒加载完整内容。

## UGC 包

| 方法 | 路径 | 权限 | 关键参数 / 用途 |
| --- | --- | --- | --- |
| GET | `/admin-api/ugc/packages` | `admin` | 后台查询 UGC 包 |
| POST | `/admin-api/ugc/packages/:packageId/unpublish` | `admin` | 取消发布 |
| DELETE | `/admin-api/ugc/packages/:packageId` | `admin` | 删除包和关联资源 |

## 移动发布

| 方法 | 路径 | 权限 | 用途 |
| --- | --- | --- | --- |
| GET | `/admin-api/mobile-release/android/ota/status` | `admin` | Android OTA 状态，`channel=stable|gray|edge` |
| GET | `/admin-api/mobile-release/android/status` | `admin` | Android native / 游戏包状态，`channel=stable|gray|edge` |
| POST | `/admin-api/mobile-release/android/ota/publish` | `admin` | 发布 Android OTA |
| POST | `/admin-api/mobile-release/android/native/publish` | `admin` | 发布 Android native 包 |
| POST | `/admin-api/mobile-release/android/packages/publish` | `admin` | 发布 Android 游戏包 |
| POST | `/admin-api/mobile-release/deploy/rollback/preview` | `admin` | 预览部署回滚 |
| POST | `/admin-api/mobile-release/deploy/rollback/execute` | `admin` | 执行部署回滚 |
| POST | `/admin-api/mobile-release/deploy/update/preview` | `admin` | 预览部署更新 |
| POST | `/admin-api/mobile-release/deploy/update/execute` | `admin` | 执行部署更新 |
| GET | `/admin-api/mobile-release/deploy/jobs/:jobId` | `admin` | 查询部署任务 |

发布操作的参数以 [`mobile-release.dto.ts`](../../apps/api/src/modules/admin/dtos/mobile-release.dto.ts) 为准；发布流程文档看 [`mobile-release`](../mobile-release.md) 和 [`android-app-build`](../android-app-build.md)。

## 赞助

| 方法 | 路径 | 权限 | 用途 |
| --- | --- | --- | --- |
| GET | `/sponsors` | 公开 | 前台赞助列表 |
| GET | `/admin-api/sponsors` | `admin` | 后台赞助列表 |
| POST | `/admin-api/sponsors` | `admin` | 新增赞助 |
| PATCH | `/admin-api/sponsors/:id` | `admin` | 更新赞助 |
| DELETE | `/admin-api/sponsors/:id` | `admin` | 删除赞助 |

## 常见错误

| 状态 | 含义 |
| --- | --- |
| `400` | 请求参数或业务约束不满足，例如缺少封禁原因、不能操作管理员账号 |
| `401` | 登录凭证无效或缺失 |
| `403` | 当前角色或可管理范围不足 |
| `404` | 目标用户、房间、对局、反馈、通知、日志或包不存在 |

新增后台接口时，只在本文补 endpoint、权限和关键字段；长样例留在测试或源码 DTO，不再堆进文档正文。
