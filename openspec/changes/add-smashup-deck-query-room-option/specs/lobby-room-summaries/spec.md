## ADDED Requirements

### Requirement: 大厅房间广播 SHALL 提供公开扩展摘要

大厅房间广播 MUST 为需要展示房间扩展信息的游戏提供可公开的 setup 摘要，而不是直接暴露整份 `setupData`。

#### Scenario: 大杀四方房间带出已开启扩展

- **GIVEN** 一个大杀四方房间启用了扩展选项
- **WHEN** 服务端构建大厅房间广播数据
- **THEN** 广播 payload MUST 包含可供前端渲染的扩展摘要
- **AND** 摘要中 MUST 只包含可公开的扩展信息

#### Scenario: 大厅广播不泄露私有 setup 数据

- **WHEN** 服务端向大厅广播房间列表
- **THEN** 广播 payload MUST 不因扩展摘要需求而原样暴露 `password`、`ownerKey`、`guestId` 或完整 `seatControllers`

### Requirement: 房间卡片 SHALL 显示已开启扩展 tag

大厅中的房间卡片 MUST 在可用时展示已开启扩展摘要，并直接显示每个扩展的完整展示名。

#### Scenario: 房间卡片显示扩展 tag

- **GIVEN** 一个大杀四方房间启用了多个扩展
- **WHEN** 玩家在大厅查看该房间卡片
- **THEN** 卡片 MUST 显示已开启扩展摘要
- **AND** 每个扩展 tag MUST 显示对应扩展的完整展示名

#### Scenario: 没有扩展摘要时保持房间卡片紧凑

- **GIVEN** 一个房间没有可展示的扩展摘要
- **WHEN** 玩家在大厅查看该房间卡片
- **THEN** 房间卡片 MUST 继续正常渲染
- **AND** 不得因为缺少扩展摘要占出空白占位
