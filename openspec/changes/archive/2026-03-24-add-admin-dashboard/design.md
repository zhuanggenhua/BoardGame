# 后台管理系统技术设计

## Context
项目是一个桌游教学与联机平台，定位为个人/小规模使用。后台需求简单：查看用户、对局记录、基础统计。

**重要前提**：本设计基于 `add-social-hub` 完成后的目标架构：
- API 服务已迁移至 NestJS（`apps/api/`）
- Redis 已接入（缓存、在线状态）
- MongoDB 数据模型已扩展（Friend/Message 等）
- 单体部署：Web + NestJS 合并，game-server 独立

## Goals / Non-Goals
**Goals:**
- 提供简洁的数据查看界面
- 支持用户封禁功能（防止恶意行为）
- 展示基础统计数据（可利用 Redis 缓存）
- 与现有前端共用技术栈（React + Tailwind）
- 与 NestJS 模块化架构保持一致

**Non-Goals:**
- 不做复杂权限系统（仅区分普通用户/管理员）
- 不做实时在线监控（复用社交系统的在线状态）
- 不做操作日志审计
- 不做内容管理（公告等）

## Decisions

### 1. 后台页面位置
**决定**: 放在现有前端项目 `src/pages/admin/` 下

**理由**:
- 项目规模小，不需要独立部署
- 复用现有组件和样式
- 与单体部署架构一致

### 2. 管理员认证
**决定**: 在 User 模型新增 `role` 字段（`user` | `admin`）

**理由**:
- 简单直接
- 复用 NestJS JWT Guard
- 通过 `@Roles('admin')` 装饰器校验权限

### 3. 后台 API（NestJS 模块）
**决定**: 在 `apps/api/src/modules/admin/` 创建 Admin 模块

**理由**:
- 与 NestJS 模块化架构一致
- 复用现有数据库连接和 Redis 缓存
- 通过路由前缀 `/admin` 隔离

### 4. 统计数据缓存
**决定**: 使用 Redis 缓存统计数据

| Key | TTL | 说明 |
|-----|-----|------|
| `admin:stats` | 5 分钟 | 首页统计数据 |
| `admin:stats:daily:{date}` | 24 小时 | 每日统计快照 |

**理由**:
- 统计聚合查询昂贵，需缓存
- 复用 `add-social-hub` 已接入的 Redis

## 数据模型变更

### User 模型扩展
```typescript
// apps/api/src/modules/user/schemas/user.schema.ts
interface IUser {
  // 现有字段（含 social-hub 新增的 lastOnline）
  role: 'user' | 'admin';  // 新增：角色
  banned: boolean;         // 新增：是否封禁
  bannedAt?: Date;         // 新增：封禁时间
  bannedReason?: string;   // 新增：封禁原因
}
```

## NestJS 模块结构

```
apps/api/src/modules/admin/
├── admin.module.ts
├── admin.controller.ts
├── admin.service.ts
├── dto/
│   ├── ban-user.dto.ts
│   └── query-users.dto.ts
└── guards/
    └── admin.guard.ts      # 复用 @Roles('admin')
```

## API 设计

### 后台 API（需管理员权限，NestJS Controller）
| Method | Path | 说明 |
|--------|------|------|
| GET | /admin/stats | 获取统计数据（Redis 缓存） |
| GET | /admin/users | 用户列表（分页、搜索） |
| GET | /admin/users/:id | 用户详情 |
| POST | /admin/users/:id/ban | 封禁用户 |
| POST | /admin/users/:id/unban | 解封用户 |
| GET | /admin/matches | 对局列表（分页、筛选） |
| GET | /admin/matches/:id | 对局详情 |

### 分页响应格式（复用 social-hub 约定）
```typescript
interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
```

## 页面结构

```
src/pages/admin/
├── index.tsx         # 后台首页（统计仪表盘）
├── Users.tsx         # 用户管理
├── UserDetail.tsx    # 用户详情
├── Matches.tsx       # 对局记录
└── components/       # 后台专用组件
    ├── AdminLayout.tsx
    ├── StatsCard.tsx
    └── DataTable.tsx
```

## 路由配置
```
/admin           → 统计仪表盘（需管理员登录）
/admin/users     → 用户管理
/admin/users/:id → 用户详情
/admin/matches   → 对局记录
```

## Risks / Trade-offs
- **风险**: 后台代码会打包进主站
  - **缓解**: 使用动态导入（React.lazy）减少主包体积
- **风险**: 管理员账号需要手动在数据库设置
  - **接受**: 项目规模小，可接受手动设置
- **依赖**: 必须在 `add-social-hub` 完成后实施
  - **缓解**: 明确依赖关系，按顺序执行

## Migration Plan
1. 在 `add-social-hub` 完成后开始实施
2. User 模型新增 `role`/`banned` 字段（带默认值）
3. 创建 NestJS Admin 模块
4. 实现前端后台页面
5. 手动将目标用户设为 admin

## Open Questions
- 暂无
