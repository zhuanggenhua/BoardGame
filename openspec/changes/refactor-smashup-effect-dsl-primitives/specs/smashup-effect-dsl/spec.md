## ADDED Requirements

### Requirement: Effect primitive single source of truth
Smash Up ability effects SHALL support typed effect primitives where the same primitive produces both runtime behavior and `SmashUpReactionResourceFootprint` metadata.

#### Scenario: Primitive emits event and footprint
- **GIVEN** a Smash Up ability effect is implemented with an event-producing primitive
- **WHEN** the runtime executes the ability
- **THEN** the ability emits the expected Smash Up event
- **AND** the ordering system can derive the same concrete resource refs from the primitive without requiring a hand-written read/write contract.

### Requirement: AbilityRuntime footprint metadata
AbilityRuntime SHALL allow program nodes to expose footprint derivation metadata and SHALL preserve composition through sequence and branch programs.

#### Scenario: Sequence footprint is composed
- **GIVEN** a sequence program contains two effect primitives
- **WHEN** reaction ordering asks for the trigger footprint
- **THEN** the derived footprint includes reads/writes from both steps.

### Requirement: Probe fallback compatibility
Smash Up reaction ordering SHALL prefer DSL/program footprints and SHALL fall back to existing event/interaction probing only when a program has no footprint metadata or footprint derivation fails.

#### Scenario: Legacy ability still works
- **GIVEN** an existing ability has not been migrated to Effect DSL
- **WHEN** reaction ordering evaluates conflicts
- **THEN** the existing runtime probe path remains available and produces the same ordering behavior as before.

### Requirement: UI interaction reuse
Effect DSL prompt primitives SHALL create normal InteractionSystem descriptors rather than a separate UI flow.

#### Scenario: Field selection remains normal
- **GIVEN** a DSL ability requires selecting a minion on the board
- **WHEN** the prompt opens
- **THEN** it uses the existing structured interaction metadata and target type
- **AND** resolving it continues through the normal ability runtime prompt handler.

### Requirement: OR branch options carry concrete resources
Smash Up OR/optional branch prompts SHALL be able to carry branch-level `SmashUpReactionResourceFootprint` metadata generated from Effect DSL primitives or concrete target options.

#### Scenario: OR branch footprint is preserved through normal prompt UI
- **GIVEN** an OR ability offers "return a minion" and "extra minion" branches
- **WHEN** the prompt is queued as a normal simple-choice interaction
- **THEN** each branch option can expose concrete resources such as `minion:<uid>`, `base:<index>`, `playerHand:<playerId>`, and `playerPlayLimit:<playerId>`
- **AND** reaction ordering can derive those resources from the interaction without a hand-written read/write contract.
