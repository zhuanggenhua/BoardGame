## ADDED Requirements

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
