## ADDED Requirements

### Requirement: Engine primitives provide runtime entity identity

The shared engine primitives layer MUST provide a reusable runtime entity identity model for games that need durable references to runtime objects.

The primitive MUST distinguish identity from coordinate and MUST be usable by cards, units, bases, board occupants, tokens, summons, rooms, or other game-defined runtime objects.

#### Scenario: Game defines an entity kind for replaceable objects

- **GIVEN** a game has replaceable board objects
- **WHEN** the game registers or constructs those objects through the entity identity primitive
- **THEN** each runtime object receives a deterministic entity id
- **AND** the object can still expose its current coordinate separately

### Requirement: Entity ref resolution validates kind and lifecycle

The shared resolver for entity references MUST validate entity id, entity kind, and lifecycle validity before returning a target object.

If a compatibility fallback is present, it MUST be treated as diagnostic or migration data unless a game-specific compatibility adapter explicitly permits fallback resolution.

#### Scenario: Kind mismatch is rejected

- **GIVEN** an entity ref says it points to a base
- **WHEN** the id resolves to a card, token, or another non-base entity
- **THEN** the resolver rejects the reference
- **AND** the operation cannot continue against the wrong object kind

#### Scenario: Compatibility fallback does not silently retarget

- **GIVEN** an old saved state contains a fallback coordinate for an entity ref
- **WHEN** the primary entity id is missing
- **THEN** the resolver does not automatically use the current occupant of that coordinate
- **AND** fallback resolution only occurs through an explicit compatibility adapter with definition and lifecycle checks

### Requirement: Coordinate primitives remain available but non-authoritative

The engine primitives layer MUST continue to support coordinates for board traversal, UI layout, hit testing, sorting, and immediate command targeting.

The primitive documentation MUST state that coordinates are current locations, not durable runtime identity.

#### Scenario: UI renders by coordinate after identity resolution

- **GIVEN** a UI needs to render bases left-to-right
- **WHEN** the domain provides current base entities and their coordinates
- **THEN** the UI may sort and render by coordinate
- **AND** any long-lived modifier shown on a base is read from state bound to that base's entity identity
