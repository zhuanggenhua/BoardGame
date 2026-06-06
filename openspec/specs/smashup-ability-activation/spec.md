# smashup-ability-activation Specification

## Purpose
TBD - created by archiving change refactor-smashup-special-activation-model. Update Purpose after archive.
## Requirements
### Requirement: Smash Up Manual Special Activation Must Be Explicit
The Smash Up runtime MUST use explicit activation metadata, rather than `abilityTags.special` alone, to determine whether a non-titan card can be manually activated.

#### Scenario: Board minion special highlight follows explicit manual activation
- **WHEN** a minion has printed `Special:` text but no explicit manual activation entry
- **THEN** the board MUST NOT highlight it as manually activatable
- **AND** `ACTIVATE_SPECIAL` validation MUST reject manual activation for that minion

#### Scenario: Discard special remains manually activatable when explicitly declared
- **WHEN** a card's runtime model declares discard-based manual special activation
- **THEN** the system MUST continue to allow `ACTIVATE_SPECIAL` from the discard pile for that card

### Requirement: Smash Up Response-Window Playability Must Be Separate From Manual Activation
The Smash Up runtime MUST model response-window playability separately from manual activation.

#### Scenario: Hand special playable in a scoring window is not treated as board activation
- **WHEN** a card may be played from hand in a `beforeScoring` or `afterScoring` window
- **THEN** the runtime MUST expose it through response-window playability rules
- **AND** it MUST NOT require board-manual activation metadata unless it is also manually activatable on board

#### Scenario: Me First! minion play remains available without board special tagging
- **WHEN** a minion is playable from hand in the Me First! window
- **THEN** the runtime MUST determine that availability from explicit response-window metadata or its compatibility alias
- **AND** not from `abilityTags.special`

### Requirement: Trigger-Driven Printed Special Text Must Not Imply Clickability
Printed `Special:` text that is implemented via triggers or auto-created interactions MUST NOT imply manual clickability.

#### Scenario: After-scoring transfer card remains trigger-driven only
- **WHEN** an ongoing action has printed `Special:` text that is implemented via an `afterScoring` trigger
- **THEN** the runtime MUST keep its trigger behavior
- **AND** MUST NOT expose it as a generic board-manual special activation unless explicitly declared

#### Scenario: Before-scoring scoring trigger remains trigger-driven only
- **WHEN** a minion has printed `Special:` text that is implemented via a `beforeScoring` trigger
- **THEN** the runtime MUST create the correct scoring-window interaction
- **AND** MUST NOT expose it as a generic board-manual special activation unless explicitly declared

