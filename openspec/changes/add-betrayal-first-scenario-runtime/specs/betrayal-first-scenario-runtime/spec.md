## ADDED Requirements

### Requirement: First Scenario Runtime Chain

The `betrayal` game MUST provide a playable first scenario runtime chain that moves from explorer selection to pre-haunt exploration and then to an endgame result through real domain commands.

#### Scenario: Explorer selection starts the first scenario

- **WHEN** a seated player selects an available explorer and confirms the scenario start
- **THEN** the game enters the pre-haunt runtime phase with the selected explorer as a real participant in `core`

#### Scenario: Pre-haunt actions update authoritative state

- **WHEN** the active player moves, explores, uses a possession, trades a possession, or ends the turn
- **THEN** the command is validated and reduced through the domain pipeline instead of being stored only in Board-local preview state

#### Scenario: First scenario reaches endgame

- **WHEN** the first scenario completion command is accepted after runtime progress
- **THEN** the game enters an endgame result phase and exposes winner, survivor, traitor placeholder, and exploration statistics for the Board

### Requirement: V4-Based Runtime Presentation

The runtime Board presentation MUST use `betrayal-runtime-prehaunt-board-v4.png` as its implementation baseline and MUST NOT use later generated process drafts as the target layout.

#### Scenario: Runtime screen preserves v4 structure

- **WHEN** the pre-haunt runtime screen is rendered at the desktop baseline
- **THEN** it preserves the v4 five-region structure: current explorer on the left, connected room tiles in the center, deck/discard support on the right, short top status, and a compact bottom action strip

#### Scenario: Main UI avoids descriptive rules text

- **WHEN** the runtime Board displays actions and status
- **THEN** persistent text is limited to object names, numbers, short status, and button labels; longer action explanations are only available through tooltip, help, or temporary prompt surfaces

### Requirement: First Scenario Visual Evidence

The implementation MUST produce real page evidence for the three target screens.

#### Scenario: Screenshots cover the first scenario chain

- **WHEN** verification is run
- **THEN** it captures and reviews real page screenshots for explorer selection, v4-based pre-haunt runtime, and endgame result
