## ADDED Requirements
### Requirement: Fate/Domination foundation runtime
The system SHALL provide a `fate-domination` game package on the existing game runtime with typed deterministic domain state, commands, events, validation, and reduction. The formal product entry is online matching; development-only verification uses a separate dev route.

#### Scenario: Online match starts from the formal game route
- **WHEN** a user opens `/play/fate-domination/match/:matchId`
- **THEN** the game registry SHALL resolve the `fate-domination` manifest and mount its Board with a valid initial domain state
- **AND** development-only verification SHALL use `/dev/fate-domination` rather than being described as a product local mode

#### Scenario: Deterministic foundation state
- **WHEN** the same player setup and random seed are used
- **THEN** setup and event reduction SHALL produce the same entity IDs, phase, card zones, player resources, and pending choices

### Requirement: First playable tabletop flow
The system SHALL expose a first playable foundation flow covering setup identity, preparation reveal state, outpost deployment, two-card attack selection, confirmation, phase progression, and representative battle settlement; the formal product entry is online matching.

#### Scenario: Player deploys on a legal location
- **GIVEN** the player is in the outpost phase and the selected location has capacity
- **WHEN** the player selects the location object on the board
- **THEN** the game SHALL validate and apply `DEPLOY_MASTER`
- **AND** the player resource or terrain state SHALL update through a domain event

#### Scenario: Player selects exactly two attack cards
- **GIVEN** the player is in the action phase with legal hand cards
- **WHEN** the player selects attack cards from the card bodies
- **THEN** the UI SHALL show the selected cards and allow confirmation only when the rule contract is satisfied
- **AND** the domain SHALL reject a third card or an illegal phase transition

#### Scenario: Representative battle closes visibly
- **GIVEN** the demonstration state contains active attacks and a battlefield event
- **WHEN** the current resolver advances to battle resolution
- **THEN** the game SHALL record a representative power comparison and visible VP/result change
- **AND** the table SHALL return to the next actionable phase or an explicit deferred-state marker

### Requirement: Real card and board inspection
The system SHALL use approved local board/card assets as the visible subjects of the Fate/Domination table and SHALL allow permitted viewers to inspect visible cards without mutating domain state.

#### Scenario: Inspect a visible card
- **WHEN** a player clicks a visible hand, attack, event, or servant card
- **THEN** a card inspection overlay SHALL show the same real asset with readable Chinese context
- **AND** closing the overlay SHALL return to the same table state and preserve any existing selection

#### Scenario: Unverified situation effects fail closed
- **GIVEN** the supplied situation source directory contains real fronts and a back, but some card text/effects have not been verified
- **WHEN** the situation zone is rendered
- **THEN** the runtime SHALL use only supplied situation art and preserve the zone contract without rendering guessed card data
- **AND** the implementation status SHALL remain partial for unverified situation effects

#### Scenario: Face-down event content is not rendered to other players
- **GIVEN** the Shinto event is face down
- **WHEN** another player's Fate/Domination Board is rendered
- **THEN** the Board SHALL NOT render the face-down event card face or effect text
- **AND** this foundation change SHALL NOT claim transport-layer anti-cheat or stronger server-side secrecy

### Requirement: Table information hierarchy and responsive delivery
The system SHALL present map/locations, player resources, hand/attack cards, event/situation zones, pile counts, phase status, and current actions in one desktop-first tabletop composition that remains reachable on mobile.

#### Scenario: Desktop tabletop baseline
- **WHEN** the local match is rendered at 1920x1080
- **THEN** the main board, current player state, hand, public event/situation zones, phase status, and primary action SHALL be visible without page-level scrolling
- **AND** card assets SHALL retain their source aspect ratios

#### Scenario: Mobile tabletop remains actionable
- **WHEN** the same match is rendered at 375x812
- **THEN** the same Board SHALL preserve the primary phase/action context and make map, hand, and card inspection reachable through responsive layout or internal scrolling
- **AND** touch targets SHALL remain at least 44 CSS pixels without overlap or clipped controls

### Requirement: Explicit capability boundaries
The system SHALL record the foundation change's action-log, undo-system, audio-feedback, game-ai-system, tutorial-engine, and debug-config status explicitly, including deferred work and its impact.

#### Scenario: Deferred capability is not presented as complete
- **WHEN** a user reviews the Fate/Domination foundation change
- **THEN** each attachment capability SHALL be labeled `实施本轮`, `本轮明确跳过`, or `仅保留底层接口，UI 暂不交付`
- **AND** missing situation data, complete AI, tutorial, audio, debug UI, and remote publishing SHALL not be represented as completed gameplay
