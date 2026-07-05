## ADDED Requirements
### Requirement: The Gang Public Action Log
The system SHALL record The Gang public gameplay actions in `G.sys.actionLog.entries` using i18n action-log segments.

#### Scenario: Chip choice is logged publicly
- **WHEN** a player takes a chip
- **THEN** the action log records the acting player and chosen chip value
- **AND** the log does not reveal any hidden hand card details

#### Scenario: Heist progress is logged publicly
- **WHEN** a round ends, showdown is revealed, or the next heist starts
- **THEN** the action log records the public progress event and visible result summary
