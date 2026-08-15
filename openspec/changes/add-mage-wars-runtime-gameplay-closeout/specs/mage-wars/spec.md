## ADDED Requirements

### Requirement: Mage Wars Formal Core Flow Runtime
The Mage Wars runtime SHALL expose a real player-driven Beastmaster/Priestess two-faction core loop on the formal 4x3 arena, including spell planning, legal source/target selection, spell resolution, creature action, attack settlement, and phase advancement.

#### Scenario: Player drives the core loop from the formal entry
- **GIVEN** a two-player Mage Wars match is created through the formal entry
- **WHEN** the player selects configured spellbook cards, plans them, selects legal sources and targets, and advances through the action phase
- **THEN** the client MUST dispatch the corresponding Mage Wars domain commands
- **AND** the resulting state MUST reflect the validated mana, prepared cards, discard cards, arena objects, damage, status tokens, and current phase
- **AND** the default mages and starting zones MUST come from the config package formal starting deployment
- **AND** the arena MUST be `formal-4x3`, not the tutorial/apprentice 2x3 arena

### Requirement: Mage Wars Gameplay E2E Evidence
The Mage Wars core gameplay E2E SHALL use real page interactions and SHALL keep injected saturated layout tests separate from gameplay evidence.

#### Scenario: Real interaction E2E does not patch core state
- **GIVEN** the Mage Wars formal entry is available
- **WHEN** the core gameplay E2E runs
- **THEN** it MUST begin from the formal setup state and drive the page controls or board selection targets
- **AND** it MUST NOT patch `core`, `players`, `objects`, `arena`, or phase state through the test harness
- **AND** it MUST assert real state changes after planning, deployment, casting/targeting, movement or guard, attack settlement, and phase advancement

### Requirement: Mage Wars Gameplay Completion Boundary
The gameplay closeout SHALL report the formal Beastmaster/Priestess two-faction core flow as a scoped deliverable and SHALL not claim tutorial, complete physical Mage Wars catalog, or deferred product systems.

#### Scenario: Closeout reports deferred scope
- **WHEN** the formal Beastmaster/Priestess gameplay loop passes its runtime and E2E gates
- **THEN** the closeout MUST still list full catalog, free construction, four-player mode, deluxe arena, expansion mages, full AI, tutorial, action-log UI, and undo UI as deferred unless separately implemented and verified

### Requirement: Mage Wars Completion Coverage Matrix
The gameplay closeout SHALL use an explicit coverage matrix before it claims that the two-faction flow is complete.

#### Scenario: Representative chains do not imply full spell coverage
- **WHEN** the closeout reports Beastmaster/Priestess flow coverage
- **THEN** it MUST list the current runtime spell/object pool, the representative E2E chain for each claimed family, the screenshots or tests that prove each family, and the families that remain uncovered
- **AND** it MUST mark wall / wall-spell play, wall-edge targeting, line of sight blocking, passage attacks, full catalog coverage, and any unlisted spell family as deferred unless each has its own runtime object, legal target UI, domain state, browser E2E, and screenshot evidence
- **AND** it MUST NOT infer wall coverage from creature, equipment, enchantment, incantation, attack, or conjuration representative chains
