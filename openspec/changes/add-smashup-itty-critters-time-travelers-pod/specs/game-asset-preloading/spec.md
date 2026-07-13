## ADDED Requirements

### Requirement: Smash Up POD Faction Atlases SHALL Participate In Critical Image Preloading

The Smash Up critical image resolver SHALL include the Itty Critters POD and Time Travelers POD atlases whenever those factions can be selected or are present in the active match.

#### Scenario: Preload POD atlases during faction selection

- **WHEN** the normal Smash Up faction-selection phase is rendered
- **THEN** both new POD card atlases SHALL be included in the selection-stage preload contract

#### Scenario: Preload only selected POD atlases in tutorial play

- **GIVEN** a Smash Up tutorial match has entered the playing phase
- **WHEN** either new POD faction is selected by a player
- **THEN** the resolver SHALL include the matching POD atlas in the critical list
- **AND** SHALL NOT preload the other new POD atlas unless it is also selected
