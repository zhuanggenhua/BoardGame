## ADDED Requirements

### Requirement: 勇士多步能力必须复用现有 Smash Up ability runtime

勇士新增的模式、目标与奖励选择 MUST 复用现有 Smash Up ability runtime 的 prompt / sequence / response-window 合同；不得用隐式默认选择替代玩家交互。

#### Scenario: 单候选仍停在真实选择态

- **WHEN** 大英雄、地牢诱饵、战争怒吼或斩杀只剩一个合法模式、目标或奖励宝藏
- **THEN** runtime MUST 保留可见交互并等待玩家提交
- **AND** 玩家提交前不得生成对应的摧毁、打出、力量或奖励结算事件

#### Scenario: 斩杀奖励允许逐张部分使用

- **WHEN** 斩杀击败怪物后获得多张宝藏
- **THEN** runtime MUST 为每张奖励宝藏提供独立的额外出牌或跳过入口
- **AND** 玩家可以只打出其中一部分，未使用奖励不应被错误打出
