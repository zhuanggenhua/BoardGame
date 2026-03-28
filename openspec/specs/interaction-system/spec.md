# Interaction System Specification

## Purpose
定义引擎层统一的阻塞式玩家交互模型，包括一次性选择交互，以及需要本地多步预览后再确认提交的 `multistep-choice` 交互。

## Requirements

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

### Requirement: Card Interaction Multi-Target Player Selection
The engine SHALL support `dt:card-interaction` payloads whose `selectPlayer` descriptor allows selecting up to `selectCount` target players before a single confirmation dispatch.

#### Scenario: Player selection keeps local progress before confirmation
- **GIVEN** a `dt:card-interaction` whose descriptor type is `selectPlayer`
- **AND** the descriptor declares `selectCount` greater than `1`
- **WHEN** the acting player locally selects one or more valid target players
- **THEN** the interaction remains open until the player confirms or cancels
- **AND** the current local selection is preserved for UI rendering

#### Scenario: Confirmation dispatches all selected player ids at once
- **GIVEN** a `dt:card-interaction` whose descriptor type is `selectPlayer`
- **AND** the acting player has selected one or more valid target players
- **WHEN** the player confirms the interaction
- **THEN** the client dispatches a single `RESOLVE_INTERACTION` command
- **AND** the command payload contains every selected player id in `selectedPlayerIds`

#### Scenario: Command validation rejects invalid or excessive targets
- **GIVEN** a `dt:card-interaction` whose descriptor type is `selectPlayer`
- **WHEN** a `RESOLVE_INTERACTION` command includes targets outside `targetPlayerIds`
- **OR** the number of unique selected targets exceeds `selectCount`
- **THEN** the command is rejected before state mutation
