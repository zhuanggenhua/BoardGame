## ADDED Requirements

### Requirement: FX surfaces SHALL support board, table, screen, and UI coordinate spaces
The FX rendering system SHALL provide named FX surfaces that convert anchors into surface-local coordinates without assuming every game has a grid map.

#### Scenario: Board game resolves anchors relative to an arena surface
- **GIVEN** a game has a visible board or arena surface
- **WHEN** a unit, mage, token, card, or attachment slot registers as an FX anchor on that surface
- **THEN** the FX system MUST resolve that anchor into coordinates local to the board surface
- **AND** the resolved coordinates MUST NOT require a whole-cell fallback when the visible object body exists

#### Scenario: Table game resolves anchors without row or column coordinates
- **GIVEN** a game such as Smash Up has bases, minions, action cards, discard piles, player panels, or VP areas but no grid map
- **WHEN** those visible objects register as FX anchors on a table surface
- **THEN** the FX system MUST resolve source and target coordinates without requiring `row`, `col`, or `cell`

#### Scenario: UI layer effect declares screen or overlay surface explicitly
- **GIVEN** an effect is a full-screen celebration, toast-like burst, or overlay-only visual
- **WHEN** it is spawned
- **THEN** the effect MUST declare a `screen` or `ui` surface rather than pretending to target a board or table entity

### Requirement: One-shot FX SHALL consume spawn-time anchor snapshots
The FX rendering system SHALL capture immutable source and target anchor snapshots when spawning one-shot effects such as summon, projectile, impact, destroy, damage float, movement, push, teleport, or VP flight.

#### Scenario: Target disappears after effect spawn
- **GIVEN** a target object is visible when an attack FX is spawned
- **AND** the domain state removes that object during the same resolved event batch
- **WHEN** the projectile and impact continue playing
- **THEN** the effect MUST use the captured target snapshot
- **AND** it MUST NOT retarget to the cell center, table center, or a replacement object

#### Scenario: Layout changes after effect spawn
- **GIVEN** a one-shot effect has captured source and target snapshots
- **WHEN** the table, board, hand, or player panel reflows while the effect is still playing
- **THEN** the already spawned effect MUST keep playing from its captured snapshot unless it explicitly declared tracking mode

#### Scenario: Snapshot is missing
- **GIVEN** a one-shot effect requires a source or target anchor snapshot
- **WHEN** the anchor cannot be resolved at spawn time
- **THEN** the FX system MUST fail close with a structured diagnostic or use an explicitly declared fallback
- **AND** it MUST NOT silently guess a whole cell, whole table, or nearest object

### Requirement: Tracking FX SHALL be explicit and lifecycle-bound
The FX rendering system SHALL distinguish one-shot spawn snapshots from tracking anchors. Runtime tracking MUST be opt-in and tied to an explicit lifecycle policy.

#### Scenario: Buff aura follows its host
- **GIVEN** a persistent buff, aura, channeling ring, or attached visual declares tracking mode
- **WHEN** the host object moves or its visible slot changes
- **THEN** the FX system MAY update the effect position from the live anchor registry
- **AND** the effect MUST declare what happens if the host anchor disappears

#### Scenario: Projectile does not track a moving or removed target
- **GIVEN** a projectile, hit flash, summon burst, or damage float is a one-shot effect
- **WHEN** the source or target moves after spawn
- **THEN** the effect MUST keep its spawn snapshot coordinates
- **AND** it MUST NOT switch into live tracking implicitly

### Requirement: FX renderers SHALL be isolated from game-specific DOM queries
Game-specific FX renderers SHALL map cue params to shared presets and SHALL NOT query game Board DOM directly to discover object, card, base, unit, mage, token, or attachment positions.

#### Scenario: Renderer receives resolved snapshots
- **GIVEN** an FX renderer needs source and target positions
- **WHEN** the effect is rendered
- **THEN** the renderer MUST receive resolved snapshots or declared surface coordinates through the FX event
- **AND** it MUST NOT call query selectors against game-specific test ids or data attributes

#### Scenario: Game Board owns anchor registration
- **GIVEN** a game has custom visible objects such as Mage Wars units or Smash Up bases
- **WHEN** those objects need to be FX targets
- **THEN** the game Board MUST register their anchors through the shared anchor registry boundary
- **AND** the FX renderer MUST remain reusable across games

### Requirement: Visual lifecycle SHALL preserve destroyed-object presentation when needed
The FX rendering system SHALL provide a visual entity lifecycle path for objects whose visual body must remain available until spawned effects reach their owned impact or completion points. This lifecycle MUST be part of the existing FX presentation system and MUST NOT create a second animation pipeline.

#### Scenario: Destroyed target remains available for hit presentation
- **GIVEN** a target object is destroyed by the event that spawned an attack or damage FX
- **WHEN** the effect needs the target body for impact, shake, flash, shatter, or damage float presentation
- **THEN** the visual layer MUST preserve an object snapshot or held visual until the relevant effect lifecycle point
- **AND** the real domain state MUST remain already resolved

#### Scenario: Multiple effects hold the same destroyed target
- **GIVEN** a destroyed target is still needed by two active presentation owners
- **WHEN** one owner completes or releases its hold
- **THEN** the target body MUST remain visible while the other owner is still active
- **AND** the target body MUST leave only after the last owner releases it

#### Scenario: Held visual does not duplicate live object
- **GIVEN** an object still exists in the real rendered list
- **WHEN** a held visual is considered for the same object id
- **THEN** the visual layer MUST NOT render a duplicate held object for that id

#### Scenario: Numeric display buffer does not replace entity hold
- **GIVEN** a game delays visible HP or damage changes until impact
- **WHEN** a board entity itself has already left authoritative state but must still be seen
- **THEN** the game MUST use visual entity lifecycle / held visual for the entity body
- **AND** it MUST NOT treat numeric state buffering as sufficient proof that the entity body is preserved

#### Scenario: Visual entity lifecycle stays inside the FX system
- **GIVEN** a game needs to preserve a destroyed or moved entity body for an active effect
- **WHEN** it implements the visual hold
- **THEN** it MUST use the shared visual entity lifecycle entry or extend that shared entry
- **AND** it MUST NOT create a parallel game-specific animation bus, particle renderer, or ad hoc held-object framework

### Requirement: Cross-game verification SHALL cover both grid and non-grid FX anchors
The FX rendering system SHALL include tests proving that anchor snapshots work for both grid-based boards and non-grid table layouts.

#### Scenario: Grid board process frames are anchored to visible entities
- **GIVEN** a grid or arena game plays summon, projectile, impact, or movement FX
- **WHEN** automated verification captures process frames or audits geometry
- **THEN** the FX center, path, and impact area MUST be checked against the visible entity anchor rather than only the target cell

#### Scenario: Non-grid table process frames are anchored to cards or table objects
- **GIVEN** a non-grid game such as Smash Up plays card, base, VP, or power FX
- **WHEN** automated verification audits the effect geometry
- **THEN** the FX source and target MUST be checked against the registered card, base, pile, tray, or score anchor
- **AND** the test MUST NOT require a board cell coordinate
