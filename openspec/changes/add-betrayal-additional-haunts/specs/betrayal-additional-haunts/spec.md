## ADDED Requirements

### Requirement: Additional Haunts Must Enter Through Complete Runtime Chains

The `betrayal` game MUST only mark haunt numbers 3, 12, and 33 as implemented after each haunt has a complete structured runtime chain from event trigger to endgame.

#### Scenario: Unimplemented haunt remains gated

- **GIVEN** an event can trigger haunt 3, 12, or 33
- **WHEN** the corresponding haunt runtime has not completed domain, UI, AI, and verification work
- **THEN** the game MUST reject the success branch with a clear unimplemented-haunt error
- **AND** the event MUST remain outside the formal runtime event deck

#### Scenario: Implemented haunt enters formal runtime

- **GIVEN** a haunt 3, 12, or 33 implementation has passed its domain tests, page/E2E representative chain, AI legality checks, and audit updates
- **WHEN** its trigger event resolves the success branch
- **THEN** the game MUST transition into that haunt's authoritative runtime state instead of the first-scenario runtime or a placeholder state

### Requirement: Haunt 3 Dust Runtime

The `betrayal` game MUST implement haunt 3 as a structured hidden-traitor runtime with Sickness tokens, Research tokens, Search/Cure actions, player-view secrecy, and official victory conditions.

#### Scenario: Dust haunt setup preserves hidden traitor secrecy

- **GIVEN** `一瓶微尘` succeeds at triggering haunt 3
- **WHEN** haunt setup resolves
- **THEN** the game MUST assign Sickness tokens according to the structured haunt contract
- **AND** each player view MUST reveal only the information that player is allowed to know

#### Scenario: Dust haunt reaches a real result

- **GIVEN** haunt 3 is active
- **WHEN** heroes complete the required cure path or the sickness outcome reaches the traitor win condition
- **THEN** the game MUST enter an endgame state with the correct winning side and haunt-specific result details

### Requirement: Haunt 12 Hungry House Runtime

The `betrayal` game MUST implement haunt 12 as a structured cultist and sacrifice runtime with Ritual Room/Chasm placement, Cultists, Number Track, corpse carrying, Feed Her, end-of-turn hero damage, and official victory conditions.

#### Scenario: Hungry House setup creates ritual state

- **GIVEN** `大宅饿了` succeeds at triggering haunt 12
- **WHEN** haunt setup resolves
- **THEN** the game MUST establish Ritual Room/Chasm availability, Cultist monsters, Number Track state, traitor setup rewards, and monster turn order through domain state

#### Scenario: Hungry House sacrifice advances the ritual

- **GIVEN** haunt 12 is active and the traitor carries a corpse on the Chasm tile
- **WHEN** Feed Her succeeds
- **THEN** the game MUST reduce the Number Track
- **AND** reaching zero MUST produce the traitor-side victory result

### Requirement: Haunt 33 Magic Camera Runtime

The `betrayal` game MUST implement haunt 33 as a structured magic-camera runtime with Magic Camera ownership, Phantom Photographers, Essence tokens, photo actions, camera destruction, line-of-sight attacks, and official victory conditions.

#### Scenario: Magic Camera setup selects the correct traitor

- **GIVEN** `说“茄子”！` succeeds at triggering haunt 33
- **WHEN** a hero owns the Magic Camera
- **THEN** that hero MUST become the traitor
- **AND** otherwise the event resolver MUST become the traitor

#### Scenario: Magic Camera heroes can win by destroying cameras

- **GIVEN** haunt 33 is active
- **WHEN** all Phantom Photographers have been killed and the Magic Camera has been smashed
- **THEN** the game MUST enter the heroes' victory endgame state

### Requirement: Additional Haunt Evidence Must Be Auditable

The `betrayal` project MUST keep the implementation, verification, and release claims for haunts 3, 12, and 33 auditable in the same evidence surface that currently tracks the half-implemented audit.

#### Scenario: Audit distinguishes contract, gate, and implementation

- **WHEN** a document describes haunts 3, 12, or 33
- **THEN** it MUST distinguish official source contract, runtime gate, partial branch evidence, and complete implementation evidence
- **AND** it MUST NOT describe a gated success branch as implemented

#### Scenario: Event deck count follows implemented haunts

- **WHEN** the formal runtime event deck count is reported
- **THEN** the count MUST match the events whose complete downstream haunt chains are implemented
- **AND** the audit MUST name any locked event contracts that are intentionally excluded from runtime

