# 社交中心系统实现任务

> **开发流程**：后端先行 → 接口文档 → 前端实现

---

# Phase 1: 后端实现

## 1. NestJS 基础架构

- [ ] 1.1 初始化 NestJS API 应用 (`apps/api`)
- [ ] 1.2 配置环境变量与启动脚本（API 端口 18001）
- [ ] 1.3 集成 MongoDB 连接与基础配置
- [ ] 1.4 集成 Redis 缓存模块（`@nestjs/cache-manager` + `cache-manager-redis-store`）
- [ ] 1.5 创建通用基础设施（Guards/Decorators/Filters/DTOs）

## 2. Auth 模块迁移

- [ ] 2.1 迁移注册接口 `POST /auth/register`
- [ ] 2.2 迁移登录接口 `POST /auth/login`
- [ ] 2.3 迁移获取当前用户 `GET /auth/me`
- [ ] 2.4 迁移邮箱验证码发送 `POST /auth/send-email-code`（验证码存 Redis）
- [ ] 2.5 迁移邮箱验证 `POST /auth/verify-email`
- [ ] 2.6 新增登出接口 `POST /auth/logout`（JWT 黑名单）
- [ ] 2.7 编写 Auth 模块测试用例（Jest + Supertest）
- [ ] 2.8 验证与现有前端兼容（接口路径/响应格式）
- [ ] 2.9 编写接口文档 `docs/api/auth.md`

## 3. Friend 模块（好友系统）

- [ ] 3.1 创建 Friend Schema（`user`, `friend`, `status`, `createdAt`）
- [ ] 3.2 创建索引 `{ user: 1, friend: 1 }` 唯一复合索引
- [ ] 3.3 实现 `GET /auth/friends` 获取好友列表（含在线状态）
- [ ] 3.4 实现 `POST /auth/friends/request` 发送好友请求
- [ ] 3.5 实现 `POST /auth/friends/accept/:id` 接受好友请求
- [ ] 3.6 实现 `POST /auth/friends/reject/:id` 拒绝好友请求
- [ ] 3.7 实现 `DELETE /auth/friends/:id` 删除好友
- [ ] 3.8 实现 `GET /auth/friends/search?q=` 搜索用户
- [ ] 3.9 实现 `GET /auth/friends/requests` 获取待处理好友请求
- [ ] 3.10 编写 Friend 模块测试用例（Jest + Supertest）
- [ ] 3.11 编写接口文档 `docs/api/friend.md`

## 4. Message 模块（消息系统）

- [ ] 4.1 创建 Message Schema（`from`, `to`, `content`, `type`, `read`, `createdAt`）
- [ ] 4.2 创建索引 `{ from: 1, to: 1, createdAt: -1 }` 和 `{ to: 1, read: 1 }`
- [ ] 4.3 实现 `GET /auth/messages/conversations` 获取会话列表
- [ ] 4.4 实现 `GET /auth/messages/:userId` 获取与某用户的消息历史
- [ ] 4.5 实现 `POST /auth/messages/send` 发送消息
- [ ] 4.6 实现 `POST /auth/messages/read/:userId` 标记已读
- [ ] 4.7 实现未读消息计数 Redis 缓存
- [ ] 4.8 编写 Message 模块测试用例（Jest + Supertest）
- [ ] 4.9 编写接口文档 `docs/api/message.md`

## 5. Invite 模块（游戏邀请）

- [ ] 5.1 实现 `POST /auth/invites/send` 发送游戏邀请（通过消息系统）
- [ ] 5.2 编写接口文档 `docs/api/invite.md`

## 6. Social Gateway（实时通信）

- [ ] 6.1 创建 Social Gateway (`apps/api/src/gateways/social.gateway.ts`)
- [ ] 6.2 注册 `/social-socket` 命名空间
- [ ] 6.3 实现在线状态 Redis 存储（连接时 SET，断开时 DEL，心跳续期）
- [ ] 6.4 实现好友上/下线广播事件
- [ ] 6.5 实现消息实时推送事件
- [ ] 6.6 实现好友请求通知事件
- [ ] 6.7 实现游戏邀请通知事件
- [ ] 6.8 补充 WebSocket 事件文档到 `docs/api/README.md`

## 7. User 模型扩展

