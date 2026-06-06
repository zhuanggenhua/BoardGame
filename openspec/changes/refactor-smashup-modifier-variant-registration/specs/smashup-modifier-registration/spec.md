## ADDED Requirements

### Requirement: Smash Up Modifier Registries SHALL Declare POD Variant Strategy Explicitly
Smash Up 的 power modifier、breakpoint modifier 与 base power modifier registry SHALL 通过显式的变体注册语义表达“共享 POD / 自管变体 / 仅基础版”，而不是依赖外露布尔补丁来阻止重复 alias。

#### Scenario: Shared modifier auto-reuses POD through alias mapping
- **GIVEN** 一条基础版 modifier 规则与 POD 规则完全一致
- **WHEN** 它通过共享模式注册到 Smash Up modifier registry
- **THEN** runtime SHALL 为基础版与 `_pod` 变体提供同一份规则语义
- **AND** 目标实体在一次计算中 SHALL 只应用一次该规则对应的修正

#### Scenario: Self-managed modifier does not receive a second POD alias
- **GIVEN** 一条 modifier 规则内部已经自行处理原版与 `_pod` 变体差异
- **WHEN** 它通过自管变体模式注册到 Smash Up modifier registry
- **THEN** alias 生成器 SHALL NOT 再为它额外生成 `_pod` 注册项
- **AND** runtime SHALL 只评估该单一注册规则

#### Scenario: Base-only modifier stays base-only
- **GIVEN** 一条 modifier 只属于基础版规则，POD 变体没有对应持续效果
- **WHEN** 它通过仅基础版模式注册到 Smash Up modifier registry
- **THEN** registry SHALL 保留基础版注册
- **AND** SHALL NOT 自动生成 `_pod` alias
- **AND** modifier audit output SHALL NOT 将该 `_pod` 视为已注册 modifier

### Requirement: Smash Up Declarative Modifier Helpers SHALL Bind A Stable Variant Strategy
Smash Up 中的声明式 modifier helper SHALL 在 helper 内部绑定稳定的 POD 变体语义，而不是把 alias 控制细节继续泄漏给业务卡牌调用点。

#### Scenario: Declarative helper owns variant strategy
- **GIVEN** 一个声明式 helper 已经在内部统一处理基础版与 `_pod` 卡实例
- **WHEN** 业务卡牌通过该 helper 注册 modifier
- **THEN** helper SHALL 自动使用稳定的变体注册策略
- **AND** 业务调用点 SHALL NOT 需要再额外传入布尔补丁来阻止重复 alias

### Requirement: Smash Up Variant-Different Ongoing Minions SHALL Avoid Duplicate Modifier Evaluation
当 Smash Up 某张随从在基础版与 POD 版拥有不同的 ongoing 语义时，modifier registry SHALL 能表达这种差异而不导致原版或 POD 版重复计算。

#### Scenario: Polar Commando original version gains exactly one +2 bonus
- **GIVEN** 原版极地突击队员在某基地是该玩家唯一的随从
- **WHEN** runtime 计算这张原版极地突击队员的有效力量
- **THEN** 它 SHALL 只获得一次 `+2` 持续修正
- **AND** 最终力量 SHALL 为基础 4 加成后 6，而不是 8

#### Scenario: Polar Commando POD version does not inherit missing ongoing power bonus
- **GIVEN** POD 版极地突击队员在某基地是该玩家唯一的随从
- **WHEN** runtime 计算这张 POD 版极地突击队员的持续力量修正
- **THEN** 它 SHALL NOT 因基础版的 ongoing 力量规则而自动获得 `+2`
