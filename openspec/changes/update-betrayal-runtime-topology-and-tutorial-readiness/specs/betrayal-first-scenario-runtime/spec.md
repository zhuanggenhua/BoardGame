## MODIFIED Requirements

### Requirement: First Scenario Runtime Chain

The `betrayal` game MUST provide a playable first scenario runtime chain that moves from explorer selection to pre-haunt exploration, then into the real first haunt, and finally to an endgame result through domain commands.

#### Scenario: Explorer selection starts the first scenario

- **WHEN** a seated player selects an available explorer and confirms the scenario start
- **THEN** the game enters the pre-haunt runtime phase with the selected explorer as a real participant in `core`

#### Scenario: Pre-haunt exploration uses authoritative room topology

- **WHEN** the pre-haunt runtime builds the starting house state
- **THEN** the Ground Floor starting tile chain MUST model `Ground Floor Staircase`, `Hallway`, and `Entrance Hall` as separate authoritative room nodes
- **AND** the landing links MUST preserve explicit special connections such as `Basement Landing <-> Ground Floor Staircase <-> Upper Landing`
- **AND** movement or exploration MUST be derived from open doorway topology instead of a single hard-coded “next slot”

#### Scenario: Haunt trigger transitions to the real first scenario

- **WHEN** the first scenario's haunt trigger is discovered during pre-haunt exploration
- **THEN** the game transitions into a haunt phase for `Stacked Like Cordwood 2: Crimson Jack Returns`, records the haunt revealer as the traitor, and reassigns the first haunt turn according to the scenario rules

#### Scenario: Haunt actions update authoritative state

- **WHEN** players perform first-scenario haunt actions such as attacking the traitor, learning about Jack, studying the exorcism, releasing Jack's Spirit, or exorcising Jack
- **THEN** the results are validated and reduced through the domain pipeline instead of being simulated only in Board-local preview state

#### Scenario: First scenario reaches a real result

- **WHEN** the heroes exorcise Jack's Spirit or the traitor side kills all remaining heroes
- **THEN** the game enters an endgame result phase with winners, defeated side, and first-scenario-specific runtime statistics
