# 实现任务清单

> **前置依赖**：本任务必须在 `add-social-hub` 完成后实施（NestJS 已迁移、Redis 已接入）

## 1. 数据模型扩展（NestJS Mongoose Schema）
- [x] 1.1 User Schema 新增 `role` 字段（默认值 `user`，枚举 `user` | `admin`）
- [x] 1.2 User Schema 新增 `banned`、`bannedAt`、`bannedReason` 字段
- [x] 1.3 更新 User DTO 和 TypeScript 类型定义

## 2. NestJS Admin 模块
- [x] 2.1 创建 `apps/api/src/modules/admin/admin.module.ts`
- [x] 2.2 创建 `AdminController`（路由前缀 `/admin`）
- [x] 2.3 创建 `AdminService`（业务逻辑）
- [x] 2.4 创建 `AdminGuard`（复用 `@Roles('admin')` 装饰器）
- [x] 2.5 创建 DTO：`QueryUsersDto`、`BanUserDto`、`QueryMatchesDto`
- [x] 2.6 在 `AppModule` 注册 Admin 模块

## 3. 后端 API 实现
- [x] 3.1 GET /admin/stats（统计数据，Redis 缓存 5 分钟）
- [x] 3.2 GET /admin/users（用户列表，分页 + 搜索）
- [x] 3.3 GET /admin/users/:id（用户详情 + 对局历史）
- [x] 3.4 POST /admin/users/:id/ban（封禁用户）
- [x] 3.5 POST /admin/users/:id/unban（解封用户）
- [x] 3.6 GET /admin/matches（对局列表，分页 + 游戏/时间筛选）
- [x] 3.7 GET /admin/matches/:id（对局详情）
- [x] 3.8 编写 Admin 模块测试用例（Jest + Supertest）
- [x] 3.9 编写接口文档 `docs/api/admin.md`（已完成）

## 4. 前端页面
- [x] 4.1 创建 `AdminLayout` 组件（侧边栏 + 内容区）
- [x] 4.2 创建 `StatsCard` 组件（统计卡片）
- [x] 4.3 创建 `DataTable` 组件（通用数据表格，支持分页）
- [x] 4.4 实现后台首页 `src/pages/admin/index.tsx`（统计仪表盘）
- [x] 4.5 实现用户管理页面 `src/pages/admin/Users.tsx`
- [x] 4.6 实现用户详情页面 `src/pages/admin/UserDetail.tsx`
- [x] 4.7 实现对局记录页面 `src/pages/admin/Matches.tsx`

## 5. 路由与权限
- [x] 5.1 在 `App.tsx` 添加 `/admin/*` 路由（React.lazy 动态导入）
- [x] 5.2 创建 `AdminGuard` 前端组件（检查 user.role === 'admin'）
- [x] 5.3 更新 `AuthContext` 确保返回 role 信息

## 6. 测试与验证
- [ ] 6.1 运行 Admin 模块测试用例 `npm run test`
- [ ] 6.2 手动在 MongoDB 设置一个管理员账号（`role: 'admin'`）
- [ ] 6.3 验证非管理员访问 /admin 被拒绝（403）
- [ ] 6.4 验证管理员可正常访问所有后台功能
- [ ] 6.5 验证封禁/解封用户功能正常工作
- [ ] 6.6 验证统计数据 Redis 缓存生效

## 依赖关系

```
add-social-hub 完成 → 1.x (数据模型) → 2.x (NestJS 模块) → 3.x (API 实现)
                                                         ↓
4.x (前端页面) ← 3.x
        ↓
5.x (路由权限) ← 4.x
        ↓
6.x (测试) ← All
```

## 可并行任务

- 4.1/4.2/4.3 可在 3.x 完成后并行开发
- 4.4-4.7 可并行开发（各页面独立）
