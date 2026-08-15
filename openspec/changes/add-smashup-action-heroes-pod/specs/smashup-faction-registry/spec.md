## ADDED Requirements

### Requirement: Smash Up Action Heroes POD Registry

The Smash Up faction registry SHALL expose Action Heroes POD as a standalone faction with independent card IDs, base IDs, locale keys, faction metadata, and a `4 x 5` card atlas.

#### Scenario: Register the Action Heroes POD faction

- **WHEN** the Smash Up card and faction registries initialize
- **THEN** Action Heroes POD SHALL expose 17 unique `_pod` card definitions totaling 20 physical cards
- **AND** the faction SHALL remain selectable independently from classic Action Heroes

#### Scenario: Reuse matching gameplay explicitly

- **GIVEN** the supplied POD rules match the current Action Heroes gameplay contracts
- **WHEN** an Action Heroes POD card or base resolves gameplay
- **THEN** it SHALL use the explicit shared ability, interaction, ongoing, base-ability, and power-modifier relationships
- **AND** its base pool SHALL contain only the corresponding `_pod` base IDs
