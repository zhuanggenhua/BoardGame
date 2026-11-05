## ADDED Requirements

### Requirement: Fate mechanism framework uses one canonical execution seam

Fate/Domination SHALL route card, skill, event, situation, resource, movement, battle, response, replacement, prevention, continuous, delayed, and elimination mechanics through the existing DomainCore + Pipeline + shared ability/timing/interaction/resolution primitives.

#### Scenario: New ability has one authoritative execution path
- **GIVEN** a Fate card or skill is added with a locked or authority-summary source contract
- **WHEN** the ability is registered for runtime use
- **THEN** it SHALL use the Fate ability registry and a single declaration-based or command-based executor path
- **AND** it SHALL NOT create a parallel registry, UI-owned pending state, or duplicate effect DSL

### Requirement: Mechanism state is separated from presentation state

The Fate runtime SHALL keep rule facts in `G.core`, system blocking and recovery state in `G.sys`, and player/AI/referee views as derived projections.

#### Scenario: Design layout changes without changing rule truth
- **GIVEN** the Fate design draft changes board composition or card surface placement
- **WHEN** the Board is updated
- **THEN** the core commands, events, ChoiceRequest semantics, visibility boundaries, and resolution ownership SHALL remain unchanged
- **AND** the Board SHALL continue to consume the shared read model and live interaction contract

### Requirement: Complex mechanics use explicit timing and resolution contracts

Fate mechanics involving optional actions, responses, replacement, prevention, continuous modifiers, delayed effects, private choices, or nested follow-up SHALL use explicit `TimingPoint`, `Opportunity`, `ChoiceRequest`, `ResponseWindow`, `ResolutionFrame`, or `EventCommit` contracts as applicable.

#### Scenario: Battle response pauses and resumes the parent chain
- **GIVEN** a battle result has a legal response or replacement opportunity
- **WHEN** the response window opens
- **THEN** the battle resolution frame SHALL become blocked by that response owner
- **AND** after the response completes or all responders pass, the parent battle frame SHALL resume from its recorded step
- **AND** phase auto-advance SHALL remain blocked until the frame completes

### Requirement: Object semantics and visibility are explicit

Fate target, material, reference, owner, controller, holder, zone, and private/public visibility SHALL be represented by stable references and provenance rather than inferred from UI arrays, current containers, or player focus.

#### Scenario: Hidden Shinto event remains private while resolving
- **GIVEN** an event card is face down for Shinto
- **WHEN** another player's view or AI view is generated
- **THEN** the event identity and effect text SHALL remain hidden
- **AND** a later response or resolution frame SHALL use the stored object reference and permitted snapshot data rather than reconstructing the card from a UI selection

### Requirement: Rule changes use a typed rule-modification seam

Fate rule-changing effects SHALL be represented as typed, source-aware rule modifications in the Fate adapter, composed from existing modifier, condition, timing, replacement/prevention, restriction, suppression, and event-interceptor primitives. A rule-changing effect SHALL declare scope, priority, stacking, duration, removal, affected rule query, provenance, and whether it changes legality, cost, value, visibility, trigger availability, scoring, or event outcome.

#### Scenario: Ongoing rule effect changes legality without mutating printed data
- **GIVEN** an ongoing Fate effect says a card, skill, movement, or resource action is forbidden or altered for a duration
- **WHEN** legality or cost is queried
- **THEN** the query SHALL evaluate active rule modifications in deterministic order
- **AND** the printed card/skill definition SHALL remain immutable
- **AND** the modification SHALL be removable by source, duration, or explicit expiry event

#### Scenario: Location effect changes movement legality
- **GIVEN** the locked `固有结界` event is active at a battlefield
- **WHEN** any player attempts to enter or leave that location
- **THEN** the movement legality query SHALL reject the move
- **AND** the same event SHALL reject playing a special-attribute attack at that battlefield
- **AND** an effect movement or a player-specific exception SHALL only bypass the restriction when the authoritative card contract explicitly says so

