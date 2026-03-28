## Context
项目原先只把音频偏好写入浏览器本地缓存。这样游客模式可用，但登录用户无法在不同设备之间共享设置，也无法在重新登录后恢复统一音量和静音状态。

## Goals / Non-Goals
- Goals
  - 为登录用户提供账号级音频设置持久化
  - 保留游客模式的本地缓存体验
  - 首次登录时自动把游客本地偏好迁移到账号设置
  - 登录态与登出态之间互不污染偏好来源
- Non-Goals
  - 不做按游戏拆分的音频设置
  - 不实现设置历史审计或版本回滚

## Decisions
- 后端新增 `UserAudioSettings` 集合，按 `userId` 唯一存储音频设置。
- 登录态接口统一挂在 `auth/user-settings/audio`：
  - `GET` 返回当前账号设置；没有记录时返回 `empty: true`
  - `PUT` 更新并返回最新设置
- 设置载荷包括：
  - `muted`
  - `masterVolume`
  - `sfxVolume`
  - `bgmVolume`
  - 可选 `bgmSelections`
- 前端同步策略：
  - 未登录：继续直接读写本地缓存
  - 登录且服务器已有设置：应用到当前会话，但远程 apply 使用 `persist=false`，不覆盖游客本地缓存
  - 登录且服务器无设置：把当前本地偏好上传为账号初始设置
  - 登出：从本地缓存恢复游客偏好
- DTO 对音量范围做 `0~1` 校验，并要求 `muted` 为布尔值。

## Risks / Trade-offs
- 登录时会多一次用户设置读取请求。
- 远程设置只应用到当前会话、而不覆盖游客缓存，逻辑比“直接写回 localStorage”更复杂，但能正确支持登录/登出双来源切换。

## Migration Plan
1. 上线后端 schema、service、controller 与鉴权接口
2. 前端接入登录同步、首次迁移和登出恢复逻辑
3. 用 API/E2E/单测覆盖主要路径

## Open Questions
- 无
