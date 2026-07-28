## ADDED Requirements
### Requirement: Smash Up Half the Battle Faction Registry
The Smash Up faction registry SHALL expose the Half the Battle factions `ADOLESCENT_EPIC_GECKOS`, `GI_GERALD`, `RULERS_OF_THE_COSMOS`, and `PEARL_AND_THE_IMAGES` as selectable factions with their own card IDs, base IDs, locale keys, faction metadata, and atlas preview references.

#### Scenario: Register Half the Battle factions as selectable factions
- **WHEN** the Smash Up faction registry initializes
- **THEN** it SHALL include all four Half the Battle faction IDs in faction metadata
- **AND** each faction SHALL have registered card definitions totaling 20 deck copies
- **AND** each faction SHALL have two registered base definitions

#### Scenario: Resolve Half the Battle locale entries
- **WHEN** card, base, or faction text is resolved for `zh-CN` or `en`
- **THEN** each new faction SHALL have a faction name and description
- **AND** each new card/base SHALL have a localized name plus effect or ability text where the source card has rules text

### Requirement: Smash Up Half the Battle Intake Status
The Smash Up Half the Battle factions SHALL be marked as implementation-in-progress until their gameplay handlers, object-level behavior tests, direct E2E, and release evidence are complete.

#### Scenario: Static intake is available before full gameplay closeout
- **WHEN** users inspect or select a Half the Battle faction after intake
- **THEN** the faction SHALL be visible and have real image previews
- **AND** the UI SHALL be able to identify that full gameplay implementation is still in progress
