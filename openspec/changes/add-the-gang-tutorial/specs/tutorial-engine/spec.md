## ADDED Requirements
### Requirement: The Gang Basic Tutorial
The system SHALL provide a non-empty The Gang basic tutorial that teaches the public rules and points at stable Board highlight targets.

#### Scenario: Tutorial loads with concrete steps
- **WHEN** the The Gang tutorial module is loaded
- **THEN** it exposes a tutorial manifest with steps for the game goal, hand area, chip selection, round progress, showdown, and win/loss track

#### Scenario: Tutorial highlight targets exist
- **WHEN** The Gang Board renders
- **THEN** every tutorial highlight target used by the basic tutorial has a matching `data-tutorial-id` anchor in the Board
