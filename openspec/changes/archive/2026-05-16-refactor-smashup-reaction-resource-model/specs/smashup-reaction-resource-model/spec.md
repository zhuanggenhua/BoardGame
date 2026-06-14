## ADDED Requirements

### Requirement: Typed Reaction Resources

Smash Up reaction ordering SHALL compare strongly typed concrete resources instead of hand-written coarse state buckets.

#### Scenario: Resource identity is concrete
- **GIVEN** two triggers affect different source card instances
- **WHEN** their footprints are built
- **THEN** the footprints SHALL identify different `sourceInstance` or `cardInstance` resources
- **AND** they SHALL NOT conflict merely because both are ongoing cards

#### Scenario: Resource types are centralized
- **GIVEN** a new reaction-orderable effect is implemented
- **WHEN** it emits existing Smash Up events or existing structured interactions
- **THEN** the effect SHALL NOT need to declare a per-card read/write bucket list for normal ordering

### Requirement: Footprints Derived From Runtime Artifacts

The system SHALL derive reaction ordering footprints from emitted events, queued interactions, and trigger source context.

#### Scenario: Event writes infer resources
- **GIVEN** a trigger emits a `MINION_MOVED` event
- **WHEN** its footprint is derived
- **THEN** the footprint SHALL include the moved minion and affected bases

#### Scenario: Interaction options infer possible resources
- **GIVEN** a trigger opens an interaction whose options include target minion and base identifiers
- **WHEN** its footprint is derived before the player chooses
- **THEN** the footprint SHALL include the possible target minions and bases
- **AND** it SHALL NOT fall back to global `minionBoardState` solely because the final target is not selected yet

#### Scenario: Unknown shape requires explicit fallback
- **GIVEN** a trigger opens an interaction with option values that cannot be converted to resources
- **WHEN** ordering tries to derive its footprint
- **THEN** the trigger SHALL require an explicit fallback footprint with a reason
- **AND** tests SHALL be able to report that fallback use

### Requirement: Mandatory Ordering Only For Real Conflicts

Mandatory reaction ordering SHALL be presented only when two or more mandatory effects have overlapping derived resource footprints that can change the outcome.

#### Scenario: Independent mandatory effects auto-resolve
- **GIVEN** two mandatory effects in the same frame affect disjoint resources
- **WHEN** the reaction session advances
- **THEN** the system SHALL resolve them without showing `smashup_reaction_choose`

#### Scenario: Conflicting mandatory effects ask for order
- **GIVEN** two mandatory effects in the same frame affect an overlapping minion, base, player zone, titan, deck, or global resource
- **WHEN** the reaction session advances
- **THEN** the system SHALL show a mandatory ordering choice containing only the currently conflicting effects

#### Scenario: Ordering choices shrink after resolution
- **GIVEN** a mandatory ordering choice is shown
- **WHEN** the player resolves one effect
- **THEN** the resolved effect SHALL be removed from the unresolved set
- **AND** the system SHALL re-evaluate whether another ordering choice is still needed

### Requirement: Optional Effects Stay Out Of Mandatory Ordering

Effects whose rule text is optional (`may` / `你可以`) SHALL NOT enter the mandatory ordering phase.

#### Scenario: Own The Bride with Mushroom Kingdom
- **GIVEN** the current player has The Bride available at the start of turn
- **AND** Mushroom Kingdom also triggers
- **WHEN** start-turn reactions are collected
- **THEN** The Bride SHALL be represented as an optional timing-window activation
- **AND** it SHALL NOT be shown as a mandatory ordering option with Mushroom Kingdom

#### Scenario: Mixed forced and optional effect
- **GIVEN** a card has a forced start-turn effect followed by an optional branch
- **WHEN** the start-turn frame is collected
- **THEN** the forced part MAY be mandatory
- **AND** the optional branch SHALL be represented separately so it does not force a mandatory ordering prompt

### Requirement: Optional Titan Special Board Entry

Start-turn optional titan specials SHALL use the normal visible titan/card activation surface rather than a generic prompt asking whether to play the titan.

#### Scenario: Eligible titan is clicked
- **GIVEN** an optional start-turn titan special is currently legal
- **WHEN** the player views the board
- **THEN** the eligible titan SHALL be visibly highlighted or otherwise exposed as clickable
- **WHEN** the player clicks that titan
- **THEN** the normal special activation flow SHALL execute

#### Scenario: Player skips optional titan window
- **GIVEN** an optional start-turn titan special is currently legal
- **WHEN** the player chooses the skip/pass control
- **THEN** the optional window SHALL close
- **AND** the titan SHALL NOT remain activatable outside its legal timing window
