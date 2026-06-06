## ADDED Requirements

### Requirement: Smash Up reaction ordering MUST scope self-state by concrete trigger source

Smash Up SHALL resolve any footprint that refers to a trigger's own source state against the concrete queued source instance, rather than treating all self-state mutations as a single shared ordering bucket.

#### Scenario: Two self-destruction triggers from different source cards
- **GIVEN** two mandatory `onTurnStart` triggers each only mutate their own attached ongoing card
- **WHEN** both triggers are queued in the same reaction frame
- **THEN** the ordering system MUST treat them as independent unless they also share some other declared read/write resource
- **AND** they MUST NOT conflict solely because both mutate “their own source”

#### Scenario: One trigger source remains concrete after queueing
- **GIVEN** a queued trigger has a `sourceCardUid`
- **WHEN** its ordering footprint references self-state
- **THEN** the materialized ordering resource MUST be keyed by that concrete source instance
- **AND** another trigger with a different `sourceCardUid` MUST receive a different self-state resource key

### Requirement: Smash Up mandatory ordering UI MUST advance by conflict component, not by whole frame

Smash Up SHALL partition simultaneous mandatory triggers by ordering conflict and only surface the current conflicting component to `smashup_reaction_choose`.

#### Scenario: Independent singleton trigger coexists with a conflicting pair
- **GIVEN** one mandatory trigger is independent from every other trigger in the frame
- **AND** two other mandatory triggers in the same frame do conflict with each other
- **WHEN** the reaction session advances
- **THEN** the independent singleton trigger MUST auto-resolve outside the ordering prompt
- **AND** `smashup_reaction_choose` MUST only list the conflicting pair

#### Scenario: Entire mandatory frame is independent
- **GIVEN** every mandatory trigger in a frame is independent from every other trigger in that frame
- **WHEN** the reaction session advances
- **THEN** the system MUST auto-resolve them sequentially without opening `smashup_reaction_choose`

### Requirement: Self-destruction-only mandatory triggers MUST NOT create meaningless ordering prompts

Smash Up SHALL not present a self-destruction-only mandatory trigger as a manual ordering choice unless its declared resources actually conflict with another trigger that can change the legal settlement result.

#### Scenario: Overrun only destroys itself
- **GIVEN** `zombie_overrun` is queued for its owner's `onTurnStart` self-destruction
- **WHEN** no other queued trigger shares any declared conflicting resource with that specific source instance
- **THEN** `zombie_overrun` MUST auto-resolve
- **AND** it MUST NOT appear as a button inside `smashup_reaction_choose`
