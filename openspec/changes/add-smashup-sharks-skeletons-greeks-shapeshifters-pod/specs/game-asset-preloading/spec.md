## ADDED Requirements

### Requirement: Preload User-Supplied POD Atlases

The Smash Up critical image resolver SHALL include the selected Sharks, Skeletons, Mythic Greeks, Shapeshifters, and Dragons POD card atlases before the board renders.

#### Scenario: Enter a match with POD factions

- **WHEN** any player has selected one of the five POD factions
- **THEN** the resolver SHALL include that faction's compressed card atlas in the critical image set
- **AND** it SHALL include the reused base atlas for that POD faction
