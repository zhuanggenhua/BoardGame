## MODIFIED Requirements

### Requirement: DiceThrone 角色目录
系统 SHALL 提供 DiceThrone 完整角色目录和玩家可见可选角色列表；完整目录可以包含内部隐藏角色和实施中角色。玩家可见列表与直接玩家选角命令 SHALL 过滤 `setupOptionStatus: hidden` 的角色；共享 AI 自动选角 SHALL 过滤 `setupOptionStatus: hidden` 与 `setupOptionStatus: in_progress` 的角色。

#### Scenario: 读取可选角色列表
- **WHEN** 游戏初始化并构建角色配置
- **THEN** 完整角色目录包含 `monk`、`barbarian`、`tianshi`、`lieren` 与 `vampire_lord`
- **AND THEN** 玩家可见可选角色列表按照角色生命周期过滤 `hidden` 角色；当前 `vampire_lord` 处于 `in_progress`，出现在玩家列表并显示实施中标记
- **AND THEN** 当前 `vampire_lord` 的直接玩家选角命令被允许
- **AND THEN** 共享 AI 自动选角不会选择 `lieren`
- **AND THEN** 当前共享 AI 自动选角不会选择 `vampire_lord`
