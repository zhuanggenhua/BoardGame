# Change: 用户音频设置持久化

## Why
当前游客模式会把音频偏好保存在本地，但登录用户缺少账号级同步能力，跨设备或清理缓存后无法恢复统一配置。

## What Changes
- 新增登录态音频设置读写接口，持久化 `muted`、主音量、音效音量、BGM 音量与可选的 BGM 选择。
- 前端在登录后读取账号设置并应用到当前会话；如果服务器还没有设置，则把当前本地偏好迁移到服务器。
- 远程设置应用到登录会话时不覆盖游客本地缓存，保证退出登录后仍能恢复游客自己的本地偏好。
- 登录态下后续音频设置变更会同步写回服务器；未登录时继续只使用本地缓存。
- 补充前后端测试，覆盖未登录拒绝、首次迁移、读写成功与参数校验。

## Impact
- Affected specs: `manage-user-settings`
- Affected code:
  - `apps/api/src/modules/user-settings/`
  - `src/api/user-settings.ts`
  - `src/contexts/AudioContext.tsx`
  - `src/lib/audio/AudioManager.ts`
  - `apps/api/test/user-settings.e2e-spec.ts`
  - `src/api/__tests__/user-settings.test.ts`
