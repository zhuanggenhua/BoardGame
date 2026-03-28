# dicethrone-hero-selection Specification

## Purpose
TBD - created by archiving change add-dicethrone-hero-selection. Update Purpose after archive.
## Requirements
### Requirement: DiceThrone 角色目录
系统 SHALL 提供 DiceThrone 角色目录，并暴露可选角色列表，至少包含 `monk` 与 `barbarian`。

#### Scenario: 读取可选角色列表
- **WHEN** 游戏初始化并构建角色配置
- **THEN** 可选角色列表包含 `monk` 与 `barbarian`

### Requirement: 选角状态与指令
系统 SHALL 记录每位玩家的角色选择，并提供仅允许玩家选择自己角色的指令；允许多个玩家选择相同角色。

#### Scenario: 玩家选择角色
- **GIVEN** 玩家处于选角阶段
- **WHEN** 玩家提交角色选择指令
- **THEN** 系统记录该玩家的角色选择
- **AND** 允许多个玩家选择相同角色
- **AND** 阻止玩家替其他玩家选择角色

### Requirement: 选角门禁
系统 SHALL 在所有玩家完成选角且房主点击开始前，阻止进入正式回合阶段。

#### Scenario: 未选齐时阻止推进
- **GIVEN** 存在未选择角色的玩家
- **WHEN** 收到 `ADVANCE_PHASE` 命令
- **THEN** 系统返回不可推进结果并保持在选角阶段

#### Scenario: 房主未开始时阻止推进
- **GIVEN** 所有玩家均已选择角色
- **AND** 房主尚未点击开始
- **WHEN** 收到 `ADVANCE_PHASE` 命令
- **THEN** 系统返回不可推进结果并保持在选角阶段

#### Scenario: 条件满足后允许推进
- **GIVEN** 所有玩家均已选择角色
- **AND** 房主已点击开始
- **WHEN** 收到 `ADVANCE_PHASE` 命令
- **THEN** 系统允许进入正式回合阶段

### Requirement: 选角界面
系统 SHALL 提供独立选角界面，用于展示角色卡牌、玩家选择状态和开始/准备操作。

#### Scenario: 展示角色卡牌与玩家状态
- **WHEN** 进入选角界面
- **THEN** 系统展示角色卡牌
- **AND** 选中角色时展示对应玩家的面板与提示板资源
- **AND** 提供清晰提示以展示各玩家当前已选角色与 ready 状态

#### Scenario: 点击角色卡牌完成选择
- **GIVEN** 玩家处于选角阶段
- **WHEN** 玩家点击角色卡牌
- **THEN** 系统将该角色标记为该玩家的选择
- **AND** 界面同步展示角色归属标记

### Requirement: 房主开始
系统 SHALL 提供房主开始指令以进入正式对局。

#### Scenario: 房主点击开始
- **GIVEN** 所有玩家已选择角色
- **WHEN** 房主点击开始
- **THEN** 系统允许从选角阶段进入正式回合阶段

### Requirement: 按角色初始化
系统 SHALL 根据玩家所选角色初始化牌库、技能、Token、资源池与骰子定义。

#### Scenario: 初始化 Barbarian 玩家
- **GIVEN** 玩家选择 `barbarian`
- **WHEN** 初始化英雄状态
- **THEN** 使用 Barbarian 的牌库与技能
- **AND** 使用 Barbarian 的 Token 与资源配置
- **AND** 骰子定义与 Barbarian 一致

