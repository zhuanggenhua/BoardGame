# smashup-titan-deployment Specification

## Purpose
TBD - created by archiving change add-smashup-ancient-egyptians-pod. Update Purpose after archive.
## Requirements
### Requirement: Smash Up Sphinx Titan Deployment

The Smash Up titan system SHALL support the Ancient Egyptians titan `sphinx` for both the base and POD Ancient Egyptians factions.

#### Scenario: Start-of-turn special deploys Sphinx from a buried card

- **WHEN** the controlling player starts their turn with `sphinx` in set-aside and at least one of their buried cards on a base
- **THEN** the game SHALL offer an interaction to choose one of that player's buried cards
- **AND** upon confirmation it SHALL return that buried card to its owner's hand through the shared buried-return event
- **AND** it SHALL then play `sphinx` onto that buried card's former base

#### Scenario: After-scoring special only checks Sphinx's scoring base

- **WHEN** a base scores while `sphinx` is in play on that base
- **THEN** the game SHALL only inspect buried cards on that same scoring base for `sphinx`'s owner
- **AND** if none exist it SHALL not create an interaction

#### Scenario: Talent buries a card from hand on Sphinx's base

- **WHEN** the controlling player activates `sphinx`'s talent while it is on a base
- **THEN** the game SHALL use the standard bury-from-hand pipeline on that base
- **AND** it SHALL not create a separate bespoke bury implementation for `sphinx`

### Requirement: Smash Up Pecos Bill Titan Deployment

The Smash Up titan system SHALL support the Cowboys titan `pecos_bill` for both the base and POD Cowboys factions.

#### Scenario: Duel-start special deploys Pecos Bill after discarding a card

- **WHEN** the controlling player becomes the challenger in a duel while `pecos_bill` is in set-aside and they have a card in hand
- **THEN** the game SHALL offer an interaction to discard a card and deploy `pecos_bill` to that duel's base
- **AND** it SHALL not require a separate `pecos_bill_pod` definition

#### Scenario: Pecos Bill blocks other players from moving or returning minions on its duel base

- **WHEN** a duel is active on the base where `pecos_bill` is in play
- **THEN** other players SHALL not be able to move minions from that base
- **AND** other players SHALL not be able to return minions from that base to a player's hand

#### Scenario: Pecos Bill draws after its controller wins a duel

- **WHEN** `pecos_bill` is in play and its controller wins a duel
- **THEN** the game SHALL draw 1 card for that controller
- **AND** it SHALL use the shared duel-resolved lifecycle rather than titan-specific state mutation

#### Scenario: Pecos Bill defers titan clash until the duel ends

- **WHEN** `pecos_bill` enters a base that already contains another titan during a duel
- **THEN** the game SHALL defer that titan clash until the duel resolves
- **AND** it SHALL perform one clash check on that base immediately after the duel ends

