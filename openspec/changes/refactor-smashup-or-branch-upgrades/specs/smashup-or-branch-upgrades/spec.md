## ADDED Requirements

### Requirement: Smash Up OR Branching Ability Builder
Smash Up SHALL provide a unified builder for abilities whose rules text asks the player to choose one effect branch from an `OR` ability.

#### Scenario: OR ability uses unified builder instead of ad-hoc prompt
- **GIVEN** a Smash Up card ability whose rules text says the player may do `A` or `B`
- **WHEN** the ability is implemented in the rules layer
- **THEN** the implementation SHALL use the unified branching ability builder
- **AND** the branch metadata SHALL remain available to follow-up handlers through continuation context

### Requirement: OR Upgrade Resolves Through Sequential Follow-Up Choice
Smash Up SHALL resolve eligible `optional-both` OR upgrades as **choose one branch first, execute it first, then offer the remaining branch or skip**.

#### Scenario: Upgrade provider adds remaining-branch follow-up after first branch resolves
- **GIVEN** a branching OR ability is being resolved
- **AND** an eligible upgrade provider is available for that player and ability instance
- **WHEN** the player chooses branch `A`
- **THEN** the system SHALL execute branch `A` before offering any second branch
- **AND** after branch `A` resolves the system SHALL show only the remaining branch `B` plus `skip`
- **AND** the system SHALL NOT require the player to choose `A` and `B` together in a single ordered multi-selection prompt

### Requirement: Branching OR Resolution SHALL Survive Sub-Interactions
Smash Up SHALL keep a resumable branch plan so that a chosen branch may open its own targeting interaction and still return to the remaining OR branch afterward.

#### Scenario: Chosen branch opens sub-target prompt before remaining branch
- **GIVEN** a branching OR ability has been upgraded to resolve both branches in any order
- **AND** the player first chooses branch `A`
- **AND** branch `A` opens a follow-up targeting interaction
- **WHEN** that targeting interaction finishes resolving
- **THEN** the system SHALL resume the saved branch plan
- **AND** it SHALL continue by offering only the remaining branch `B` plus `skip`

### Requirement: OR Branch Choice SHALL Be Separate From Branch-Internal Target Choice
Smash Up SHALL keep the OR branch picker separate from any later target picker that belongs to the selected branch itself.

#### Scenario: Titania first chooses effect branch and later chooses return target
- **GIVEN** `fairies_titania` is resolving
- **WHEN** the player is at the initial OR choice step
- **THEN** the prompt SHALL only ask whether to use `return_minion` or `extra_minion`
- **AND** it SHALL NOT mix concrete minion targets into that initial branch prompt
- **WHEN** the player chooses `return_minion`
- **THEN** the system SHALL open a later target-selection prompt for the specific minion to return

### Requirement: Optional-Both Upgrade Consumption SHALL Only Happen On The Second Branch
Smash Up SHALL only consume the `optional-both` upgrade when the player actually chooses to execute the remaining second branch.

#### Scenario: Follow-up skip does not consume Spirit of the Forest
- **GIVEN** an OR ability has already executed its first chosen branch
- **AND** the follow-up prompt shows the remaining branch plus `skip`
- **WHEN** the player chooses `skip`
- **THEN** the system SHALL end the branch plan without consuming the upgrade source
- **WHEN** the player instead chooses the remaining branch
- **THEN** the system SHALL consume the upgrade source before resolving that second branch
