---
description: 后端框架入口：服务边界、复用能力和扩展落点
---

# 后端框架入口

本文只记录稳定后端入口和扩展边界；精确字段、DTO 和控制器实现以源码与测试为准。

## 服务边界

| 服务 | 职责 | 入口 |
| --- | --- | --- |
| 游戏服务 | 对局运行、房间、Lobby socket、对局归档 | [`server.ts`](../../server.ts) |
| API 服务 | 认证、社交、后台、反馈、通知等 HTTP / Socket 能力 | [`apps/api/src/main.ts`](../../apps/api/src/main.ts) |
| 数据与存储 | Mongo 连接、对局记录、持久化适配 | [`src/server/`](../../src/server/) |
| 服务端 i18n | 服务端文案加载与语言资源 | [`src/server/i18n.ts`](../../src/server/i18n.ts) |

## 端口与环境

| 配置 | 默认 / 含义 |
| --- | --- |
| Web 开发入口 | `http://localhost:4173` |
| `GAME_SERVER_PORT` | 游戏服务端口，默认 `18000` |
| `API_SERVER_PORT` | API 服务端口，默认 `18001` |
| `MONGO_URI` | Mongo 连接串；Docker 默认 `mongodb://mongodb:27017/boardgame` |
| `JWT_SECRET` | JWT 密钥，生产环境必须显式配置 |
| `USE_PERSISTENT_STORAGE` | `true` 启用 Mongo 持久化；`false` 使用内存存储 |
| `LOCALES_DIR` | 服务端 i18n 目录，默认 `public/locales` |

`USE_PERSISTENT_STORAGE=false` 用于本地轻量复现和 E2E 临时起服：游戏房间只在进程内保存，重启即丢；依赖 Mongo 的 UGC、排行榜和归档能力会降级或返回空结果。

## 复用能力

| 能力 | 入口 | 何时查 |
| --- | --- | --- |
| Nest 模块与 controller | [`apps/api/src/modules/`](../../apps/api/src/modules/) | 新增或排查 HTTP API |
| 社交 Socket | [`apps/api/src/gateways/social.gateway.ts`](../../apps/api/src/gateways/social.gateway.ts) | 好友、私聊、邀请推送 |
| 大厅 Socket | [`server.ts`](../../server.ts) 与 [`src/services/lobbySocket.ts`](../../src/services/lobbySocket.ts) | 房间列表和大厅心跳 |
| 游戏注册 | [`src/games/manifest.server.ts`](../../src/games/manifest.server.ts) | 服务端可运行游戏清单 |
| Mongo 连接 | [`src/server/db.ts`](../../src/server/db.ts) | 数据库连接与本地降级 |
| 对局归档 | [`src/server/models/MatchRecord.ts`](../../src/server/models/MatchRecord.ts) | 结束对局记录与历史查询 |
| 邮件发送 | [`src/server/email.ts`](../../src/server/email.ts) | 邮件通知或验证码 |

新增后端能力先查表中入口；已有能力能扩展时，不新建第二套连接、鉴权、socket 或存储封装。

## 扩展落点

| 需求 | 落点 |
| --- | --- |
| 新增 HTTP API | `apps/api/src/modules/<domain>/` |
| 跨 API 模块复用 DTO / guard / filter / decorator | `apps/api/src/shared/` |
| 游戏服务私有逻辑 | `server.ts` 附近或 `src/server/` 内明确模块 |
| 跨游戏服务端能力 | `src/server/` |
| 数据模型 | `src/server/models/` |
| 后台管理接口 | 先看 [`docs/api/admin.md`](../api/admin.md)，再改对应 controller / DTO |

## 排查顺序

- API 返回错误：先看 controller / DTO / guard，再看 [`docs/api/`](../api/) 的端点索引。
- Socket 不推送：先确认命名空间、认证 token、订阅事件和服务端日志。
- 本地起服不依赖 Mongo：确认 `USE_PERSISTENT_STORAGE=false`，再判断相关功能是否允许降级。
- 对局没有归档：先查游戏结束回调、`MatchRecord` 写入和 Mongo 连接状态。

## 相关文档

- [`deploy.md`](../deploy.md)：部署与同域策略。
- [`debugging/test-mode.md`](../debugging/test-mode.md)：测试模式与调试入口。
- [`tools.md`](../tools.md)：项目工具脚本。
