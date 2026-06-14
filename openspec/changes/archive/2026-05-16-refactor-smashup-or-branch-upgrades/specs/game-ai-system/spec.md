## ADDED Requirements

### Requirement: AI Ordered Multi-Selection Enumeration
The game AI system SHALL distinguish ordered multi-selection from unordered multi-selection when generating legal actions for local AI.

#### Scenario: Ordered multi-selection enumerates permutations
- **GIVEN** a local AI seat faces a `simple-choice` interaction with ordered multi-selection
- **WHEN** two selectable options `A` and `B` are both legal
- **THEN** the AI SHALL treat `A -> B` and `B -> A` as distinct legal actions

#### Scenario: Unordered multi-selection remains combination-based
- **GIVEN** a local AI seat faces a `simple-choice` interaction with unordered multi-selection
- **WHEN** two selectable options `A` and `B` are both legal
- **THEN** the AI MAY treat `A + B` as one combination action
- **AND** it SHALL NOT duplicate the same action solely by reordering equivalent option ids
