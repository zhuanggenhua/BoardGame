## ADDED Requirements

### Requirement: FantasyRealms 必须实现双人变体的真实核心回合
系统 SHALL 在当前 `manifest.playerOptions: [2]` 的前提下，实现官方双人变体的最小可玩核心回合，而不是继续停留在静态牌桌骨架。

#### Scenario: 双人对局初始化
- **WHEN** 系统创建 `fantasyrealms` 双人对局
- **THEN** 双方 MUST 从 0 手牌开始
- **AND** 系统 MUST 准备可抽取的真实牌库
- **AND** 弃牌堆 MUST 初始为空

### Requirement: FantasyRealms 双人变体必须支持官方抽牌与弃牌循环
系统 SHALL 支持双人变体的抽牌二选一与弃牌收尾规则。

#### Scenario: 玩家手牌未满 7 时从牌库行动
- **WHEN** 当前玩家手牌少于 7 张并选择从牌库抽牌
- **THEN** 系统 MUST 让该玩家获得 2 张牌
- **AND** 玩家 MUST 在本回合结束前弃掉 1 张
- **AND** 回合结束后该玩家手牌数量 MUST 比回合开始时净增加 1

#### Scenario: 玩家从弃牌堆拿牌
- **WHEN** 当前玩家选择拿取弃牌堆中的 1 张明牌
- **THEN** 系统 MUST 将该牌加入玩家手牌
- **AND** 若该玩家当前手牌少于 7 张，系统 MUST 直接结束该回合而不再要求额外弃牌
- **AND** 若该玩家当前手牌已经达到 7 张，系统 MUST 要求其在本回合结束前弃掉 1 张

#### Scenario: 玩家手牌已满 7 时进行常规回合
- **WHEN** 当前玩家已经有 7 张手牌并进行回合
- **THEN** 系统 MUST 只允许其抽取 1 张牌来源
- **AND** 玩家 MUST 在本回合结束前弃掉 1 张
- **AND** 回合结束后该玩家手牌 MUST 维持 7 张

### Requirement: FantasyRealms 必须公开展示可选弃牌堆
系统 SHALL 把弃牌堆作为全公开、全员可见、可选择的公开区，而不是限制为固定 7 张静态公共牌。

#### Scenario: 弃牌堆增长
- **WHEN** 对局进行中有玩家持续弃牌
- **THEN** Board MUST 能展示当前弃牌堆中的全部明牌
- **AND** 系统 MUST 不把弃牌堆裁切成固定 7 张上限

### Requirement: FantasyRealms 双人变体必须在官方阈值结束
系统 SHALL 在双方都达到 7 张手牌且弃牌堆达到 12 张时结束双人变体对局。

#### Scenario: 触发双人结束条件
- **WHEN** 双方手牌都为 7 张并且弃牌堆数量达到 12 张
- **THEN** 系统 MUST 将对局标记为结束态
- **AND** 在完整官方计分引擎落地前，系统 MUST 明确区分“对局结束”与“最终官方胜者已正确裁定”

### Requirement: FantasyRealms gameplay change 必须保持未正式开放边界
系统 SHALL 在实现双人变体 core loop 后继续保持 `manifest.enabled: false`，直到后续 change 完成完整计分和正式开放条件。

#### Scenario: 完成双人 core loop 后检查清单
- **WHEN** 团队完成 `fantasyrealms` 双人变体核心回合
- **THEN** generated manifests / server runtime MAY 包含该实现
- **AND** `manifest.enabled` MUST 仍为 `false`
- **AND** 系统 MUST 不把它加入大厅可选游戏入口
