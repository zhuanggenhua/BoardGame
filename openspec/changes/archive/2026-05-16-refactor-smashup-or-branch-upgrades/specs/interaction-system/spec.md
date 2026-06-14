## ADDED Requirements

### Requirement: Simple Choice Ordered Multi-Selection
InteractionSystem SHALL support ordered multi-selection for `simple-choice` interactions whose semantics require preserving player-selected option order.

#### Scenario: UI response preserves selected order
- **GIVEN** a `simple-choice` interaction declares ordered multi-selection
- **WHEN** the player selects option `A` and then option `B`
- **THEN** the response payload SHALL preserve `optionIds` as `[A, B]`
- **AND** the interaction contract SHALL distinguish this from `[B, A]`

#### Scenario: Refresh does not erase ordering semantics
- **GIVEN** a `simple-choice` interaction declares ordered multi-selection
- **WHEN** the interaction options are refreshed from live state
- **THEN** the system MAY remove invalid options
- **BUT** the system SHALL preserve ordered-selection semantics for the response contract
