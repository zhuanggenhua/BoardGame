## ADDED Requirements

### Requirement: Smash Up Shared Duel Lifecycle Triggers

The Smash Up duel system SHALL expose shared trigger timings for duel start and duel resolution so cross-cutting effects can integrate without directly mutating active duel state.

#### Scenario: Duel-start triggers fire before Pinkerton resolution

- **WHEN** a duel starts
- **THEN** the game SHALL fire `onDuelStarted` before the Pinkerton stage begins
- **AND** the trigger context SHALL identify the challenger, challenged, duel source, and duel base

#### Scenario: Duel-resolved triggers fire after the outcome is known

- **WHEN** a duel resolves
- **THEN** the game SHALL fire `onDuelResolved` after winner, loser, or tie are determined
- **AND** the trigger context SHALL identify the duel outcome, winner, loser, and duel base

#### Scenario: Shared duel triggers support non-titan effects without direct active-duel mutation

- **WHEN** an ability integrates with duel start or duel resolution
- **THEN** it SHALL do so through the shared trigger timings
- **AND** it SHALL not directly mutate `activeDuel` outside the duel engine