#### Scenario: Engagement exception changes only the declared movement mode
- **GIVEN** a locked ability says its controller may ignore engagement while moving
- **WHEN** the controller uses that ability
- **THEN** the engine SHALL permit the declared normal/effect movement mode according to the ability contract
- **AND** it SHALL still evaluate destination legality, path, capacity, cost, and other independent restrictions

#### Scenario: Multiple rule modifications have an auditable order
- **GIVEN** two or more effects change the same legality, value, or event
- **WHEN** the rule query or EventCommit runs
- **THEN** the framework SHALL apply declared priority and stacking policy
- **AND** the result SHALL retain the applied source IDs and provenance for replay/referee inspection

### Requirement: Copy and borrow effects preserve source and execution context

Fate copy/borrow effects SHALL distinguish the printed source object, copied ability/effect, copying object, executing controller, executing owner, material card, target/reference objects, and current zone. Copying SHALL use an explicit copy mode such as effect-only, ability-with-choice, printed-card proxy, or controller-borrowed ongoing; changing only `abilityId` or only `cardId` SHALL NOT be considered sufficient.

#### Scenario: Copying another card's ability rebinds controller and target semantics
- **GIVEN** a Fate ability copies an ability from another card or entity
- **WHEN** the copied ability resolves
- **THEN** the copied ability SHALL retain provenance to the original source and copying object
- **AND** costs, permissions, targets, ownership, controller, and “you/your” references SHALL follow the declared copy policy
- **AND** the copied effect SHALL enter the same ChoiceRequest/ResponseWindow/ResolutionFrame seam as a native effect

#### Scenario: Recursive copy is bounded and replayable
- **GIVEN** a copied ability can itself copy or defer another ability
- **WHEN** the copy chain expands
- **THEN** the resolution frame SHALL track origin frame, copy depth, visited source/ability keys, and a deterministic cycle policy
- **AND** the chain SHALL stop with an auditable rejection event when the depth or cycle policy is reached

### Requirement: Ownership, control, holder, and source controller are separate

Fate SHALL keep owner, controller, holder, source controller, and current zone as separate fields or stable references. Borrowed or transferred ongoing effects SHALL resolve permissions and cleanup using the declared lens instead of assuming `owner === controller`.

#### Scenario: Borrowed ongoing ability survives control transfer correctly
- **GIVEN** a continuous ability is controlled by one player but owned or held by another object/player
- **WHEN** its trigger, cleanup, suppression, or AI availability is evaluated
- **THEN** the framework SHALL use the declared owner/controller/source-controller lens
- **AND** moving or transferring the carrier SHALL not silently retarget or orphan the ability

### Requirement: Mechanism coverage is auditable

The Fate change SHALL maintain a mechanism matrix mapping every implemented mechanism family to its source contract, shared owner or Fate adapter, commands, events, view surface, AI support, tests, and failure policy. The matrix SHALL explicitly include rule modification, copy/borrow, control transfer, proxy/variant objects, and recursive resolution.

#### Scenario: A new mechanism is not accepted without an owner
- **GIVEN** a new Fate mechanic is proposed
- **WHEN** its implementation plan is reviewed
- **THEN** the mechanism matrix SHALL identify its timing, state owner, command, event, interaction, resolution, visibility, AI, and verification surfaces
- **AND** a missing owner SHALL block implementation rather than create a private fallback branch

### Requirement: Incomplete source data fails closed

Runtime implementation SHALL preserve `partial`, `blocked`, `disputed`, and `authority-summary` source status and SHALL NOT present unverified Fate card text as complete gameplay semantics.

#### Scenario: Blocked card text is not promoted to a rule
- **GIVEN** a card or event has no readable authoritative Chinese effect text
- **WHEN** the mechanism registry is generated
- **THEN** the object MAY remain addressable as an indexed card or placeholder
- **AND** its unverified effect SHALL remain unavailable to the authoritative executor until a later reviewed contract unlocks it
