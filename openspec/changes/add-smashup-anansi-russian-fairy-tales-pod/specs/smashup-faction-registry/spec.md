## ADDED Requirements

### Requirement: Smash Up Anansi Tales And Russian Fairy Tales POD Registry

The Smash Up faction registry SHALL expose Anansi Tales POD and Russian Fairy Tales POD as standalone selectable factions with independent `_pod` card IDs and exact mappings to the supplied POD atlases.

#### Scenario: Register both POD factions independently

- **WHEN** the Smash Up faction registry initializes
- **THEN** it SHALL include `anansi_tales_pod` and `russian_fairy_tales_pod` in faction IDs, card registration, metadata and locale visibility
- **AND** it SHALL preserve the classic factions and their existing card/base resources unchanged

#### Scenario: Map every physical card slot

- **GIVEN** each supplied source is a `1876 x 2100` atlas with a uniform `4 x 5` grid
- **WHEN** a POD card preview is resolved
- **THEN** it SHALL use the row-major atlas slot locked for that runtime card
- **AND** repeated physical copies SHALL be represented by `count` rather than duplicate definitions

#### Scenario: Share gameplay explicitly

- **GIVEN** each POD card's printed rules match its classic counterpart
- **WHEN** the POD card resolves an ability, interaction, ongoing effect or power modifier
- **THEN** it SHALL use the matching classic implementation through an explicit `shared` variant relationship
- **AND** POD aliases SHALL NOT duplicate the effect on classic cards

#### Scenario: Share classic faction bases

- **GIVEN** no POD base artwork was supplied
- **WHEN** the base pool is built for either new POD faction
- **THEN** it SHALL return the corresponding classic faction base IDs
- **AND** it SHALL NOT invent `_pod` bases or replacement artwork

#### Scenario: Preserve object-level auditability

- **WHEN** the two POD factions are delivered
- **THEN** all 29 unique runtime cards and 40 physical atlas slots SHALL have source, field, slot, runtime and verification evidence
- **AND** remote runtime assets SHALL be reported separately from local files and manifest state
