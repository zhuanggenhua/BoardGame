## ADDED Requirements

### Requirement: 兽人多步能力必须复用现有 Smash Up ability runtime

兽人新增的多步选择能力 MUST 复用现有 Smash Up ability runtime 的 prompt / sequence / response-window 合同；不得新增 raw `queueInteraction + continuationContext` 作为默认续链出口。

#### Scenario: 兽人多步目标选择恢复同一能力流程

- **WHEN** 挤碎、给我！或其它兽人能力需要连续选择基地、玩家、随从或附着行动
- **THEN** runtime MUST 在每一步保留当前流程上下文并恢复同一能力
- **AND** 玩家未提交当前选择前 MUST NOT 直接生成后续结算事件。
