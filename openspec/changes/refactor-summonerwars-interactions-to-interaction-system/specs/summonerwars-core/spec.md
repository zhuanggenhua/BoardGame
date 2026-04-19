# summonerwars-core Specification (Delta)

## ADDED Requirements

### Requirement: Summoner Wars 交互必须进入 InteractionSystem
系统 SHALL 将 Summoner Wars 中所有“事件触发且需要玩家选择/确认的交互”建模为 InteractionSystem 交互（simple-choice / multistep-choice），不得仅依赖 UI 本地 mode 状态机。

#### Scenario: 事件触发后创建交互
- **GIVEN** 触发了 SUMMON_FROM_DISCARD_REQUESTED / GRAB_FOLLOW_REQUESTED / SOUL_TRANSFER_REQUESTED / MIND_CAPTURE_REQUESTED / ice_shards_damage / feed_beast_check
- **WHEN** 系统需要玩家进行选择或确认
- **THEN** `sys.interaction.current` 被创建并仅对拥有者可见
- **AND** 交互提供可解选项或安全取消/跳过路径

#### Scenario: AI 可见且可解
- **GIVEN** AI 控制的玩家触发了上述交互
- **WHEN** AI 计算合法动作
- **THEN** AI 能从 InteractionSystem 的描述中生成至少一个合法响应命令
