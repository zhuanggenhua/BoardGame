## ADDED Requirements

### Requirement: Blocking Foreground Defaults To Modal Stack
Any foreground UI that owns a blocking `sys.interaction` or `responseWindow` step SHALL default to rendering through the global modal stack instead of bypassing it with an independent overlay channel.

#### Scenario: Blocking interaction opens through stack
- **GIVEN** a foreground UI corresponds to the current blocking interaction or response window
- **WHEN** the UI is shown to the player
- **THEN** the UI MUST be registered as a modal stack entry
- **AND** stack ownership metadata MUST remain attached to that foreground entry

#### Scenario: Pure display spotlight may stay outside stack
- **GIVEN** a foreground UI is display-only and does not own business confirmation or progression
- **WHEN** the UI is shown
- **THEN** it MAY remain in a non-stack overlay channel
- **AND** it MUST NOT be treated as the blocking owner of the business flow

### Requirement: Blocking Foregrounds Must Not Compete Outside The Stack
The system SHALL avoid rendering multiple competing blocking foregrounds through separate overlay channels when they belong to the same business flow.

#### Scenario: Compare roll and bonus die do not bypass stack
- **GIVEN** a compare-roll interaction or an interactive bonus-dice interaction is active
- **WHEN** the foreground is rendered
- **THEN** it MUST render through the modal stack
- **AND** it MUST NOT independently overtake another blocking modal by rendering outside the stack
