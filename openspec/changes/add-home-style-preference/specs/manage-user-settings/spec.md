## ADDED Requirements

### Requirement: 用户可切换现代和经典首页
系统 SHALL 在首页设置中提供现代与经典两种现有首页风格。选择后首页 MUST 在当前会话立即切换，并通过既有首页风格本地偏好在刷新后恢复。

#### Scenario: 切换首页风格
- **WHEN** 用户在首页设置中选择现代或经典风格
- **THEN** 当前首页 MUST 显示所选风格
- **AND** 系统 MUST 将该选择写入 `bg_home_entry_style`
- **AND** 系统 MUST 通过现有页面订阅机制同步当前会话和同源标签页

#### Scenario: 恢复已保存的首页风格
- **WHEN** 用户刷新首页且本地已保存现代或经典风格
- **THEN** 系统 MUST 恢复保存的首页风格

#### Scenario: 迁移已保存的书本风格
- **WHEN** 系统读取到旧值 `book`
- **THEN** 系统 MUST 将该首页风格迁移为现代
- **AND** MUST 保留其它用户偏好
- **AND** 生产首页 MUST NOT 将用户路由至书本风格页面
