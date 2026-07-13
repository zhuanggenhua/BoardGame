## ADDED Requirements

### Requirement: 小黑屋 SHALL 记录第一剧本公开操作日志
系统 SHALL 为小黑屋全部正式命令生成可读的公开操作日志，并 SHALL 与撤回系统使用同一命令白名单。

#### Scenario: 全部正式命令生成一次公开摘要
- **GIVEN** 小黑屋玩家或 AI 执行任意 `BETRAYAL_COMMANDS` 正式命令
- **WHEN** 命令通过正式管线完成
- **THEN** 系统 MUST 只追加一条对应操作日志
- **AND** 同一命令的后续系统事件轮 MUST NOT 重复追加日志

#### Scenario: 日志不暴露命令私密参数
- **GIVEN** 持有物、交易、搜尸、事件选择或攻击命令包含卡牌 ID、目标映射或武器 ID
- **WHEN** 系统格式化操作日志
- **THEN** 日志 MUST 只包含公开行为摘要
- **AND** MUST NOT 复制上述命令私密参数

#### Scenario: 撤回同步恢复日志
- **GIVEN** 真人玩家执行了可撤回命令并生成日志
- **WHEN** 公共撤回系统恢复命令执行前快照
- **THEN** 小黑屋领域状态和操作日志 MUST 同步恢复
