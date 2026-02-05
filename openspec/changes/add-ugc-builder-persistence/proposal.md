# Change: UGC Builder 后端持久化

## Why
当前 UGC Builder 状态仅存储在浏览器 localStorage，存在清理缓存、换设备、隐身窗口导致草稿丢失的问题。用户需要“绑定账号 + 多项目”的持久化草稿能力，支持长期保存、跨设备恢复与项目管理。

## What Changes
- 新增 UGC Builder 草稿的后端持久化接口（绑定登录账号）
- 新增草稿数据模型（支持多项目、更新时间、版本等）
- 前端接入草稿列表/加载/保存/删除，并替代 localStorage 为主存储
- 保留 localStorage 作为离线/故障兜底缓存
- 补充 API 单测与 E2E 流程验证

## Impact
- Affected specs: `ugc-prototype-builder`
- Affected code: `src/ugc/builder/*`, `src/server/*` (UGC 路由与模型), `apps/api`（如需复用鉴权）
