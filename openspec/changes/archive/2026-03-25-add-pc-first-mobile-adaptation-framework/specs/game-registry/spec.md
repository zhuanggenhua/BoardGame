## ADDED Requirements

### Requirement: 游戏注册表显式暴露移动端元数据
系统 SHALL 要求启用中的游戏 manifest 显式声明移动端支持元数据，并在注册表消费链路中保留这些字段。

#### Scenario: 启用中的游戏声明移动端支持信息
- **GIVEN** 某个启用中的游戏 manifest 被纳入自动生成的注册表
- **WHEN** 运行时消费该注册表条目
- **THEN** 条目 MUST 暴露 `mobileProfile`
- **AND** 条目 MUST 暴露 `shellTargets`
- **AND** 当 `mobileProfile` 为 `landscape-adapted` 或 `portrait-adapted` 时，条目 MUST 可提供匹配的 `preferredOrientation` 与 `mobileLayoutPreset`

#### Scenario: UGC 或未额外声明的条目使用安全默认值
- **GIVEN** 某个注册表条目没有单独提供完整移动支持字段
- **WHEN** 运行时归一化该条目
- **THEN** 系统 MUST 为其补齐安全默认值
- **AND** 默认值 MUST 不把该条目误判为已完成移动端适配
