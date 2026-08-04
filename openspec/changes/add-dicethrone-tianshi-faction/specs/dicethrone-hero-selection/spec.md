## MODIFIED Requirements

### Requirement: DiceThrone 角色目录

系统 SHALL 提供 DiceThrone 角色目录，并暴露可选角色列表；列表至少包含 `monk`、`barbarian` 与 `tianshi`。

#### Scenario: 读取可选角色列表

- **WHEN** 游戏初始化并构建角色配置
- **THEN** 可选角色列表包含 `monk`、`barbarian` 与 `tianshi`
