## ADDED Requirements
### Requirement: Smash Up Half the Battle Image Preloading
The Smash Up critical image resolver SHALL include the Half the Battle card and base atlases whenever any of the four Half the Battle factions are selected in a playing state.

#### Scenario: Preload selected Half the Battle atlases
- **WHEN** a playing Smash Up match includes any Half the Battle faction
- **THEN** the critical image resolver SHALL include that faction's card atlas
- **AND** it SHALL include the shared Half the Battle base atlas
