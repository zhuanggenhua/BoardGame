## ADDED Requirements

### Requirement: New or migrated durable domain references use runtime entity identity

Domain state introduced by new games or newly migrated state families that can survive beyond the immediate command or reducer branch MUST reference runtime objects by entity identity rather than by current coordinate.

Coordinates such as slot index, base index, row, column, hand index, or array position MAY be used for current-state lookup, UI targeting, sorting, and immediate command validation, but MUST NOT be the sole durable identity for state that can outlive replacement, movement, removal, delayed resolution, saved-game restore, or replay.

#### Scenario: Replacement object does not inherit old durable state

- **GIVEN** an entity in a board slot has a temporary modifier attached to its runtime identity
- **WHEN** that entity leaves play and a replacement entity enters the same slot
- **THEN** the temporary modifier is not applied to the replacement entity
- **AND** resolving the old modifier by slot alone is not allowed

#### Scenario: Immediate command may still use a coordinate

- **GIVEN** a player selects the current object in slot 2
- **WHEN** the command is validated immediately against current domain state
- **THEN** the coordinate can be resolved to the current entity
- **AND** any deferred state created from that command stores the resolved entity identity, not only slot 2

### Requirement: Entity references remain deterministic and serializable

Runtime entity references used by domain events, reducer state, saved games, tests, and replay MUST be serializable and deterministic.

Entity ids MUST be allocated by deterministic domain progression. They MUST NOT rely on random UUIDs, wall-clock time, process-local object identity, or non-replayable side effects.

#### Scenario: Replay allocates matching ids

- **GIVEN** a saved event sequence creates three runtime entities
- **WHEN** the sequence is replayed from the same initial state
- **THEN** the resulting entity ids match the original run
- **AND** entity-bound effects resolve to the same entities after replay

### Requirement: Stale entity references fail closed

When domain logic resolves an entity reference, it MUST confirm that the entity exists, has the expected kind, and is still valid for the requested operation. If the reference is stale or kind-mismatched, the operation MUST reject, skip, or clean up according to the owning rule; it MUST NOT silently retarget to another object occupying the same coordinate.

#### Scenario: Stale delayed effect is cleaned instead of retargeted

- **GIVEN** a delayed effect references an entity that has left play
- **WHEN** the delayed effect attempts to resolve
- **THEN** the resolver reports the reference as stale
- **AND** the effect is cleaned, rejected, or skipped according to its declared lifecycle policy
- **AND** no replacement entity at the old coordinate receives the effect
