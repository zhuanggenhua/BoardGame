## ADDED Requirements

### Requirement: Smash Up Excellent Movies And Teens Factions

The Smash Up faction registry SHALL expose 动作英雄（Action Heroes）、返时者（Backtimers）、异形变体（Extramorphs）、青少年（Teens）and 怨灵捕手（Wraithrustlers）as selectable factions with complete card data, base data, atlas previews, locale entries, faction metadata and gameplay bindings.

#### Scenario: Five factions are selectable after intake
- **GIVEN** the supplied user image and any approved comparison sources have been processed through the Smash Up faction intake workflow
- **WHEN** the faction picker renders Smash Up factions
- **THEN** 动作英雄、返时者、异形变体、青少年 and 怨灵捕手 SHALL appear as selectable factions
- **AND** each faction SHALL have faction metadata, localized names and image-backed preview assets

#### Scenario: Card and base registry is complete
- **GIVEN** any of the five new factions is selected for a match
- **WHEN** the Smash Up card and base registries initialize
- **THEN** that faction's deck SHALL contain exactly 20 cards using locked card ids, counts, card types, power values and preview refs
- **AND** the base pool SHALL include that faction's locked bases with breakpoint, VP awards, localized text and preview refs

#### Scenario: Intake blockers prevent guessed implementation
- **GIVEN** a card, base, locale field or atlas slot from the supplied image cannot be locked from the main truth source or an approved comparison source
- **WHEN** implementation tasks are evaluated
- **THEN** that object SHALL remain `blocked` or `disputed` in the intake contract
- **AND** runtime code SHALL NOT invent names, text, counts, indexes or gameplay semantics for that object

### Requirement: Smash Up Excellent Movies And Teens Evidence

The system SHALL produce auditable evidence for the five-faction batch before the batch can be reported as complete.

#### Scenario: Evidence records object-level status
- **WHEN** any of the five factions reaches implementation closeout
- **THEN** evidence SHALL include a source contract, crop table, card/base checklist, implementation matrix and L0/L1/L2/L3/L4 status for each card and base
- **AND** any representative-chain reuse SHALL identify the representative object, shared chain, equality basis and remaining differences

#### Scenario: New UI or interaction families have direct E2E
- **WHEN** the batch introduces stasis, Wraith actions, deck-top use or another new interaction family
- **THEN** at least one object in that interaction family SHALL have a real-entry direct E2E reaching final authoritative state
- **AND** evidence SHALL record the E2E file path, screenshot path and observed final state
