## ADDED Requirements
### Requirement: 交互 SHALL 绑定所属 resolution frame 而不是独立持有主续链
InteractionSystem SHALL 把每个阻塞式交互绑定到其所属的 resolution frame。交互可以阻塞或解锁该 frame，但不得自行拥有第二套主续链、deferred follow-up 或阶段推进权。

#### Scenario: 交互阻塞并解锁所属 frame
- **GIVEN** 一个 resolution frame 在执行途中创建了交互
- **WHEN** 该交互进入 `sys.interaction.current`
- **THEN** 所属 frame MUST 进入 blocked 状态
- **AND** 当交互被解决后，系统 MUST 恢复同一 frame 继续推进

#### Scenario: 交互切换时不再由通用系统拼接游戏私有 continuation
- **GIVEN** 一个交互解决后队列中的下一个交互成为 current
- **WHEN** InteractionSystem 切换 current / queue
- **THEN** 它 MAY 刷新候选与更新通用元数据
- **BUT** 它 MUST NOT 代表游戏拼接第二套私有主续链或决定 deferred follow-up 的补发时机

### Requirement: 历史桥接式交互适配 SHALL 被标记为 deferred anti-pattern
系统 MAY 暂时保留少量历史桥接式交互适配器以兼容既有游戏，但这些适配器 MUST 被明确标记为 deferred migration / anti-pattern，且 MUST NOT 作为新游戏或新重构的参考范式。

#### Scenario: SummonerWars route adapter 只保留为历史兼容事实
- **GIVEN** 某个既有游戏仍通过 route / adapter 把系统交互投影到本地 UI 模式
- **WHEN** 本轮任务并未修复该游戏的现实 bug
- **THEN** 该桥接 MAY 暂时保留而不立即重写
- **AND** spec / design MUST 明确它是 deferred migration
- **AND** 新游戏或新重构 MUST NOT 继续复制这种桥接主链
