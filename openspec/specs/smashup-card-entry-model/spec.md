# smashup-card-entry-model Specification

## Purpose
TBD - created by archiving change refactor-smashup-special-entry-model. Update Purpose after archive.
## Requirements
### Requirement: Smash Up SHALL use explicit runtime entry metadata for card usability
Smash Up MUST 使用显式运行时入口元数据表达“玩家何时、从哪里、以什么方式可以使用一张牌或一个能力”，而不能再把 `abilityTags.special`、`subtype === 'special'` 或牌面 `Special:` 文案直接当成通用运行时入口。

#### Scenario: On-board manual activation is modeled explicitly
- **WHEN** 一张随从、持续行动卡或泰坦在场上提供玩家可点击的主动能力
- **THEN** 该入口 SHALL 通过显式 manual activation 元数据声明
- **AND** UI 高亮与命令校验 SHALL 只依赖该显式入口，而不是依赖 `abilityTags.special`

#### Scenario: Response-window play is modeled explicitly
- **WHEN** 一张手牌只能在 `beforeScoring` 或 `afterScoring` 响应窗口中打出
- **THEN** 该入口 SHALL 通过显式 response-window play 元数据声明
- **AND** 响应窗口可响应性、可选基地高亮与 AI reactive 评估 SHALL 读取该元数据

### Requirement: Smash Up SHALL separate trigger-driven Special text from manual activation
牌面写有 `Special:` 但真实入口由 trigger、duel/provider 或其他外部上下文驱动的卡，MUST NOT 因文案关键词被视为场上 manual special。

#### Scenario: Trigger-driven Special text does not create board highlight
- **WHEN** 一张牌的 `Special:` 真实入口是 `beforeScoring` / `afterScoring` trigger 或外部上下文
- **THEN** 它 MUST NOT 因为 `Special:` 文案或旧 `special` 标签而在平时显示为场上可点击能力
- **AND** 到真实时机时仍 SHALL 通过 trigger / provider 正常创建交互

#### Scenario: Removing stale special tags does not disable real triggers
- **WHEN** 一张 trigger 驱动的牌移除了旧的 `abilityTags.special`
- **THEN** 它的 trigger 效果 MUST 继续正常创建交互与结算
- **AND** 系统 MUST NOT 依赖旧 `special` 标签才能让该 trigger 生效

### Requirement: Smash Up SHALL keep contextual providers as first-class runtime entry sources
依赖 duel、discard provider、setaside provider 或其他上下文的能力入口 MUST 以 provider / interaction 机制建模，而不是用泛化的 `special` 标签兜底。

#### Scenario: Duel-context Special stays available without board-manual special
- **WHEN** 一张牌只能在决斗或其他特定上下文中从手牌/外部区域触发
- **THEN** 其可用性 SHALL 由对应 provider / interaction 逻辑决定
- **AND** 系统 MUST NOT 要求该牌同时伪装成场上 manual special

