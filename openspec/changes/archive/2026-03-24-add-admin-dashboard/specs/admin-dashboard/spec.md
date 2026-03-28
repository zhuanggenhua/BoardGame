# Admin Dashboard Specification

## ADDED Requirements

### Requirement: 管理员角色
系统 SHALL 支持管理员角色，区分普通用户与管理员。

#### Scenario: 用户默认角色
- **WHEN** 新用户注册
- **THEN** 该用户的 role 默认为 `user`

#### Scenario: 管理员权限检查
- **WHEN** 用户访问 /admin/* 路由
- **AND** 用户 role 不是 `admin`
- **THEN** 系统拒绝访问并返回 403

### Requirement: 统计仪表盘
系统 SHALL 提供统计仪表盘，展示平台核心数据。

#### Scenario: 查看统计数据
- **WHEN** 管理员访问 /admin
- **THEN** 系统展示以下统计：
  - 总用户数
  - 今日新增用户数
  - 总对局数
  - 今日对局数
  - 当前在线用户数
  - 24 小时活跃用户数
  - 各游戏对局分布

#### Scenario: 查看趋势图表
- **WHEN** 管理员查看统计仪表盘
- **THEN** 系统展示 7/30 天趋势图表：
  - 每日新增用户数
  - 每日对局数

### Requirement: 用户管理
系统 SHALL 提供用户管理功能，支持查看、搜索和封禁用户。

#### Scenario: 查看用户列表
- **WHEN** 管理员访问 /admin/users
- **THEN** 系统展示用户列表，包含：
  - 用户名
  - 邮箱（如有）
  - 注册时间
  - 对局数
  - 状态（正常/封禁）

#### Scenario: 搜索用户
- **WHEN** 管理员在用户列表输入搜索关键词
- **THEN** 系统按用户名或邮箱模糊匹配并筛选结果

#### Scenario: 封禁用户
- **WHEN** 管理员点击封禁按钮并填写原因
- **THEN** 系统将该用户标记为封禁状态
- **AND** 记录封禁时间和原因

#### Scenario: 解封用户
- **WHEN** 管理员点击解封按钮
- **THEN** 系统将该用户恢复为正常状态

### Requirement: 用户详情
系统 SHALL 提供用户详情页面，展示单个用户的完整信息。

#### Scenario: 查看用户详情
- **WHEN** 管理员点击用户列表中的某个用户
- **THEN** 系统展示该用户的：
  - 基本信息（用户名、邮箱、注册时间）
  - 对局历史（最近 20 场）
  - 胜率统计

### Requirement: 用户硬删除
系统 SHALL 支持管理员硬删除用户并清理关联数据。

#### Scenario: 删除用户
- **WHEN** 管理员执行删除用户操作
- **THEN** 系统删除用户与其关联的好友/私信/评论记录
- **AND** 对局记录匿名化玩家名

### Requirement: 对局记录
系统 SHALL 提供对局记录查看功能。

#### Scenario: 查看对局列表
- **WHEN** 管理员访问 /admin/matches
- **THEN** 系统展示对局列表，包含：
  - 对局 ID
  - 游戏类型
  - 参与玩家
  - 结果（胜者/平局）
  - 结束时间

#### Scenario: 按游戏类型筛选
- **WHEN** 管理员选择游戏类型筛选条件
- **THEN** 系统只显示该游戏类型的对局

#### Scenario: 按时间范围筛选
- **WHEN** 管理员选择时间范围
- **THEN** 系统只显示该时间范围内的对局

### Requirement: 房间管理
系统 SHALL 支持管理员查看与销毁对局房间。

#### Scenario: 查看房间列表
- **WHEN** 管理员访问 /admin/rooms
- **THEN** 系统展示房间列表（包含玩家、房间名、是否上锁）

#### Scenario: 销毁房间
- **WHEN** 管理员执行删除房间操作
- **THEN** 系统销毁对应对局房间
