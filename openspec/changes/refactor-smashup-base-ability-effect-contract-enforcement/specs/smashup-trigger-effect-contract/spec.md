## ADDED Requirements
### Requirement: Queued base abilities MUST declare an effect contract before entering the reaction queue
Smash Up SHALL reject any queued base ability or queued extended base ability that lacks an explicit `effectContract` declaration.

#### Scenario: Missing base ability contract is rejected at queue collection time
- **GIVEN** a base ability can be collected into the Smash Up trigger queue
- **WHEN** its registration omits `effectContract`
- **THEN** collection MUST throw an error before the trigger enters the queue

#### Scenario: Missing extended base ability contract is rejected at queue execution time
- **GIVEN** an extended base ability is registered for queued execution
- **WHEN** its executor is invoked without a declared `effectContract`
- **THEN** execution MUST throw an error instead of silently resolving

### Requirement: Queued base abilities MUST obey the same runtime contract guard as ordinary triggers
Smash Up SHALL apply the trigger effect contract runtime guard to queued base abilities and queued extended base abilities.

#### Scenario: Undeclared base ability state read is rejected
- **GIVEN** a queued base ability reads Smash Up core state during execution
- **WHEN** that read is not covered by its declared `reads`
- **THEN** execution MUST throw an error describing the missing declaration

#### Scenario: Base ability opens an interaction without declaration
- **GIVEN** a queued base ability creates a new interaction during execution
- **WHEN** its contract omits `opensInteraction: true`
- **THEN** execution MUST throw an error instead of leaving an implicit interaction side effect

### Requirement: Base ability footprints MUST be precise enough to avoid false ordering prompts
Smash Up SHALL only surface `smashup_reaction_choose` for base abilities when their declared resources actually conflict.

#### Scenario: Independent mandatory base abilities auto-resolve
- **GIVEN** two simultaneous mandatory base abilities do not share any conflicting declared resource
- **WHEN** the reaction queue advances
- **THEN** they MUST auto-resolve without opening `smashup_reaction_choose`

#### Scenario: Non-conflicting interactive base ability goes straight to its real prompt
- **GIVEN** a mandatory base ability opens a real player interaction but does not conflict with any other queued trigger
- **WHEN** the reaction queue advances
- **THEN** the system MUST enter that base ability interaction directly
- **AND** it MUST NOT first open `smashup_reaction_choose`
