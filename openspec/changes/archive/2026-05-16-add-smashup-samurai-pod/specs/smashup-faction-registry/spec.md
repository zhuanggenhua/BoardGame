## ADDED Requirements

### Requirement: Smash Up Samurai POD Faction Registry

The Smash Up faction registry SHALL expose `SAMURAI_POD` as a standalone POD faction with its own card ids, base ids, locale keys, and faction metadata.

#### Scenario: Register Samurai POD as a selectable faction

- **WHEN** the Smash Up faction registry initializes
- **THEN** it SHALL include `SAMURAI_POD` in faction ids, card registration, and faction metadata
- **AND** all Samurai POD card and base ids SHALL use the `_pod` suffix

#### Scenario: Reuse Samurai gameplay logic through POD alias mapping

- **WHEN** a Samurai POD card or base resolves an ability
- **THEN** the game SHALL reuse the existing Samurai ability, interaction, ongoing, and base ability registrations
- **AND** it SHALL not require a separate Samurai-specific gameplay implementation for the POD faction

#### Scenario: Use POD base variants for the Samurai POD base pool

- **WHEN** the base pool is built for `SAMURAI_POD`
- **THEN** it SHALL return `base_shoguns_palace_pod` and `base_sakura_garden_pod`
- **AND** those POD base ids SHALL still resolve the same gameplay behavior as the base versions

#### Scenario: Locale visibility differs between base and POD Samurai

- **WHEN** the English faction picker is rendered
- **THEN** `SAMURAI_POD` SHALL be visible
- **AND** base `SAMURAI` SHALL remain hidden from the English picker
