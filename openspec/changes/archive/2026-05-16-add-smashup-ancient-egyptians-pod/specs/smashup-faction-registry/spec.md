## ADDED Requirements

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
