## ADDED Requirements

### Requirement: Blocking Choices SHALL Be Represented As Choice Requests

InteractionSystem SHALL represent every new or migrated blocking business choice as a Choice Request before projecting it to any UI surface or AI action list.

#### Scenario: Rule flow creates a blocking choice
- **GIVEN** a game rule, system, or resolution frame needs a player to choose targets, cards, board objects, dice, values, confirmation, skip, or pass
- **WHEN** it creates a blocking choice in a request-owned flow
- **THEN** it MUST create a Choice Request with actor, owner frame, choice kind, candidates, selection constraints, visibility, skip policy, and resolution owner
- **AND** it MUST NOT create a UI-only interaction as the sole source of legal candidates

#### Scenario: Choice Request is bound to the owner frame
- **GIVEN** a Choice Request is created while a resolution frame is running
- **WHEN** the request blocks progress
- **THEN** InteractionSystem MUST bind the request to that frame
- **AND** resolving the request MUST resume or complete the same owner path rather than creating a second continuation chain

### Requirement: Choice Request Candidates SHALL Be The Shared Human And AI Action Source

InteractionSystem SHALL expose the same Choice Request candidate set to human UI, AI legal action generation, server validation summaries, and recovery diagnostics under the same visibility boundary.

#### Scenario: Human can click a candidate
- **GIVEN** a human player's UI surface renders a selectable Choice Request candidate
- **WHEN** the same seat is controlled by AI under the same visible information boundary
- **THEN** the candidate MUST have a corresponding AI legal action or be covered by an explicit skip, pass, confirm, or unsupported declaration
- **AND** the AI path MUST NOT require a second hand-written candidate list to know that the candidate exists

#### Scenario: Candidate becomes unavailable
- **GIVEN** a Choice Request candidate was previously visible and enabled
- **WHEN** live state refresh makes it unavailable
- **THEN** the Choice Request projection MUST update or invalidate the candidate consistently for UI and AI
- **AND** stale candidates MUST NOT remain executable only through one surface

### Requirement: UI Surfaces SHALL Be Choice Request Adapters

UI surfaces SHALL adapt Choice Requests for display and input collection; they MUST NOT own the rule truth, AI semantics, skip policy, or recovery behavior.

#### Scenario: Direct field selection renders a Choice Request
- **GIVEN** a game uses board, field, or map direct selection instead of a modal
- **WHEN** the UI highlights selectable regions or objects
- **THEN** those highlights MUST come from Choice Request candidates
- **AND** confirming the selection MUST resolve the request through its declared resolution owner

#### Scenario: Simple-choice renders a Choice Request
- **GIVEN** a migrated choice is displayed through a simple-choice style modal
- **WHEN** the player selects an option
- **THEN** the modal MUST act as an adapter over Choice Request candidates
- **AND** it MUST NOT become the authoritative source of candidate identity, selection bounds, AI support, or skip behavior

### Requirement: Simple Choice SHALL Remain A Legacy Surface, Not A New Decision Framework

InteractionSystem MAY keep simple-choice compatibility for existing games, but new games and approved migration batches MUST use Choice Requests as the business choice entry point.

#### Scenario: New game introduces a blocking choice
- **GIVEN** a new game such as Betrayal, Mage Wars, Qidahen, or a future game adds a blocking business choice
- **WHEN** the choice can block a human or AI seat
- **THEN** the implementation MUST use a Choice Request first
- **AND** it MUST NOT introduce a naked `createSimpleChoice` call as the primary business entry point

#### Scenario: Existing heavy user remains on legacy adapter
- **GIVEN** an existing heavy simple-choice user such as Smash Up or Summoner Wars has not migrated a specific interaction family
- **WHEN** that legacy interaction continues to run
- **THEN** it MAY continue through a thin compatibility adapter
- **AND** the adapter MUST NOT own new AI strategy, permission rules, recovery policy, or a second lifecycle
