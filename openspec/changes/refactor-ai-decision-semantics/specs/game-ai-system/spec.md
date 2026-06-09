## ADDED Requirements

### Requirement: AI legal actions SHALL be derived from decision semantics, not UI interaction shells
The system SHALL provide a cross-game AI decision semantics layer so game runtimes can derive `AiLegalAction` objects from rule decisions such as selecting a player, selecting a card, selecting a board object, selecting dice, modifying a value, confirming, or skipping. AI implementations SHALL NOT be required to inspect UI interaction shell names as their primary source of meaning.

#### Scenario: Different UI shells represent the same player-target decision
- **GIVEN** two interactions have different UI `kind` values
- **AND** both represent "choose one target player" with legal candidate players
- **WHEN** the AI runtime builds legal actions
- **THEN** both interactions MUST be normalized to the same `select-player` decision semantic
- **AND** the resulting actions MUST carry game-specific commands only at the adapter boundary

#### Scenario: AI keeps using existing command execution
- **GIVEN** a semantic AI decision has been converted into an `AiLegalAction`
- **WHEN** AI chooses that action
- **THEN** the action MUST still execute through the existing command pipeline
- **AND** validation MUST remain the authority for whether the command is legal

### Requirement: AI-owned blocking interactions SHALL be diagnosable when unsupported
The system SHALL detect AI-owned blocking interactions that cannot produce legal actions because they lack decision semantics, a game adapter, or an explicit unsupported marker.

#### Scenario: Unsupported interaction is caught by a gate
- **GIVEN** an interaction is currently blocking a local AI or remote AI seat
- **AND** the interaction has no semantic decision descriptor
- **AND** the game runtime has no adapter for it
- **WHEN** the AI legal action gate runs in tests or diagnostics
- **THEN** the gate MUST report the interaction kind and source
- **AND** the system MUST NOT silently treat the absence of actions as a valid idle decision

### Requirement: Games SHALL own strategy, while the engine owns common decision shapes
The system SHALL keep common decision shapes in the engine AI layer while allowing each game to supply strategic scoring, command adapters, and game-specific candidate metadata.

#### Scenario: Game-specific command adapter preserves domain commands
- **GIVEN** a game maps `select-player` semantics to a domain command such as choosing a defender or resolving a card interaction
- **WHEN** the shared AI action builder creates actions
- **THEN** the game adapter MUST provide the command payload
- **AND** the shared builder MAY provide common IDs, labels, target hints, and metadata

#### Scenario: Game strategy still controls target preference
- **GIVEN** a semantic decision includes multiple legal player targets
- **WHEN** the local AI scorer ranks actions
- **THEN** game-specific scoring MAY prefer different targets based on game state
- **AND** the semantic layer MUST NOT hard-code game strategy beyond generic relation and effect hints

### Requirement: AI decision semantics SHALL preserve complex interaction invariants
The system SHALL support semantic decisions for complex games without losing selection bounds, ordering, visibility, or candidate freshness.

#### Scenario: Ordered multi-selection remains ordered
- **GIVEN** a rule decision requires choosing multiple candidates in order
- **WHEN** the decision is exposed to AI
- **THEN** the descriptor MUST declare that ordering matters
- **AND** generated legal actions MUST preserve the selected order in command payloads

#### Scenario: Chained decision refreshes candidates
- **GIVEN** one interaction decision changes the legal candidates for the next interaction
- **WHEN** the next AI decision context is built
- **THEN** semantic candidates MUST be rebuilt from the current state
- **AND** AI MUST NOT reuse stale candidates from the previous interaction

#### Scenario: Hidden information stays hidden
- **GIVEN** a decision contains private candidates visible only to the acting player
- **WHEN** another player or remote AI receives a visible context
- **THEN** the descriptor MUST omit or redact those private candidates according to `playerView`
- **AND** the resulting legal actions MUST NOT reveal hidden candidate identities
