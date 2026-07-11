## ADDED Requirements

### Requirement: Smash Up SHALL preload the Marvel card atlas for selected Marvel factions

The Smash Up critical image resolver SHALL include the shared Marvel card atlas when any player selects Avengers, S.H.I.E.L.D., Spider-Verse, or Ultimates.

#### Scenario: Preload a selected Marvel faction

- **WHEN** a match includes at least one of the four Marvel factions
- **THEN** the loading-assets phase SHALL request the localized optimized Marvel atlas
- **AND** the first rendered hand or faction preview SHALL not depend on an unregistered late atlas load

#### Scenario: Avoid duplicate preloads for multiple Marvel factions

- **WHEN** a match includes two or more factions from the same Marvel atlas
- **THEN** the resolver SHALL return the shared atlas URL once
- **AND** it SHALL not create duplicate critical-image entries for each faction
