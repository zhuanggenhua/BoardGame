# undo-system Specification

## MODIFIED Requirements

### Requirement: 历史记录限制
系统 SHALL 支持配置历史记录的最大数量，且默认仅保留 1 条快照（单步撤回）。

#### Scenario: 默认单步撤回
- **GIVEN** 游戏未配置 `maxSnapshots`
- **WHEN** 连续执行多次可撤回命令
- **THEN** 系统仅保留最近 1 条快照

#### Scenario: 超出历史限制
- **GIVEN** 配置的历史上限为 N
- **WHEN** 保存第 N+1 个快照
- **THEN** 系统移除最早的快照，保持历史数量不超过 N
