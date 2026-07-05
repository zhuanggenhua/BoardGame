## ADDED Requirements
### Requirement: The Gang Shared Undo UI Bridge
The system SHALL expose The Gang undo snapshots through the shared undo HUD context rather than leaving undo as a hidden engine-only capability.

#### Scenario: Board provides undo state
- **GIVEN** The Gang Board is mounted
- **WHEN** the shared HUD queries undo state
- **THEN** the HUD can read the current match state, dispatch function, player id, game-over flag, and local-mode flag from `UndoProvider`

#### Scenario: Snapshot policy is explicit
- **GIVEN** The Gang commands execute through the engine pipeline
- **WHEN** undo snapshots are configured
- **THEN** The Gang uses a dedicated undo snapshot allowlist
- **AND** action-log formatting and undo snapshot policy are not coupled to the same exported constant
