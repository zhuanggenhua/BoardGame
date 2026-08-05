## ADDED Requirements

### Requirement: Penguins 关键图片预加载

系统 SHALL 将企鹅派系运行时必需的卡牌图集、基地图集和关联泰坦图纳入 Smash Up 图片预加载链路。

#### Scenario: 企鹅派系进入对局前加载关键图
- **WHEN** 玩家选择企鹅并进入 Smash Up 对局
- **THEN** 系统 MUST 在关键图片加载计划中包含企鹅卡牌 atlas 和企鹅基地 atlas
- **AND** 已存在的企鹅帝皇泰坦图 MUST 继续通过泰坦图集加载

#### Scenario: 缺失企鹅运行时图片时保留真实缺口
- **WHEN** 企鹅卡牌 atlas 或基地 atlas 无法加载
- **THEN** 系统 MUST 保留真实图片缺口状态
- **AND** 不得回退到错误派系图、文本卡或无来源占位图