- [ ] 7.1 User Schema 新增 `lastOnline` 字段
- [ ] 7.2 User Schema 新增 `avatar` 字段（可选，预留）
- [ ] 7.3 更新 `GET /auth/me` 返回新字段

## 8. 后端集成验证

- [ ] 8.1 运行全部后端测试用例 `npm run test`
- [ ] 8.2 启动 NestJS 服务，验证所有 API 可访问
- [ ] 8.3 验证现有前端登录/注册流程正常
- [ ] 8.4 验证 WebSocket 连接与事件推送
- [ ] 8.5 合并 Web + NestJS 为单体部署（game-server 继续独立）

---

# Phase 2: 前端实现

## 9. 前端基础设施

- [ ] 9.1 创建客户端 `socialSocket.ts` (`src/services/socialSocket.ts`)
- [ ] 9.2 创建 `SocialContext.tsx` 全局社交状态管理
- [ ] 9.3 更新 `AuthContext` 确保返回 `lastOnline` 等新字段

## 10. 好友系统前端

- [ ] 10.1 实现好友列表组件 (`src/components/social/FriendList.tsx`)
- [ ] 10.2 实现用户搜索组件 (`src/components/social/UserSearch.tsx`)
- [ ] 10.3 实现好友请求组件 (`src/components/social/FriendRequests.tsx`)
- [ ] 10.4 实现在线状态指示器组件

## 11. 消息系统前端

- [ ] 11.1 实现会话列表组件 (`src/components/social/ConversationList.tsx`)
- [ ] 11.2 实现聊天窗口组件 (`src/components/social/ChatWindow.tsx`)
- [ ] 11.3 实现消息气泡组件
- [ ] 11.4 实现未读消息红点 Badge
- [ ] 11.5 实现消息输入框与发送

## 12. 双入口与社交模态窗口

- [ ] 12.1 实现头像下拉菜单 `UserMenu`（好友与聊天 / 对战记录）
- [ ] 12.2 在 `GameHUD` 悬浮球展开窗口增加"好友与聊天"入口
- [ ] 12.3 实现 `FriendsChatModal`（左侧好友/会话列表，右侧聊天窗口）
- [ ] 12.4 实现 `MatchHistoryModal`（对战记录分页列表）
- [ ] 12.5 头像入口与悬浮球入口共享未读红点与数量
- [ ] 12.6 对战记录仅通过头像下拉打开

## 13. 游戏邀请前端

- [ ] 13.1 实现邀请消息类型渲染
- [ ] 13.2 实现邀请接受跳转逻辑
- [ ] 13.3 在好友列表添加"邀请入局"按钮

---

# Phase 3: 联调验证

## 14. 手动联调验证

- [ ] 14.1 联调好友添加/删除流程
- [ ] 14.2 联调消息发送/接收流程
- [ ] 14.3 联调游戏邀请流程
- [ ] 14.4 测试多端在线状态同步
- [ ] 14.5 测试好友与聊天窗口 / 对战记录模态在不同页面的行为
- [ ] 14.6 验证单体部署下 Web + API 访问与 game-server 独立运行

---

## 依赖关系

```
Phase 1 (后端):
1.x (基础架构) → 2.x (Auth) → 3.x (Friend) → 4.x (Message) → 5.x (Invite)
                                        ↓
                         6.x (Gateway) ← 3.x + 4.x + 5.x
                                        ↓
                         7.x (User 扩展) → 8.x (后端验证)

Phase 2 (前端):
9.x (基础设施) → 10.x (好友) + 11.x (消息) → 12.x (模态窗口) → 13.x (邀请)

Phase 3 (测试):
14.x ← Phase 1 + Phase 2 全部完成
```

## 接口文档产出

| 完成阶段 | 文档文件 |
|----------|----------|
| 2.9 | `docs/api/auth.md` |
| 3.11 | `docs/api/friend.md` |
| 4.9 | `docs/api/message.md` |
| 5.2 | `docs/api/invite.md` |
| 6.8 | `docs/api/README.md` (补充 WebSocket 事件) |

## 可并行任务

- Phase 1: 3.x 和 4.x 可在 2.x 完成后并行开发
- Phase 2: 10.x 和 11.x 可在 9.x 完成后并行开发
