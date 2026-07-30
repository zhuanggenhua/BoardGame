## ADDED Requirements

### Requirement: Design-First Interaction Contract

The `betrayal` implementation MUST maintain a basic-rule semantic coverage matrix before implementing or claiming completion of core gameplay interactions.

#### Scenario: Core rule enters implementation

- **WHEN** a core rule is selected for implementation
- **THEN** the matrix identifies its rule meaning, state truth, command/event path, UI carrier, verification evidence, and current status

#### Scenario: Core rule is incomplete

- **WHEN** a core rule lacks state truth, player input, UI carrier, or verification evidence
- **THEN** it is marked `blocked`, `representative-only`, or `out-of-scope-approved` and MUST NOT be claimed as complete

### Requirement: Full Rule Ledger Coverage

The `betrayal` redesign MUST maintain a full rule interaction ledger that maps every base-rule section and official-rulebook supplemental interaction detail to state truth, player interaction, UI carrier, and verification status.

#### Scenario: Base rule section is present

- **WHEN** a numbered base-rule section exists in the local rule source
- **THEN** the ledger identifies its interaction design or explicitly marks it `source-blocked`, `needs-breakdown`, `representative-only`, or `out-of-scope-approved`

#### Scenario: Official comparison adds a rule detail

- **WHEN** the official rulebook comparison identifies a gameplay detail not fully expanded in the local整理版
- **THEN** the detail is added to the full rule ledger before implementation can claim that area complete

### Requirement: Room Discovery Symbol Contract

The `betrayal` implementation MUST model each room tile's printed discovery symbol as room data and MUST draw from the matching event, item, or omen deck when that room is explored.

#### Scenario: Room tile has a discovery symbol

- **WHEN** a player explores and places a room tile with an event, item, or omen symbol
- **THEN** the explored room stores that printed symbol and the discovery resolution draws from the corresponding deck

#### Scenario: Runtime draw order conflicts with printed symbol

- **WHEN** runtime draw order or deck availability would select a different deck than the placed room tile's printed symbol
- **THEN** the printed room symbol remains the rule truth, and the behavior is marked blocked or handled by an explicit rule exception instead of silently substituting another deck

#### Scenario: Tutorial explains exploration

- **WHEN** the basic tutorial teaches room exploration
- **THEN** it explains the visible symbol mapping in player language: event symbol draws an event card, item symbol draws an item card, and omen symbol draws an omen card

### Requirement: Haunt-Specific Sub-Ledgers

The `betrayal` redesign MUST NOT claim complete haunt support from representative haunts; each haunt needs an individual interaction contract before implementation can claim that haunt complete.

#### Scenario: Haunt index exists

- **WHEN** the redesign scope includes all 50 haunts
- **THEN** the directory-level haunt index lists every haunt and the source-page ledger maps every haunt to official hero / traitor source ranges before implementation planning

#### Scenario: Haunt enters implementation

- **WHEN** a haunt is selected for implementation
- **THEN** its contract covers identification, public setup, hero and traitor goals, special rules, special actions, tokens, important locations, monster boxes, win text, and verification evidence

#### Scenario: Haunt source is mapped but contract is missing

- **WHEN** a haunt has official source pages but no independent interaction contract
- **THEN** it remains `source-mapped-contract-pending` and MUST NOT be implemented or claimed complete

#### Scenario: Representative haunt exists

- **WHEN** a haunt has only a happy-path or representative chain
- **THEN** it remains marked representative-only until the haunt-specific contract and validation are complete

### Requirement: Review Gate Before Implementation

The `betrayal` implementation MUST NOT enter gameplay code implementation for this redesign until the P0 interaction list and representative-only boundaries are reviewed or explicitly approved.

#### Scenario: Proposal is still in design review

- **WHEN** the P0 interaction list or representative MVP boundary has not been reviewed
- **THEN** work remains limited to proposal, design, coverage matrix, or evidence updates

#### Scenario: User approves implementation

- **WHEN** the user approves the P0 list and implementation batch
- **THEN** implementation may proceed in small passes that map back to the coverage matrix

### Requirement: Player Decision Preservation

The `betrayal` implementation MUST preserve mandatory player decision points unless the user explicitly approves a representative or automated boundary.

#### Scenario: Rule requires a player choice

- **WHEN** a rule requires choosing a scenario, target, direction, orientation, placement edge, damage allocation, or optional action
- **THEN** the implementation provides a command payload or interaction that records the choice

#### Scenario: Automated fallback is used

- **WHEN** an automated fallback selects the first legal option or default result
- **THEN** the coverage matrix marks it as representative-only or approved automation, not complete rule support

### Requirement: Track And Progress Modeling

The `betrayal` implementation MUST model tracks, nonlinear attributes, cumulative risk, and threshold pressure as rule state rather than only as scalar values or logs.

#### Scenario: Attribute uses a track

- **WHEN** a character attribute is represented by a printed track, marker position, limit, threshold, or failure marker
- **THEN** the state model stores position/track identity or an equivalent structure, and current numeric value is derived from that model

#### Scenario: Omen risk changes haunt pressure

- **WHEN** omen count changes haunt dice count or risk pressure
- **THEN** the state and UI expose the current total and the next risk state before or during the relevant decision

### Requirement: Space Placement Contract

The `betrayal` implementation MUST model room exploration, placement, orientation, and connectivity as rule data and player interaction, not display-only layout.

#### Scenario: New room is explored

- **WHEN** a player explores through an unexplored doorway
- **THEN** the interaction identifies the entry doorway, drawn room candidate, legal connection choices, selected orientation, and resulting room connections

#### Scenario: Placement would seal a region

- **WHEN** the only matching room tile can connect to the entry doorway but would leave its region without any open doorway
- **THEN** the interaction blocks automatic placement and requires a player-visible tile-adjustment decision that records which existing room tile changed, the selected position or orientation, and the resulting open doorway before the new room can be confirmed

#### Scenario: Placement is not fully implemented

- **WHEN** room orientation or connection is automatically chosen
- **THEN** the matrix marks the behavior as representative-only unless the user explicitly approves it as the intended simplified rule
