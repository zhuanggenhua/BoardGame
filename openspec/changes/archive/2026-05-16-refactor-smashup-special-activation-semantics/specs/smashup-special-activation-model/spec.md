## ADDED Requirements

### Requirement: Smash Up SHALL separate printed Special text from runtime activation entrypoints
Smash Up card data MUST distinguish between a card whose printed rules text contains `Special:` and a card that exposes a player-triggered runtime activation entrypoint.

#### Scenario: Trigger-driven printed Special does not imply manual activation
- **GIVEN** a Smash Up card whose rules text contains `Special:`
- **AND** its actual runtime behavior is driven by `beforeScoring` or `afterScoring` trigger registration
- **WHEN** the game computes board-click activation availability
- **THEN** the card MUST NOT be treated as manually activatable only because its printed text contains `Special:`

### Requirement: Smash Up SHALL model manual activations explicitly
Smash Up card data MUST expose manual activation entrypoints through explicit activation metadata instead of inferring them from `abilityTags.special`.

#### Scenario: Board special availability is driven by explicit activation metadata
- **GIVEN** a Smash Up minion or ongoing action that may be manually activated from the board
- **WHEN** the game validates `ACTIVATE_SPECIAL` or computes activation highlight
- **THEN** it MUST read explicit activation metadata for zone and timing
- **AND** it MUST NOT rely on `abilityTags.special` as the sole source of truth

#### Scenario: Discard special availability is driven by explicit activation metadata or provider configuration
- **GIVEN** a Smash Up card that may be manually activated from discard
- **WHEN** the game validates discard-zone special usage
- **THEN** it MUST use explicit non-board activation semantics
- **AND** board activation availability MUST remain unaffected

### Requirement: Smash Up SHALL preserve response-window play semantics independently
Smash Up response-window card play semantics MUST remain independent from manual activation semantics.

#### Scenario: Hand response card remains playable without board activation semantics
- **GIVEN** a Smash Up card that may be played from hand in a `beforeScoring` or `afterScoring` response window
- **WHEN** the game checks response-window playability
- **THEN** it MUST use explicit response-window fields such as `beforeScoringPlayable`, `specialTiming`, or `responseWindowTiming`
- **AND** it MUST NOT require board manual activation metadata to be present

### Requirement: Smash Up SHALL keep UI and AI aligned with explicit activation semantics
UI highlighting, manual activation commands, and AI reactive-scoring heuristics MUST use the same explicit activation semantics.

#### Scenario: Board highlight and command validation agree
- **GIVEN** a Smash Up card on the board
- **WHEN** the UI decides whether to highlight it as manually activatable
- **THEN** that decision MUST agree with command validation for the same activation path

#### Scenario: AI does not overvalue printed Special text without a real entrypoint
- **GIVEN** a Smash Up card whose rules text contains `Special:` but whose runtime behavior is trigger-driven
- **WHEN** the AI computes reactive or scoring-window value
- **THEN** it MUST NOT treat the card as a manual activation option unless an explicit runtime entrypoint exists
