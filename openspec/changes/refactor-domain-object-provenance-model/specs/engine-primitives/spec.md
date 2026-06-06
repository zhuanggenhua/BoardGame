## ADDED Requirements

### Requirement: 引擎提供对象生命周期 primitives
引擎 SHALL 提供可复用的对象生命周期 primitives，用于表达稳定对象引用、provenance 快照、跨区重建和默认终点解析，而不是要求各游戏手动拼装零散字段。

#### Scenario: 游戏通过统一 primitive 构造跨边界对象引用
- **GIVEN** 某游戏需要生成对象转移、附着、脱离、控制权变化或回收类事件
- **WHEN** 游戏构造该事件的对象上下文
- **THEN** 游戏 MUST 可以通过共享 primitive 生成统一的对象引用或 provenance value object
- **AND** 不需要在业务层重复发明一套“uid + defId + owner/controller/holder”等散字段协议

#### Scenario: 统一 primitive 支持来源对象已不可见的重建
- **GIVEN** 某对象已离开原始 live 容器
- **WHEN** 游戏通过共享 primitive 请求重建该对象或解析其默认终点
- **THEN** primitive MUST 能基于对象引用或 provenance 快照返回一致结果
- **AND** MUST NOT 强制业务层直接依赖当前容器反查对象

### Requirement: 共享 primitives 不得把 provenance 细节泄漏到业务层
引擎 SHALL 将对象生命周期的通用推导与校验收敛在共享 primitives 中，避免业务层根据易变上下文自行推断领域事实。

#### Scenario: 业务层发起对象迁移
- **GIVEN** 游戏能力实现需要把对象迁移到新区域或新宿主
- **WHEN** 业务层调用共享 primitive
- **THEN** 业务层只需要提供该次迁移明确知道的领域事实
- **AND** primitive MUST 负责补齐通用 provenance 结构与约束检查
- **AND** 业务层 MUST NOT 依赖当前持有者、当前容器或来源玩家自行推断对象真实归属
