# systems-layer Specification

## Purpose
TBD - created by archiving change implement-domain-core-and-systems. Update Purpose after archive.
## Requirements
### Requirement: 系统层以可插拔方式承载跨游戏能力
系统 SHALL 提供可插拔的系统层，用于承载跨游戏复用的平台能力。

#### Scenario: 游戏启用系统列表
- **GIVEN** 某个游戏声明启用的系统列表
- **WHEN** 游戏运行
- **THEN** 已启用系统 MUST 参与命令执行与事件处理链路

### Requirement: 系统通过统一生命周期参与执行
系统 SHALL 通过统一生命周期 hook 观察并影响执行过程。

#### Scenario: 命令执行生命周期
- **WHEN** 系统处理一条命令
- **THEN** 引擎 MUST 按约定调用系统生命周期
- **AND** 系统 MUST 可以在领域执行前后参与处理

### Requirement: 交互与选择是系统层的一等能力
系统 SHALL 提供统一的交互能力来承接需要玩家做出选择的状态。

#### Scenario: 领域规则请求玩家选择
- **WHEN** 领域规则需要玩家从若干选项中做出选择
- **THEN** 系统 MUST 能创建统一的交互状态
- **AND** 共享 UI MUST 能消费该状态进行渲染和提交

### Requirement: 撤回由系统层统一实现
系统 SHALL 由系统层统一实现撤回，而不是依赖每个游戏手动保存快照。

#### Scenario: 命令改变状态后可进入撤回历史
- **WHEN** 一条会改变对局状态的命令执行成功
- **THEN** 撤回系统 MUST 按配置记录可恢复的历史状态

### Requirement: 系统层支持玩家视角过滤
系统 SHALL 允许系统层与领域层共同参与玩家视角过滤，以支持隐藏信息游戏。

#### Scenario: 向不同玩家广播状态
- **GIVEN** 对局中存在不应公开的隐藏信息
- **WHEN** 服务端向某个玩家广播状态
- **THEN** 系统 MUST 返回该玩家可见的过滤后视图

