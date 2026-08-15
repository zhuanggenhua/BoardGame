## ADDED Requirements

### Requirement: Kaiju POD Atlas SHALL Participate In Smash Up Preloading

The Smash Up critical image resolver SHALL include the Kaiju POD card atlas whenever the faction can be selected or is present in the active match.

#### Scenario: Preload during faction selection

- **WHEN** the normal Smash Up faction-selection phase is rendered
- **THEN** the Kaiju POD atlas SHALL be included in the selection-stage preload contract

#### Scenario: Preload the selected POD atlas in tutorial play

- **GIVEN** a Smash Up tutorial match has entered the playing phase
- **WHEN** `KAIJU_POD` is selected
- **THEN** the resolver SHALL include the Kaiju POD card atlas
- **AND** SHALL NOT require an unrelated new base atlas
