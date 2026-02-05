## ADDED Requirements

### Requirement: 登录用户音频设置持久化
系统 SHALL 在用户登录后持久化音频设置并跨设备同步。

#### Scenario: 登录加载服务器设置
- **WHEN** 用户登录成功
- **THEN** 系统 MUST 拉取服务器音频设置并应用到客户端
- **AND** 客户端 MUST 更新本地缓存

#### Scenario: 更新音频设置
- **WHEN** 用户调整静音或音量
- **THEN** 系统 MUST 写入服务器并更新本地缓存

### Requirement: 未登录用户仅本地保存
系统 SHALL 在未登录状态仅使用本地缓存保存音频设置。

#### Scenario: 未登录调整音量
- **WHEN** 未登录用户调整音量
- **THEN** 系统 MUST 仅更新本地缓存
- **AND** MUST 不发送用户设置写入请求

### Requirement: 首次登录迁移本地设置
系统 SHALL 在用户首次登录且服务器没有音频设置时迁移本地设置。

#### Scenario: 服务器无设置
- **WHEN** 用户登录且服务器未存在音频设置
- **THEN** 系统 MUST 将本地音频设置写入服务器并继续使用该设置

### Requirement: 设置范围为全局
系统 SHALL 以账号全局维度存储音频设置。

#### Scenario: 跨游戏生效
- **WHEN** 用户在任意游戏调整音频设置
- **THEN** 同一账号在其他游戏与大厅中使用一致的音频设置
