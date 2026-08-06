# smashup-faction-registry Specification

## Purpose
TBD - created by archiving change add-smashup-ancient-egyptians-pod. Update Purpose after archive.
## Requirements
### Requirement: Smash Up Ancient Egyptians POD Faction Registry

The Smash Up faction registry SHALL expose `ANCIENT_EGYPTIANS_POD` as a standalone POD faction with its own card IDs, base IDs, locale keys, and faction metadata.

#### Scenario: Register Ancient Egyptians POD as a selectable faction

- **WHEN** the Smash Up faction registry initializes
- **THEN** it SHALL include `ANCIENT_EGYPTIANS_POD` in faction ids, card registration, and faction metadata
- **AND** all Ancient Egyptians POD card and base ids SHALL use the `_pod` suffix

#### Scenario: Reuse base abilities through POD alias mapping

- **WHEN** `base_pyramids_pod` or `base_star_portal_pod` enters play
- **THEN** the game SHALL resolve the same base ability registrations as the base versions
- **AND** the POD bases SHALL still keep their own POD ids and locale entries

#### Scenario: Locale visibility differs between base and POD Ancient Egyptians

- **WHEN** the English faction picker is rendered
- **THEN** `ANCIENT_EGYPTIANS_POD` SHALL be visible
- **AND** base `ANCIENT_EGYPTIANS` SHALL remain hidden from the English picker

#### Scenario: POD titan fallback reuses the base faction titan

- **WHEN** the game queries titans for `ANCIENT_EGYPTIANS_POD`
- **THEN** it SHALL return `sphinx`
- **AND** it SHALL not require a separate `sphinx_pod` definition

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

### Requirement: Smash Up Half the Battle Release Status

The Smash Up faction registry SHALL expose the Half the Battle factions `ADOLESCENT_EPIC_GECKOS`, `GI_GERALD`, `RULERS_OF_THE_COSMOS`, and `PEARL_AND_THE_IMAGES` as normal selectable factions once their gameplay handlers, object-level behavior tests, direct E2E coverage, and release evidence are complete. Factions whose required closeout evidence is incomplete MUST remain marked as implementation-in-progress.

#### Scenario: Release completed Half the Battle factions

- **WHEN** the four Half the Battle factions have completed gameplay handlers, object-level behavior tests, direct E2E coverage, and release evidence
- **THEN** the faction metadata SHALL not mark those four factions as implementation-in-progress
- **AND** the faction IDs SHALL not be present in the implementation-in-progress set
- **AND** the four factions SHALL be visible in the default supported faction selection locale

#### Scenario: Keep incomplete factions gated

- **WHEN** a faction has not completed its required gameplay or release evidence
- **THEN** the faction SHALL remain marked as implementation-in-progress
- **AND** it SHALL not be treated as release-ready solely because its static card or base data exists

