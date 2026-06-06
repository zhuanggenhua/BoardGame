## ADDED Requirements

### Requirement: Smash Up Cowboys POD Faction Registry

The Smash Up faction registry SHALL expose `COWBOYS_POD` as a standalone POD faction with its own card ids, base ids, locale keys, and faction metadata.

#### Scenario: Register Cowboys POD as a selectable faction

- **WHEN** the Smash Up faction registry initializes
- **THEN** it SHALL include `COWBOYS_POD` in faction ids, card registration, and faction metadata
- **AND** all Cowboys POD card and base ids SHALL use the `_pod` suffix

#### Scenario: Reuse Cowboys gameplay logic through POD alias mapping

- **WHEN** a Cowboys POD card or base resolves an ability
- **THEN** the game SHALL reuse the existing Cowboys ability, interaction, ongoing, base ability, and power modifier registrations
- **AND** it SHALL not require a separate Cowboys-specific gameplay implementation for the POD faction

#### Scenario: Use POD base variants for the Cowboys POD base pool

- **WHEN** the base pool is built for `COWBOYS_POD`
- **THEN** it SHALL return `base_saloon_pod` and `base_so_so_corral_pod`
- **AND** those POD base ids SHALL still resolve the same gameplay behavior as the base versions

#### Scenario: Locale visibility differs between base and POD Cowboys

- **WHEN** the English faction picker is rendered
- **THEN** `COWBOYS_POD` SHALL be visible
- **AND** base `COWBOYS` SHALL remain hidden from the English picker
