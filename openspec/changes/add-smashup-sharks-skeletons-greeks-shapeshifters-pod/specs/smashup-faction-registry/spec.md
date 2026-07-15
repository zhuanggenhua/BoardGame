## ADDED Requirements

### Requirement: Smash Up Sharks Skeletons Mythic Greeks And Shapeshifters POD Registry

The Smash Up faction registry SHALL expose Sharks, Skeletons, Mythic Greeks, and Shapeshifters POD as standalone factions with independent card IDs, base IDs, locale keys, faction metadata, and `4 x 5` card atlases.

#### Scenario: Register the four POD factions

- **WHEN** the Smash Up card and faction registries initialize
- **THEN** each POD faction SHALL expose a 20-card physical deck using `_pod` runtime IDs
- **AND** each POD faction SHALL remain selectable independently from its base faction

#### Scenario: Reuse matching gameplay explicitly

- **GIVEN** the supplied POD rules match the existing base-faction contracts
- **WHEN** a POD card or POD base resolves gameplay
- **THEN** it SHALL use the explicit shared ability, interaction, ongoing, base-ability, and modifier relationships
- **AND** its base pool SHALL contain only the corresponding `_pod` base IDs

#### Scenario: Preserve the existing Dragons POD change

- **WHEN** the five user-supplied POD atlases are verified together
- **THEN** Dragons POD SHALL continue to be owned by `add-smashup-dragons-superheroes-magical-girls-mega-troopers-pod`
- **AND** this change SHALL NOT create a duplicate Dragons POD registry definition
