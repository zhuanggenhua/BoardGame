## MODIFIED Requirements

### Requirement: DiceThrone 角色目录
系统 SHALL 提供 DiceThrone 完整角色目录和玩家可见可选角色列表；完整目录可以包含内部隐藏角色，但玩家可见列表、直接玩家选角命令和 AI 自动选角 SHALL 过滤 `setupOptionStatus: hidden` 的角色。

#### Scenario: 读取可选角色列表
- **WHEN** 游戏初始化并构建角色配置
- **THEN** 完整角色目录包含 `monk`、`barbarian`、`tianshi`、`lieren` 与 `vampire_lord`
- **AND THEN** 玩家可见可选角色列表包含 `monk`、`barbarian`、`tianshi` 与 `lieren`
- **AND THEN** 玩家可见可选角色列表不包含 `vampire_lord`
- **AND THEN** 直接玩家选角命令和 AI 自动选角不会选择 `vampire_lord`
