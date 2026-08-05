# smashup-ability-runtime Specification

## Purpose
TBD - created by archiving change refactor-smashup-ability-runtime. Update Purpose after archive.
## Requirements
### Requirement: Smash Up queued abilities SHALL 编译为声明式 ability program
凡是由 Smash Up queued trigger、base ability queued trigger 或其他 frame-owned 执行入口消费的能力，运行时 SHALL 要求其编译为声明式 `ability program`，而不是允许能力直接写交互队列或静默返回不透明 continuation。

#### Scenario: 简单能力以 effect program 运行
- **GIVEN** 一个只需要生成确定性领域事件的 Smash Up 能力
- **WHEN** 该能力被运行时执行
- **THEN** 它 MUST 可以表示为只包含 `effect` 节点的 ability program
- **AND** 运行时 MUST 在当前 resolution frame 内执行该 effect

### Requirement: Smash Up ability runtime SHALL 内建 prompt 与 flow 原语
Smash Up ability runtime SHALL 内建 prompt、sequence、branch、stop 等最小控制流原语，以承接多步交互能力，而不是要求卡牌代码自行拼接 `queueInteraction + handler + continuationContext`。

#### Scenario: 多步能力通过 prompt 和 sequence 续链
- **GIVEN** 一个需要先选目标再执行后续效果的 Smash Up 能力
- **WHEN** 该能力被编译到 ability program
- **THEN** 它 MUST 可以先产出 prompt 节点再继续执行后续节点
- **AND** 运行时 MUST 在收到 prompt 结果后恢复同一 program 的后续步骤

### Requirement: Player-choice targets SHALL remain explicit even when only one legal target exists

当 Smash Up 能力的规则语义要求玩家选择目标时，运行时 SHALL 将“选择来源卡牌”和“选择目标”保持为独立交互步骤；合法目标只有一个时，也不得用候选数量替玩家静默提交目标。

#### Scenario: Immediate extra action with one legal base
- **GIVEN** 一张即时额外行动只能合法作用于一个基地
- **WHEN** 玩家选择这张额外行动
- **THEN** 运行时 MUST 继续打开基地目标交互
- **AND** 只有玩家提交该基地后，系统 MUST 执行额外行动及其目标效果

#### Scenario: Immediate extra action with one legal minion
- **GIVEN** 一张即时额外行动只能合法作用于一个随从
- **WHEN** 玩家选择这张额外行动
- **THEN** 运行时 MUST 继续打开随从目标交互
- **AND** 只有玩家提交该随从后，系统 MUST 执行额外行动及其目标效果

### Requirement: 缺失 executor 或非法运行时输出 SHALL fail-fast
Smash Up ability runtime 对缺失 executor、非法 program、非法 prompt 恢复或未声明 bridge SHALL 直接抛错，不得静默吞掉该能力。

#### Scenario: Queued trigger 找不到 executor 时抛错
- **GIVEN** reaction queue 正在执行一个 queued trigger
- **AND** 该 trigger 对应的 ability runtime executor 不存在
- **WHEN** 运行时尝试执行该 trigger
- **THEN** 系统 MUST 直接抛出错误
- **AND** MUST NOT 把该 trigger 当作“已正常跳过”

### Requirement: 新增 Smash Up queued ability 不得直接写 raw interaction continuation
本次重构后，新增的 Smash Up queued ability MUST NOT 以直接 `queueInteraction(...)`、注册 `registerInteractionHandler(...)` 并依赖 `continuationContext` 的方式作为默认续链出口。

#### Scenario: 新 queued ability 通过 runtime prompt 表达交互
- **GIVEN** 一个新实现的 Smash Up queued ability 需要玩家做选择
- **WHEN** 开发者实现该能力
- **THEN** 该能力 MUST 通过 ability runtime prompt 节点表达交互
- **AND** MUST NOT 再新增 raw interaction handler 作为默认主续链

