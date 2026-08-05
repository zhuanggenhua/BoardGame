## ADDED Requirements

### Requirement: Smash Up Penguins Faction Registry

The Smash Up faction registry SHALL expose `PENGUINS` as a standalone playable faction with its own card ids, base ids, locale keys, faction metadata, card atlas, base atlas, and titan association.

#### Scenario: Register Penguins as a selectable faction
- **WHEN** the Smash Up faction registry initializes
- **THEN** it SHALL include `PENGUINS` in faction ids, card registration, base registration, and faction metadata
- **AND** the faction picker SHALL display Penguins as a selectable faction when the relevant expansion set is enabled

#### Scenario: Register Penguins cards and bases
- **WHEN** the runtime card registry initializes
- **THEN** it SHALL register all 15 unique Penguins card definitions with the expected total count of 20 physical cards
- **AND** it SHALL register the Penguins bases used by the base pool

#### Scenario: Reuse Emperor Penguin as the Penguins titan
- **WHEN** the game queries titans for `PENGUINS`
- **THEN** it SHALL include `penguins_emperor_penguin`
- **AND** it SHALL not require a duplicate Penguins titan definition
