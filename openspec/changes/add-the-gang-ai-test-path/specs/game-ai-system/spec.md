## ADDED Requirements
### Requirement: The Gang Visible Local AI
The system SHALL provide a visible local AI runtime for The Gang that uses the shared AI decision contract and existing game command pipeline.

#### Scenario: AI chooses from legal chip actions
- **GIVEN** The Gang is in chip-selection phase
- **AND** an AI-controlled player has not selected a chip for the current round
- **WHEN** the AI decision context is built for that player
- **THEN** the legal actions include only available chip choices for that player
- **AND** occupied chips selected by other players are excluded

#### Scenario: AI progresses public heist phases
- **GIVEN** every player has selected a chip for the current round
- **WHEN** the game is before the final round
- **THEN** the legal actions include ending the round
- **AND** when the final round has all community cards, the legal actions include revealing showdown
- **AND** after a showdown, the legal actions include starting the next heist if the game is not over

#### Scenario: Baseline policy respects legal action boundary
- **GIVEN** the baseline local AI policy receives an `AiDecisionContext`
- **WHEN** it returns an action decision
- **THEN** the returned `actionId` MUST match one of the context legal actions
- **AND** the AI MUST NOT construct a command outside the legal action set
