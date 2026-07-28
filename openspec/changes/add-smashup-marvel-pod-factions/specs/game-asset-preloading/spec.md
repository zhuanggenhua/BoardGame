## ADDED Requirements
### Requirement: Marvel POD critical card preloading
The Smash Up critical image resolver SHALL include the selected Marvel POD card atlas paths when a player selects Marvel POD factions.

#### Scenario: Selected Marvel POD factions preload POD atlases
- **WHEN** a match state contains selected Marvel POD factions
- **THEN** the critical image resolver includes smashup/cards/marvel_wave_one_pod or smashup/cards/marvel_villains_pod as applicable.
