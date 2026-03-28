## ADDED Requirements

### Requirement: 教程标注展示模式
系统 SHALL 支持对已标注组件显示教程描述，形成“标注展示”模式。

#### Scenario: 右键标注组件
- **WHEN** 用户右键组件并输入描述
- **THEN** 系统 MUST 保存标注内容并关联组件的 `data-ugc-id`

#### Scenario: 教程展示标注
- **WHEN** 用户进入教程模式
- **THEN** 系统 MUST 根据标注内容在对应组件旁展示描述
