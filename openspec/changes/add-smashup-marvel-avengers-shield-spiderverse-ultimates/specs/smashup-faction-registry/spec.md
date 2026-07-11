## ADDED Requirements

### Requirement: Smash Up Marvel factions SHALL be independently selectable

The Smash Up faction registry SHALL expose `AVENGERS`, `SHIELD`, `SPIDER_VERSE`, and `ULTIMATES` as four standalone factions with independent card IDs, locale keys, faction metadata, and ability registrations.

#### Scenario: Register the first four Marvel factions

- **WHEN** the Smash Up faction registry initializes
- **THEN** it SHALL include all four Marvel faction IDs
- **AND** each faction SHALL build exactly 20 cards from its own definitions
- **AND** none of the Marvel factions SHALL depend on POD alias inheritance

#### Scenario: Preserve existing parallel faction registrations

- **WHEN** the Marvel registrations are added to shared registry files
- **THEN** existing base and POD faction registrations SHALL remain present
- **AND** the implementation SHALL append or merge the new entries without replacing unrelated current-worktree changes
