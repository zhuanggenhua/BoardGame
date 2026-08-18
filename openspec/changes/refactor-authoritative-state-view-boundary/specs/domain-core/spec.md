## ADDED Requirements

### Requirement: Domain rule state MUST be written only by rule paths
Domain values that affect validation, response-window settlement, final reducers, or player-visible formal results MUST be written through the game's rule path: command execution, domain events, reducers, or explicit domain helpers called by those paths.

UI selectors, player views, animation state, AI heuristics, debug snapshots, and test-only labels MUST NOT write or synthesize rule state.

#### Scenario: Dice roll crosses UI and rule branch
- **GIVEN** a game creates a dice roll that is shown to players and later selects an event branch
- **WHEN** the roll result is committed
- **THEN** the committed dice values and total MUST come from command/event/reducer state or a domain helper called by that path
- **AND** the event branch MUST NOT read UI animation state or preview text

#### Scenario: Damage crosses response and final settlement
- **GIVEN** a game creates damage that can be modified by a response window before HP changes
- **WHEN** responses complete
- **THEN** final HP loss MUST be resolved from the game's pending rule state or final damage event
- **AND** the visible damage summary MUST remain read-only

### Requirement: Domain views and estimates MUST NOT feed authoritative rules
Domain views, UI summaries, animation state, AI heuristics, debug snapshots, and test-only labels MUST NOT be used as authoritative inputs for validation, response-window settlement, final reducers, or player-visible formal values.

If a value is intended to influence rules, it MUST be produced through the domain command/event/reducer path or through an explicit domain helper called from that path.

#### Scenario: UI summary cannot become rule input
- **GIVEN** a UI summary displays a current damage, dice total, resource cost, or score value
- **WHEN** a rule checks whether an action is legal or what final event should be emitted
- **THEN** the rule MUST read domain rule state or committed event results
- **AND** it MUST NOT read the UI summary or its intermediate formatting fields

#### Scenario: AI hint cannot become player-visible formal value
- **GIVEN** an AI hint estimates expected damage, dice value, resource gain, or score
- **WHEN** a player-visible formal value or final settlement is needed
- **THEN** the system MUST use domain rule state or committed event results
- **AND** it MUST NOT expose the AI hint as the formal value

### Requirement: Domain readers MUST fail closed instead of reconstructing missing rule state from views
When validation, response windows, final reducers, or formal player-visible summaries require rule state, the reader MUST fail closed, reject, or use an explicitly declared domain fallback if that state is missing.

The reader MUST NOT silently reconstruct missing rule state from UI state, AI estimates, animation values, debug snapshots, default definitions, or stale coordinates.

#### Scenario: Missing dice rule state is rejected
- **GIVEN** an event branch requires the committed result of a prior dice roll
- **WHEN** no committed roll exists in domain rule state or events
- **THEN** the branch resolution MUST fail closed or reject according to the owning rule
- **AND** it MUST NOT infer the dice result from animation state or display text

#### Scenario: Missing damage rule state is rejected
- **GIVEN** a response window attempts to modify incoming damage
- **WHEN** no matching pending damage exists in domain rule state or events
- **THEN** the system MUST fail closed or reject according to the owning rule
- **AND** it MUST NOT patch unrelated pending fields to continue
