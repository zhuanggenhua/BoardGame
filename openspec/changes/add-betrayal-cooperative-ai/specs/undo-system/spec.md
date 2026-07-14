## ADDED Requirements

### Requirement: 小黑屋 SHALL 支持公共单步撤回协议
系统 SHALL 为小黑屋全部正式真人命令创建公共撤回快照，并 SHALL 保持公共本地自动批准与在线多人审批协议。

#### Scenario: 真人正式命令可撤回
- **GIVEN** 小黑屋真人玩家执行任意 `BETRAYAL_COMMANDS` 正式命令
- **WHEN** 命令通过领域校验并成功执行
- **THEN** 撤回系统 MUST 保存命令执行前快照
- **AND** 批准撤回后 MUST 恢复命令执行前领域状态

#### Scenario: AI 命令不占用撤回历史
- **GIVEN** 小黑屋座位已标记为本地 AI
- **WHEN** 该 AI 执行任意正式命令
- **THEN** 撤回系统 MUST NOT 新增快照
- **AND** 已存在的真人撤回历史 MUST 保持不变
