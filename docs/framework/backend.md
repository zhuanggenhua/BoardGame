---
description: 后端框架封装说明（避免重复造轮子）
---

# 后端框架封装说明

> 目标：明确后端已有的「框架级封装」与复用入口，避免重复造轮子。

## 1. 架构总览（实际代码结构）

```
apps/api/src/main.ts         # 认证 + 社交服务入口（NestJS）
apps/api/src/app.module.ts   # Nest 应用模块
apps/api/src/modules/        # Auth/Friend/Message/Invite/Health 模块
├── auth/             # 认证
├── friend/           # 好友
├── health/           # 健康检查
├── invite/           # 邀请
├── message/          # 消息
└── review/           # 审核/反馈
apps/api/src/gateways/       # 社交 Socket 网关
└── social.gateway.ts # 社交 Socket 网关实现
apps/api/src/shared/         # 公用模块（DTO/工具/中间件）
├── decorators/       # 装饰器
├── dtos/             # DTO 定义
├── filters/          # 异常过滤器
├── guards/           # 鉴权守卫
└── i18n.ts           # 服务端 i18n
server.ts                    # 游戏服务入口（Boardgame.io + Lobby Socket）
src/server/
├── db.ts                    # MongoDB 连接封装
├── email.ts                 # 邮件发送封装（NestJS 复用）
├── i18n.ts                  # 服务端 i18n（读取 public/locales/*/server.json）
├── storage/                 # Boardgame.io 存储适配器
│   └── MongoStorage.ts      # MongoDB 持久化 + TTL
└── models/
    └── MatchRecord.ts       # 对局归档模型
```

## 2. 端口与入口

- **开发入口**：`http://localhost:5173`（同域代理详见 `docs/deploy.md`）
- **游戏服务**：`18000`（`GAME_SERVER_PORT`）
- **认证/社交服务**：`18001`（`API_SERVER_PORT`，前缀 `/auth`）
- **MongoDB**：`27017`

## 3. 数据库

- 服务端通过 `MONGO_URI` 连接数据库
- Docker 环境默认使用 `mongodb://mongodb:27017/boardgame`

## 4. 环境变量

- `GAME_SERVER_PORT`：游戏服务端口
- `API_SERVER_PORT`：认证服务端口
- `MONGO_URI`：Mongo 连接串
- `JWT_SECRET`：JWT 密钥（生产必须改）
- `USE_PERSISTENT_STORAGE`：是否启用 Mongo 持久化存储（`true` 启用）
- `LOCALES_DIR`：服务端 i18n 目录（默认 `public/locales`）

## 5. 已封装的服务层能力

- **认证/社交服务（NestJS）**
  - 入口：`apps/api/src/main.ts`
  - 模块：`apps/api/src/modules/*`
  - Socket.IO：`apps/api/src/gateways/social.gateway.ts`

- **游戏服务（Boardgame.io Server）**
  - 入口：`server.ts`
  - 服务端游戏注册：基于 `src/games/manifest.server.ts`（`GAME_SERVER_MANIFEST`）
  - 比赛归档：`MatchRecord` + `archiveMatchResult`
  - 持久化存储：`src/server/storage/MongoStorage.ts`（TTL + `USE_PERSISTENT_STORAGE`）

- **大厅实时通信（Socket.IO）**
  - 服务端：`server.ts` 内的 Lobby Socket（`/lobby-socket`）
  - 客户端：`src/services/lobbySocket.ts`
  - 使用方式：订阅/取消订阅大厅更新 + 心跳

- **数据库封装**
  - 统一连接：`src/server/db.ts`
  - Mongoose 模型：`src/server/models/`

- **服务端 i18n**
  - 入口：`src/server/i18n.ts`
  - 资源：`public/locales/<lang>/server.json`（可用 `LOCALES_DIR` 覆盖）

## 6. 何时扩展“框架”层（后端）

- **跨服务复用**（认证/游戏/大厅通用） → 放 `src/server/` 目录下封装模块
- **仅游戏服务内部使用** → 放 `server.ts` 附近的私有逻辑
- **数据层复用** → 放 `src/server/models/`

## 7. 扩展入口清单

- **新增 API 服务**：在 `apps/api/src/modules/` 内新增模块
- **新增路由模块**：通过 NestJS Controller 暴露
- **新增数据模型**：`src/server/models/<Model>.ts`

## 8. 相关文档

- **部署与同域策略**：`docs/deploy.md`
- **测试模式（调试面板）**：`docs/test-mode.md`
- **工具脚本**：`docs/tools.md`

> ✅ 所有新增封装必须优先复用现有基础设施（DB、JWT、Socket.IO 机制）。
