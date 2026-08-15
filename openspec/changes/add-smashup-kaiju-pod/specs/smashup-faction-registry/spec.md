## ADDED Requirements

### Requirement: Smash Up Kaiju POD Faction Registry

The Smash Up faction registry SHALL expose `KAIJU_POD` as a standalone POD faction with its own card IDs, base IDs, locale keys, faction metadata, and card atlas.

#### Scenario: Register Kaiju POD as a selectable faction

- **WHEN** the Smash Up faction registry initializes
- **THEN** it SHALL include `KAIJU_POD` in faction IDs, card registration, faction metadata, and locale visibility
- **AND** all cards and bases owned by the POD faction SHALL use `_pod` IDs
- **AND** ordinary Kaiju SHALL remain registered independently

#### Scenario: Map the supplied 4 by 5 atlas

- **GIVEN** the supplied Kaiju POD source is a `1876 x 2100` atlas with a `4 x 5` uniform grid
- **WHEN** a Kaiju POD card is rendered
- **THEN** its preview SHALL resolve to the row-major slot locked for that object
- **AND** repeated physical copies SHALL be represented by `count` rather than duplicate runtime definitions

#### Scenario: Reuse gameplay through an explicit shared variant binding

- **GIVEN** the supplied POD objects correspond to ordinary Kaiju gameplay objects
- **WHEN** a Kaiju POD object resolves an ability, interaction, ongoing rule, power modifier, or base ability
- **THEN** the game SHALL use the ordinary Kaiju implementation through an explicit shared variant profile
- **AND** SHALL NOT duplicate the effect or mutate the ordinary Kaiju definitions

#### Scenario: Keep the POD base pool separate without inventing artwork

- **WHEN** the base pool is built for `KAIJU_POD`
- **THEN** it SHALL contain only `base_tokyo_pod` and `base_kaiju_island_pod`
- **AND** those IDs SHALL reuse the existing base artwork and behavior
- **AND** the system SHALL NOT infer replacement base artwork that was not supplied

#### Scenario: Reuse the existing titan

- **WHEN** the game queries titans for `KAIJU_POD`
- **THEN** it SHALL return `kaiju_gorgodzolla`
- **AND** SHALL NOT require a duplicate `_pod` titan definition
