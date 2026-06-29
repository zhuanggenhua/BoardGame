## ADDED Requirements

### Requirement: Betrayal Setup Truth Owners Must Be Explicit

The `betrayal` game MUST model pre-haunt setup with explicit owner boundaries between global setup, explorer identity data, scenario-specific setup, random pools, and runtime result state.

#### Scenario: Shared pre-haunt setup stays out of scenario overrides

- **GIVEN** a new `betrayal` match starts before any haunt-specific setup
- **WHEN** the domain creates its initial shared setup state
- **THEN** shared setup facts such as the starting tile layout, shared room stack presence, and explorer starting tile MUST come from shared pre-haunt setup data rather than being embedded inside explorer templates or haunt-specific overrides

#### Scenario: Scenario-only setup stays out of shared explorer templates

- **GIVEN** a haunt or first-scenario rule grants special starting objects, monsters, or turn-order overrides
- **WHEN** the corresponding scenario configuration is loaded
- **THEN** those scenario-only setup rules MUST be read from scenario configuration instead of being hardcoded into shared explorer template data

### Requirement: Betrayal Random Sources Must Be Separate From Runtime Results

The `betrayal` game MUST separate random candidate pools and discovery rules from the current match result state.

#### Scenario: Room discovery does not reuse a fixed final layout as truth

- **GIVEN** the pre-haunt room system needs a starting tile layout and unexplored exits
- **WHEN** the domain resolves the next discoverable room
- **THEN** the starting tile layout, room discovery pool, and current discovered room instances MUST remain separate layers instead of a single hardcoded final room result object acting as all three

#### Scenario: Drawn possessions are runtime results

- **GIVEN** the item and omen pools are configured
- **WHEN** an explorer draws a possession during runtime
- **THEN** the drawn possession in `core` MUST be created from the configured pool as a runtime result, not pre-attached to the explorer identity template as if it were a permanent starting property

### Requirement: Betrayal Scenario Rules Must Own Scenario-Specific Runtime Policies

The `betrayal` game MUST keep scenario-specific runtime policies inside scenario configuration instead of scattering them across generic runtime helpers.

#### Scenario: Scenario completion policy is not hardcoded in generic command execution

- **GIVEN** different scenarios may choose different traitor rules, survivor rules, and minimum haunt reward floors
- **WHEN** `COMPLETE_SCENARIO` resolves the endgame result
- **THEN** the traitor selection policy, survivor selection policy, and reward floor rules MUST come from scenario configuration rather than hardcoded fallback logic in `game.ts`

#### Scenario: Scenario preview monsters are read from scenario runtime preview config

- **GIVEN** a representative runtime or E2E fixture needs to show scenario-specific monsters on the board
- **WHEN** the domain creates a monster encounter preview core
- **THEN** the preview monster list MUST be read from scenario runtime preview configuration instead of being embedded as an ad-hoc array in the preview helper
