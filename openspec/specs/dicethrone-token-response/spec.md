# DiceThrone Token Response Specification

## Purpose
定义《王权骰铸》伤害响应窗口中可点击 token 的结算契约，包括同一响应窗口内的累计消耗规则，以及零伤害修正但带 custom action 的响应 token。

## Requirements

### Requirement: Nonlinear Token Usage Respects Response-Window Totals
The DiceThrone token response system SHALL support token modifiers whose value depends on the cumulative amount consumed within the current `pendingDamage` window.

#### Scenario: First single use applies the first-step modifier
- **GIVEN** the attacker is the current responder in a `beforeDamageDealt` window
- **AND** Samurai has `3` stacks of `Honor`
- **AND** the pending damage starts at `4`
- **WHEN** the player clicks `Honor` once
- **THEN** the pending damage becomes `5`
- **AND** `pendingDamage.tokenUsageTotals.honor` becomes `1`
- **AND** `Honor` remains usable in the same response window

#### Scenario: Second single use applies the incremental modifier and closes further use
- **GIVEN** the same response window has already consumed `1` stack of `Honor`
- **AND** the pending damage is `5`
- **WHEN** the player clicks `Honor` one more time
- **THEN** the pending damage increases by `2` more to `7`
- **AND** Samurai still keeps any unspent `Honor` stacks outside this window
- **AND** the UI and validation layer no longer allow a third `Honor` use in that same response window

### Requirement: Zero-Modifier Response Tokens Can Trigger Custom Actions
The DiceThrone token response system SHALL support response tokens whose direct damage modifier is `0` but whose use triggers a custom action against the original attack context.

#### Scenario: Samurai Back Strike retaliates without reducing incoming damage
- **GIVEN** Samurai is the defender in a `beforeDamageReceived` window
- **AND** Samurai has `1` stack of `samurai_retribution` (`Back Strike`)
- **AND** the incoming attack damage is `5`
- **WHEN** the player clicks `Back Strike`
- **THEN** the token is consumed
- **AND** the system rolls `1` die for the `Back Strike` custom action
- **AND** the original attacker immediately receives retaliation damage derived from that die result
- **AND** Samurai still takes the full incoming `5` damage unless another mitigation effect changes it
