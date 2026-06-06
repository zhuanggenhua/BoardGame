## ADDED Requirements

### Requirement: Smash Up Vikings POD Faction Registry

The Smash Up faction registry SHALL expose `VIKINGS_POD` as a standalone POD faction with its own card ids, base ids, locale keys, and faction metadata.

#### Scenario: Register Vikings POD as a selectable faction

- **WHEN** the Smash Up faction registry initializes
- **THEN** it SHALL include `VIKINGS_POD` in faction ids, card registration, and faction metadata
- **AND** all Vikings POD card and base ids SHALL use the `_pod` suffix

#### Scenario: Reuse Vikings gameplay logic through POD alias mapping

- **WHEN** a Vikings POD card or base resolves an ability
- **THEN** the game SHALL reuse the existing Vikings ability, interaction, ongoing, and base ability registrations
- **AND** it SHALL not require a separate Vikings-specific gameplay implementation for the POD faction

#### Scenario: Use POD base variants for the Vikings POD base pool

- **WHEN** the base pool is built for `VIKINGS_POD`
- **THEN** it SHALL return `base_drakkar_pod` and `base_longhouse_pod`
- **AND** those POD base ids SHALL still resolve the same gameplay behavior as the base versions

#### Scenario: Locale visibility differs between base and POD Vikings

- **WHEN** the English faction picker is rendered
- **THEN** `VIKINGS_POD` SHALL be visible
- **AND** base `VIKINGS` SHALL remain hidden from the English picker
