## ADDED Requirements

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
