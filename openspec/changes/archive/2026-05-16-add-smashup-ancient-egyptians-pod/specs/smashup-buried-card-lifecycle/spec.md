## ADDED Requirements

### Requirement: Buried Card Return-To-Hand Event Lifecycle

The Smash Up buried-card lifecycle SHALL provide a shared `BURIED_CARD_RETURNED_TO_HAND` event for effects that move a buried card directly back to its owner's hand.

#### Scenario: Shared buried return removes the buried card from its base

- **WHEN** `BURIED_CARD_RETURNED_TO_HAND` is reduced
- **THEN** the referenced buried card SHALL be removed from the specified base's buried zone
- **AND** the card SHALL be added to the owning player's hand

#### Scenario: Shared buried return bypasses uncover and discard

- **WHEN** a buried card is returned through `BURIED_CARD_RETURNED_TO_HAND`
- **THEN** the game SHALL not emit `BURIED_CARD_UNCOVERED`
- **AND** the card SHALL not pass through the discard pile

#### Scenario: Shared buried return participates in card-return triggers

- **WHEN** a buried card is returned to hand through the shared event
- **THEN** the generic `onCardReturnedToHand` trigger timing SHALL be processed for that player
- **AND** the event payload SHALL preserve `playerId`, `cardId`, `baseId`, and `source`
