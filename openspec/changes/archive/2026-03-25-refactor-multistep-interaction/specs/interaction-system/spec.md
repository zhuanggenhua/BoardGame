## ADDED Requirements

### Requirement: Multistep Choice Interaction
InteractionSystem SHALL support a `multistep-choice` kind for interactions that require multiple local intermediate steps before final confirmation.

#### Scenario: Intermediate steps stay local
- **GIVEN** a `multistep-choice` interaction with a `localReducer`
- **WHEN** the player performs intermediate steps
- **THEN** the accumulated result is updated on the client side
- **AND** no intermediate step is required to go through the engine pipeline as a business command

#### Scenario: Confirmation dispatches generated commands
- **GIVEN** a `multistep-choice` interaction with a `toCommands` function
- **WHEN** the player confirms the interaction
- **THEN** the accumulated result is converted into engine command payloads
- **AND** those commands are dispatched to the engine
- **AND** the interaction emits `SYS_INTERACTION_CONFIRMED`

#### Scenario: Cancel drops local progress
- **GIVEN** a `multistep-choice` interaction with local progress already accumulated
- **WHEN** the player cancels the interaction
- **THEN** the interaction is resolved through the existing cancel flow
- **AND** no business commands derived from the local progress are dispatched

### Requirement: useMultistepInteraction Hook
The engine SHALL provide a `useMultistepInteraction` React Hook that manages local multistep interaction state for UI consumption.

#### Scenario: Hook exposes local interaction controls
- **GIVEN** the UI receives a `multistep-choice` interaction
- **WHEN** the UI calls `useMultistepInteraction`
- **THEN** the Hook exposes `result`, `stepCount`, `canConfirm`, `step()`, `confirm()`, and `cancel()`

#### Scenario: Hook resets when interaction changes
- **GIVEN** the current `multistep-choice` interaction has changed to a different interaction ID
- **WHEN** the Hook re-runs for the new interaction
- **THEN** local result and step count are reset to the new interaction's initial state

#### Scenario: Hook auto-confirms when maxSteps is reached
- **GIVEN** a `multistep-choice` interaction defines `maxSteps`
- **WHEN** the completed local progress reaches that threshold
- **THEN** the Hook automatically confirms the interaction without requiring a separate manual click
