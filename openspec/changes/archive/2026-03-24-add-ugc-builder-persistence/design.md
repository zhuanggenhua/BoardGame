## Context
UGC Builder 目前将草稿状态持久化到浏览器 localStorage（key=ugc-builder-state）。该方案无法跨设备同步，也易因缓存清理/浏览器策略导致丢失。用户明确要求“绑定账号 + 多项目”的后端持久化能力。

## Goals / Non-Goals
- Goals
  - 为登录用户提供可持久化的 UGC Builder 草稿
  - 支持多项目列表、创建/加载/保存/删除
  - 前端自动保存并可恢复最近项目
  - 保留 localStorage 作为离线兜底
- Non-Goals
  - 不在本次实现发布/上架流程（已有 UGC Package 流程）
  - 不做多人协作编辑与冲突合并

## Decisions
1. **存储位置**：使用 MongoDB 新增草稿集合（独立于 UgcPackage）
2. **数据结构**：以 BuilderState 为主体存储 JSON Blob（含 rulesCode/requirements/layout 等）
3. **鉴权**：仅允许登录用户访问自己草稿（ownerId 强绑定）
4. **保存策略**：前端防抖自动保存 + 手动保存按钮
5. **冲突策略**：默认 last-write-wins（可在后续版本扩展乐观锁）

## API 设计（建议）
- `GET /ugc/builder/projects`
  - 返回当前用户项目列表（含 id/name/updatedAt）
- `POST /ugc/builder/projects`
  - 创建新项目（传 name，可选初始 data）
- `GET /ugc/builder/projects/:projectId`
  - 获取完整项目数据（BuilderState）
- `PUT /ugc/builder/projects/:projectId`
  - 更新项目数据（BuilderState）
- `DELETE /ugc/builder/projects/:projectId`
  - 删除项目

## Data Model（建议）
- collection: `ugc_builder_projects`
- fields:
  - `projectId: string`（nanoid/uuid）
  - `ownerId: string`
  - `name: string`
  - `description?: string`
  - `data: BuilderState`
  - `createdAt: Date` / `updatedAt: Date`

## Frontend 行为
- 登录后优先从后端加载项目列表
- 若存在“最近项目”，默认加载最近修改项目
- 自动保存（防抖 500ms），保存成功更新更新时间
- localStorage 仅作为离线缓存/恢复（当后端不可用时）

## Risks / Trade-offs
- last-write-wins 可能覆盖旧草稿（后续可引入版本号）
- 初期只支持登录用户，游客草稿仍依赖 localStorage

## Migration Plan
- 无需迁移历史数据
- 若 localStorage 存在但后端无项目，可提示用户导入为新项目（后续实现）
