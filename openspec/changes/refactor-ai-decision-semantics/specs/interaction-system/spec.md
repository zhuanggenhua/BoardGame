## ADDED Requirements

### Requirement: Interactions MAY expose AI decision semantics independent from UI kind
The interaction system SHALL allow an interaction to expose AI-facing decision semantics that describe the required rule decision independently from the interaction's UI `kind`.

#### Scenario: UI kind remains presentation-specific
- **GIVEN** an interaction uses a game-specific UI kind
- **AND** the interaction data exposes a semantic decision descriptor
- **WHEN** UI renders the interaction
- **THEN** UI MAY continue using the game-specific kind and data
- **AND** AI MUST be able to consume the semantic descriptor without depending on the UI kind

#### Scenario: Semantic descriptor is safe for AI context
- **GIVEN** an interaction descriptor is included in an AI-visible player view
- **WHEN** the AI context snapshot is built
- **THEN** the semantic descriptor MUST only include candidates and metadata visible to that AI player
- **AND** hidden information MUST remain filtered by the existing player view boundary

### Requirement: New blocking interactions SHALL declare AI support status
The interaction system SHALL require new blocking interactions intended for AI-controllable seats to declare how AI should handle them: by semantic descriptor, by game adapter, or by an explicit unsupported status.

#### Scenario: New interaction declares semantic support
- **GIVEN** a new interaction kind is added
- **WHEN** the interaction can block an AI-controlled seat
- **THEN** the implementation MUST declare a semantic descriptor or adapter path
- **AND** tests or diagnostics MUST verify the interaction can produce legal AI actions

#### Scenario: Human-only interaction is explicit
- **GIVEN** an interaction is intentionally human-only
- **WHEN** the interaction is created
- **THEN** it MUST be marked as unsupported for AI or prevented from being assigned to an AI-controlled seat
- **AND** runtime diagnostics MUST report a clear reason if this invariant is violated
