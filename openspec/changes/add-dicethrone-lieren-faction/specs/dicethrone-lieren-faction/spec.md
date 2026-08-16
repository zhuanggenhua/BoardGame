## ADDED Requirements

### Requirement: 女猎手角色目录与初始化

系统 SHALL 将 `lieren`（女猎手 / Huntress）加入 DiceThrone 可选角色目录，并按女猎手正式录入合同初始化骰子、技能、牌库、Token、状态和角色板资源。

#### Scenario: 选角列表展示女猎手

- **WHEN** 玩家进入 DiceThrone 选角界面
- **THEN** 可选角色列表包含女猎手
- **AND THEN** 选中女猎手时展示女猎手玩家板和提示板

#### Scenario: 女猎手初始化

- **GIVEN** 玩家选择 `lieren`
- **WHEN** 对局从设置阶段初始化英雄
- **THEN** 玩家使用女猎手骰面、九个角色板技能和女猎手牌库
- **AND THEN** 女猎手的状态/Token 定义使用正式图集合同

### Requirement: 女猎手素材与提示卡记录

系统 SHALL 使用女猎手正式压缩资源和独立卡牌/状态图集配置渲染运行时素材；提示卡 SHALL 作为录入真相源登记，但不要求进入本轮服务器媒体上传批次。

#### Scenario: 提示卡不上传但可追溯

- **WHEN** 执行女猎手资源发布预检
- **THEN** `tip` 原图、尺寸、hash、规则用途和“不上传”原因出现在真相源表与 evidence
- **AND THEN** 本轮上传过滤范围不包含 `tip.webp`

### Requirement: 妮拉宠物 UI 人工验收门禁

妮拉宠物 UI SHALL 先通过 Open Design 位图设计、AI 图面核验和人工验收，人工验收前不得进入运行时 UI 实施。

#### Scenario: 人工验收前保持阻塞

- **GIVEN** Open Design 尚未产出并通过 AI 图面核验的妮拉设计稿，或用户尚未人工验收
- **WHEN** 女猎手运行时继续开发
- **THEN** 宠物面板、宠物交互控件和宠物状态承接保持 `blocked`
- **AND THEN** 不得用 HTML 预览、运行页截图或临时占位图替代设计稿验收

#### Scenario: 人工验收后允许实现

- **GIVEN** Open Design 导出的位图候选稿已通过 AI 图面核验
- **AND GIVEN** 用户已完成人工验收
- **WHEN** 开始实现妮拉宠物 UI
- **THEN** 运行时实现 SHALL 绑定已验收的设计证据和正式 `nyras-bond` 素材输入
