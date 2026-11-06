## ADDED Requirements

### Requirement: 用户可切换现代和经典首页
系统 SHALL 在首页设置中提供现代与经典两种现有首页风格。选择后首页 MUST 在当前会话立即切换，并通过既有首页风格本地偏好在刷新后恢复。

#### Scenario: 切换首页风格
- **WHEN** 用户在首页设置中选择现代或经典风格
- **THEN** 当前首页 MUST 显示所选风格
- **AND** 系统 MUST 将该选择写入 `bg_home_entry_style`
- **AND** 系统 MUST 通过现有页面订阅机制同步当前会话和同源标签页

#### Scenario: 访客与登录用户均能切换
- **WHEN** 访客或登录用户在首页打开浮球设置
- **THEN** 系统 MUST 提供相同的现代和经典选择
- **AND** 切换 MUST 在当前页面立即生效，保持其它用户偏好

#### Scenario: 恢复已保存的首页风格
- **WHEN** 用户刷新首页且本地已保存现代或经典风格
- **THEN** 系统 MUST 恢复保存的首页风格

#### Scenario: 迁移已保存的书本风格
- **WHEN** 系统读取到旧值 `book`
- **THEN** 系统 MUST 将该首页风格迁移为现代
- **AND** MUST 保留其它用户偏好
- **AND** 生产首页 MUST NOT 将用户路由至书本风格页面

#### Scenario: 旧预览路径到达正式首页
- **WHEN** 用户访问旧的 `/dev/home-v2-preview` 或 `/dev/home-v2-authoring` 路径
- **THEN** 系统 MUST 重定向到当前首页
- **AND** 系统 MUST 保留按现有偏好解析出的现代或经典首页
