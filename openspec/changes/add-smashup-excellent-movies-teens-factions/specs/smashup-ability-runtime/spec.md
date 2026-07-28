## ADDED Requirements

### Requirement: Smash Up New Faction Mechanics Runtime Support

Smash Up ability runtime SHALL support the reusable mechanics required by 动作英雄（Action Heroes）、返时者（Backtimers）、异形变体（Extramorphs）、青少年（Teens）and 怨灵捕手（Wraithrustlers）without relying on one-off faction-only state machines.

#### Scenario: Stasis lifecycle resolves through authoritative state
- **GIVEN** a 返时者 card places, stores or releases a card through stasis
- **WHEN** the ability resolves
- **THEN** the runtime SHALL track the stasis zone ownership, source card, release timing and cleanup in authoritative game state
- **AND** L2/L3/L4 evidence SHALL show the card returning or resolving at the correct timing without leaving stale interactions

#### Scenario: Deck-top and reveal flows reuse normal prompts
- **GIVEN** an 异形变体 or related card reveals or plays cards from the top of a deck
- **WHEN** player choice is required
- **THEN** the ability SHALL use normal ability-runtime prompt primitives and structured InteractionSystem descriptors
- **AND** the prompt result SHALL resume the same ability flow through final state cleanup

#### Scenario: Wraith actions are first-class card entries
- **GIVEN** a 怨灵捕手 card uses a Wraith action or Wraith-specific timing
- **WHEN** the card becomes usable
- **THEN** its usability SHALL be modeled with explicit runtime entry metadata
- **AND** the card SHALL NOT depend on generic `special` tags or ad hoc UI checks to become playable
