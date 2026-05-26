# smashup-huluwawa-faction Specification (delta)

## ADDED Requirements

### Requirement: 系统必须将葫芦娃作为正式 Smash Up 派系接入
系统 SHALL 将 `葫芦娃` 的 faction、card、base、titan、locale、UI metadata 与 atlas 预览链路正式接入 Smash Up。

#### Scenario: 用户要求把葫芦娃做成正式可选派系
- **WHEN** 用户已经提供中文规则与本地图集真相源
- **THEN** 系统 MUST 将 `huluwawa` 注册为正式 faction id
- **AND** 系统 MUST 在中文界面的派系选择、卡牌预览和基地预览中显示该派系
- **AND** 系统 MUST NOT 因为缺少英文文案就在英文界面暴露未完成派系

### Requirement: 系统必须为葫芦娃使用独立 atlas 资源链路
系统 SHALL 为 `葫芦娃` 使用独立的卡牌、基地与泰坦 atlas id，并接入现有 Smash Up 官方卡面渲染与关键图片预加载链路。

#### Scenario: 葫芦娃卡牌与基地被加入派系数据
- **WHEN** 任意 `huluwawa` card/base/titan 定义被运行时读取
- **THEN** 系统 MUST 通过 `previewRef.type = 'atlas'` 与独立 atlas id 解析图片
- **AND** 系统 MUST 让 `criticalImageResolver` 能自动发现这些资源
- **AND** 系统 MUST NOT 退回到无图文本卡渲染路径

### Requirement: 系统必须把葫芦娃玩法实现成可游玩的整套派系
系统 SHALL 覆盖 `葫芦娃` 的 18 张仆从/行动、2 张基地和 `葫芦小金刚` 的关键玩法语义。

#### Scenario: 用户使用葫芦娃开始对局
- **WHEN** 对局中存在 `huluwawa` 派系卡牌、基地或泰坦
- **THEN** 系统 MUST 支持这些卡牌的打出、附着、移动、摧毁、回收、特殊与持续效果
- **AND** 系统 MUST 让 `葫芦小金刚` 能按“代替通常随从打出”与“每回合一次复制主动能力”的边界运行
- **AND** 系统 MUST NOT 将被动触发能力错误并入 `葫芦小金刚` 的复制范围

### Requirement: 葫芦娃交付必须包含自动化验证与证据
系统 SHALL 为 `葫芦娃` 的正式接入提供相关 Vitest、至少一条真实入口 E2E、evidence 文档与资源验证证据。

#### Scenario: 葫芦娃准备收口
- **WHEN** 葫芦娃的资源、静态数据和玩法已接入
- **THEN** 系统 MUST 运行相关 Smash Up 测试
- **AND** 系统 MUST 提供至少一张实际核对过的 E2E 截图路径
- **AND** 系统 MUST 记录资源合同、测试结果、未覆盖风险与剩余限制
