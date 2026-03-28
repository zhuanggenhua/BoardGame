# Change: 添加后台管理系统

> **前置依赖**：本变更必须在 `add-social-hub` 完成后实施

## Why
项目需要一个简单的后台管理界面，用于查看用户数据、对局记录和基础统计信息。当前只能通过直接查询 MongoDB 来获取这些数据，缺少可视化管理入口。

## What Changes
- 新增后台管理页面（`/admin`）
- 新增管理员角色和权限控制（NestJS Guard + `@Roles('admin')`）
- 新增用户管理功能（列表、搜索、封禁）
- 新增对局记录查看功能
- 新增基础数据统计展示（Redis 缓存）
- 新增 NestJS Admin 模块（`/admin/*` API）

## Impact
- Affected specs: 新增 `admin-dashboard` capability
- Affected code:
  - `src/pages/admin/` - 后台页面
  - `apps/api/src/modules/user/schemas/user.schema.ts` - User Schema（新增 role/banned 字段）
  - `apps/api/src/modules/admin/` - NestJS Admin 模块（新建）
  - `apps/api/src/app.module.ts` - 注册 Admin 模块
  - `src/App.tsx` - 新增路由配置
  - `src/contexts/AuthContext.tsx` - 确保返回 role 信息
