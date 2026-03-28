# manage-user-settings Specification

## Purpose
TBD - created by archiving change add-user-settings-persistence. Update Purpose after archive.
## Requirements
### Requirement: 登录用户音频设置持久化
系统 SHALL 为登录用户持久化账号级音频设置，并在登录会话中应用服务器上的统一偏好。

#### Scenario: 登录加载服务器设置
- **WHEN** 用户登录成功且服务器已存在音频设置
- **THEN** 系统 MUST 拉取服务器音频设置并应用到当前会话
- **AND** MUST 不污染游客本地缓存，以便登出后仍能恢复游客偏好

#### Scenario: 登录后更新音频设置
- **WHEN** 登录用户调整静音、主音量、音效音量、BGM 音量或 BGM 选择
- **THEN** 系统 MUST 将最新设置写入服务器
- **AND** 当前会话中的音频状态 MUST 立即更新

### Requirement: 未登录用户仅本地保存
系统 SHALL 在未登录状态仅使用本地缓存保存音频设置。

#### Scenario: 未登录调整音量
- **WHEN** 未登录用户调整音频设置
- **THEN** 系统 MUST 仅更新本地缓存
- **AND** MUST 不发送登录态用户设置写入请求

#### Scenario: 登出恢复游客偏好
- **WHEN** 用户在登录态应用过服务器设置后退出登录
- **THEN** 系统 MUST 从本地缓存恢复游客自己的音频偏好

### Requirement: 首次登录迁移本地设置
系统 SHALL 在用户首次登录且服务器没有音频设置时迁移当前本地偏好。

#### Scenario: 服务器无设置
- **WHEN** 用户登录且服务器不存在音频设置记录
- **THEN** 系统 MUST 将当前本地音频偏好写入服务器
- **AND** 后续登录会话 MUST 继续使用该账号设置

### Requirement: 设置范围为账号全局
系统 SHALL 以账号全局维度存储音频设置，而不是按单个游戏拆分。

#### Scenario: 跨大厅与游戏生效
- **WHEN** 同一账号在任意大厅或游戏中更新音频设置
- **THEN** 该账号在其他大厅与游戏中 MUST 读取同一组音频偏好

