## Context
当前音频设置仅保存在 localStorage，登录用户跨设备/跨浏览器无法同步，且清理缓存会丢失。

## Goals / Non-Goals
- Goals
  - 登录用户音频设置持久化并跨设备同步
  - 未登录用户继续本地保存
  - 首次登录迁移本地设置
- Non-Goals
  - 按游戏维度区分设置
  - 复杂的历史版本或审计

## Decisions
- 新增独立集合（UserAudioSettings），按 userId 唯一存储。
- 提供登录态 API：
  - GET /user-settings/audio：读取当前用户设置；若不存在返回 empty 标记
  - PUT /user-settings/audio：更新设置并返回最新值
- 同步策略：
  - 登录后先拉取服务器设置；若不存在则迁移本地设置并写入服务器
  - 若服务器存在设置，服务器为单一事实来源并覆盖本地缓存
- 数据校验：音量范围限制在 0~1，muted 为布尔值

## Risks / Trade-offs
- 登录时多一次请求
- 服务器为事实来源会覆盖本地临时修改，需要保证写入即时生效

## Migration Plan
1. 先上线后端数据模型与 API
2. 前端接入同步逻辑并回滚到本地缓存作为兜底

## Open Questions
无
