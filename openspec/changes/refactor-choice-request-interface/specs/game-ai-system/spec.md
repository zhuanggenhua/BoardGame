## ADDED Requirements

### Requirement: AI Legal Actions SHALL Be Generated From Choice Requests

The game AI system SHALL generate legal actions for request-owned blocking choices from Choice Requests rather than from UI surface names or game-specific duplicate candidate lists.

#### Scenario: UI shell changes but choice remains the same
- **GIVEN** a target-selection choice is rendered as a simple-choice modal in one view and as direct board selection in another view
- **WHEN** an AI-controlled seat receives the same visible choice
- **THEN** the AI legal action list MUST be generated from the same Choice Request
- **AND** the result MUST NOT depend on whether the human UI currently uses a modal, board highlight, dice panel, or card highlight

#### Scenario: Choice Request maps to a domain command
- **GIVEN** an AI chooses a legal action generated from a Choice Request
- **WHEN** the system prepares the action for execution
- **THEN** the action MUST resolve through the request's declared command mapping or owner callback
- **AND** the command MUST still pass the normal validate / execute / reduce / systems pipeline

### Requirement: AI Policies SHALL Cover Every AI-Controllable Choice Kind

The game AI system SHALL require a shared or game-specific policy for every Choice Request kind that can block an AI-controlled seat.

#### Scenario: Generic policy covers simple resolution
- **GIVEN** a request is optional skip, pass, confirm-current, or single forced candidate
- **WHEN** no game-specific strategy is needed
- **THEN** the shared AI policy MAY resolve it deterministically
- **AND** the resulting choice MUST still be represented as a normal legal action selection

#### Scenario: Game-specific policy is missing
- **GIVEN** a Choice Request kind requires game-specific strategy or target scoring
- **AND** the game has not registered a policy for that kind
- **WHEN** that request is assigned to an AI-controlled seat
- **THEN** the AI system MUST report a missing-policy diagnostic
- **AND** it MUST NOT silently return an empty action list as if the AI chose to wait

### Requirement: AI-Owned Choice Requests SHALL Resolve Or Fail Close

The game AI system SHALL ensure that an AI-owned Choice Request either resolves with a legal action, explicitly skips/passes/confirms when allowed, or fails close with diagnostics.

#### Scenario: Optional choice has no valuable candidate
- **GIVEN** an AI-owned request permits skip or pass
- **WHEN** the policy determines no candidate should be selected
- **THEN** the AI system MUST submit the explicit skip or pass legal action
- **AND** it MUST NOT leave the request open without an action

#### Scenario: Mandatory choice has no enabled candidate
- **GIVEN** an AI-owned request requires at least one enabled candidate
- **AND** the visible candidate set is empty, disabled, or below the minimum selection count
- **WHEN** AI legal actions are generated
- **THEN** the system MUST classify the request as invalid or unresolved
- **AND** it MUST emit diagnostics for recovery and feedback instead of waiting for a watchdog timeout

### Requirement: Human And AI Choice Parity SHALL Be Verified For Migrated Games

Migrated games SHALL prove that human-visible Choice Request candidates and AI legal actions remain aligned for every AI-controllable blocking choice.

#### Scenario: First-batch game migrates a choice family
- **GIVEN** Mage Wars, Qidahen, Betrayal, Cardia, TicTacToe, or a new game migrates a blocking choice family
- **WHEN** tests build a visible Choice Request for a human seat and an AI seat under equivalent visible information
- **THEN** every enabled human candidate MUST map to an AI legal action or explicit skip/pass/confirm action
- **AND** any intentional human-only decision MUST be declared unsupported before it can block an AI seat
