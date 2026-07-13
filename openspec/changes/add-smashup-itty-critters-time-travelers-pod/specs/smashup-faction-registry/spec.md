## ADDED Requirements

### Requirement: Smash Up Itty Critters And Time Travelers POD Faction Registry

The Smash Up faction registry SHALL expose `ITTY_CRITTERS_POD` and `TIME_TRAVELERS_POD` as standalone POD factions with their own card IDs, base IDs, locale keys, faction metadata, and POD card atlases.

#### Scenario: Register both POD factions as selectable factions

- **WHEN** the Smash Up faction registry initializes
- **THEN** it SHALL include `ITTY_CRITTERS_POD` and `TIME_TRAVELERS_POD` in faction IDs, card registration, faction metadata, and locale visibility
- **AND** all cards and bases owned by those POD factions SHALL use `_pod` IDs
- **AND** the existing base factions SHALL remain registered independently

#### Scenario: Map the supplied Itty Critters POD atlas

- **GIVEN** the supplied Itty Critters POD source is a `1876 x 2100` atlas with a `4 x 5` uniform grid
- **WHEN** an Itty Critters POD card is rendered
- **THEN** its preview SHALL resolve to the row-major slot locked for that card in the supplied atlas
- **AND** repeated physical copies SHALL be represented by the card definition count rather than duplicate runtime definitions

#### Scenario: Map the supplied Time Travelers POD atlas

- **GIVEN** the supplied Time Travelers POD source is a `1876 x 2100` atlas with a `4 x 5` uniform grid
- **WHEN** a Time Travelers POD card is rendered
- **THEN** its preview SHALL resolve to the row-major slot locked for that card in the supplied atlas
- **AND** repeated physical copies SHALL be represented by the card definition count rather than duplicate runtime definitions

#### Scenario: Reuse gameplay through an explicit shared variant binding

- **GIVEN** the locked POD card text matches the corresponding base-faction gameplay contract
- **WHEN** an Itty Critters POD or Time Travelers POD card resolves an ability
- **THEN** the game SHALL reuse the matching base ability, interaction, ongoing, modifier, and cleanup semantics through an explicit shared variant relationship
- **AND** the shared relationship SHALL NOT duplicate effects on the base card or make POD-only IDs visible to the base faction

#### Scenario: Use independent POD base IDs without inventing base artwork

- **WHEN** the base pool is built for `ITTY_CRITTERS_POD` or `TIME_TRAVELERS_POD`
- **THEN** it SHALL return only the corresponding `_pod` base IDs
- **AND** those POD base IDs SHALL reuse the current base artwork and matching base ability behavior
- **AND** the system SHALL NOT generate or infer replacement base artwork that was not supplied

#### Scenario: Reuse existing faction titans

- **WHEN** the game queries titans for `ITTY_CRITTERS_POD` or `TIME_TRAVELERS_POD`
- **THEN** it SHALL return 彩虹鸟（`itty_critters_rainboroc`）or 时间盒子（`time_travelers_time_box`）respectively
- **AND** it SHALL NOT require duplicate `_pod` titan definitions

#### Scenario: Preserve object-level auditability

- **WHEN** either POD faction is prepared for delivery
- **THEN** every POD card and base SHALL have a source slot, structured definition, runtime surface, test result, and L0-L4 evidence conclusion
- **AND** shared L3/L4 evidence SHALL only be reused when the handler, timing, interaction, optionality, cleanup, and final-state chain are equivalent except for configuration
