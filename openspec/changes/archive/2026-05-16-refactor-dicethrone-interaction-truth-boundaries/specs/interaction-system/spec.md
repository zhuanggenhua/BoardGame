## ADDED Requirements

### Requirement: Interaction Semantic Truth Boundaries
The engine SHALL require each blocking interaction kind to represent one stable business semantic, rather than multiplexing unrelated meanings behind the same kind or field shape.

#### Scenario: Generic choice does not encode defender targeting
- **GIVEN** a game has a generic branch choice interaction kind and a dedicated defender-targeting interaction
- **WHEN** the game requests defender targeting for an attack chain
- **THEN** the request MUST use the dedicated defender-targeting interaction semantic
- **AND** the generic choice interaction MUST remain reserved for true branch or option selection

#### Scenario: UI readers stay scoped to their own interaction semantic
- **GIVEN** the current interaction is a dedicated defender-targeting interaction
- **WHEN** generic choice UI helpers read the current interaction
- **THEN** they MUST NOT surface that interaction as a generic choice payload
- **AND** dedicated UI readers MAY expose a defender-targeting payload for game-specific UI

### Requirement: Dedicated Defender Choice Interaction
Games that need to choose the defender of an in-flight attack SHALL be able to model that step as a dedicated blocking interaction instead of reusing a generic player-choice branch.

#### Scenario: Targeting roll opens dedicated defender choice
- **GIVEN** a DiceThrone 4-player targeting roll result that requires manual defender selection
- **WHEN** the attack cannot auto-resolve its defender
- **THEN** the system MUST open a dedicated defender-choice interaction
- **AND** the interaction payload MUST describe valid defender candidates for the current pending attack

#### Scenario: Defender choice resolution writes back the authoritative defender
- **GIVEN** a dedicated defender-choice interaction is resolved with a valid defender
- **WHEN** the domain applies that resolution
- **THEN** the pending attack MUST write that defender into its authoritative state
- **AND** the interaction MUST be marked complete without going through generic simple-choice handlers
