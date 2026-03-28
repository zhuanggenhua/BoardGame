# game-changelog-management Specification

## Purpose
TBD - created by archiving change add-game-changelog-and-author-info. Update Purpose after archive.
## Requirements
### Requirement: 游戏更新日志公开查询
系统 SHALL 提供按游戏维度查询已发布更新日志的公开读取接口。

#### Scenario: 查询单个游戏的已发布更新日志
- **WHEN** 客户端以某个 `gameId` 请求更新日志
- **THEN** 系统 MUST 只返回该游戏的已发布日志
- **AND** 返回结果 MUST 按置顶优先、发布时间倒序排列

#### Scenario: 草稿日志不对前台可见
- **WHEN** 某条更新日志处于草稿或已撤回发布状态
- **THEN** 公开读取接口 MUST 不返回该条日志

### Requirement: 后台单游戏更新日志管理
系统 SHALL 在后台提供按游戏维护更新日志的管理能力，支持创建、编辑、发布、撤回发布与删除。

#### Scenario: 管理员为任意游戏创建日志
- **WHEN** `admin` 在后台提交包含目标 `gameId` 的更新日志
- **THEN** 系统 MUST 为该游戏保存日志记录
- **AND** 发布状态 MUST 以提交值为准

#### Scenario: 开发者只能管理被分配到的游戏
- **WHEN** `developer` 对其 `developerGameIds` 中的某个 `gameId` 创建、编辑、发布或删除更新日志
- **THEN** 系统 MUST 允许该操作成功

#### Scenario: 开发者不能管理未分配的游戏
- **WHEN** `developer` 对不在其 `developerGameIds` 中的 `gameId` 执行更新日志写操作
- **THEN** 系统 MUST 拒绝该操作

### Requirement: 后台角色与开发者游戏范围配置
系统 SHALL 使用 `user / developer / admin` 角色模型管理后台权限，并允许 `admin` 为 `developer` 分配多个可管理游戏。

#### Scenario: 管理员为开发者分配多个游戏
- **WHEN** `admin` 在用户管理中将某个用户设置为 `developer` 并提交多个 `gameId`
- **THEN** 系统 MUST 持久化该用户的 `developerGameIds`
- **AND** 用户列表与用户详情读取接口 MUST 返回最新角色与游戏范围

#### Scenario: 开发者必须至少绑定一个游戏
- **WHEN** `admin` 尝试将某个用户设置为 `developer` 但未提供任何 `gameId`
- **THEN** 系统 MUST 拒绝该角色变更

### Requirement: 开发者后台访问边界
系统 SHALL 将 `developer` 的后台入口限制在更新日志管理范围内。

#### Scenario: 开发者可以进入更新日志后台
- **WHEN** `developer` 访问 `/admin/changelogs`
- **THEN** 系统 MUST 允许其进入更新日志管理页

#### Scenario: 开发者不能进入其他后台页面
- **WHEN** `developer` 访问 `/admin/users`、`/admin/matches` 或其他非更新日志后台页面
- **THEN** 系统 MUST 拒绝该访问或回退到 `/admin/changelogs`

