## ADDED Requirements

### Requirement: New DiceThrone Heroes Must Have Role-Level Audit Coverage Before Completion Claims
The project SHALL define role-level audit coverage before declaring newly added DiceThrone heroes complete.

#### Scenario: Completion claim requires explicit audited scope
- **GIVEN** Gunslinger and Samurai have already received partial fixes and targeted regressions
- **WHEN** the project reports whether the two heroes are "complete"
- **THEN** it MUST state the audited scope by interaction family
- **AND** it MUST distinguish "identified gaps closed" from "all hero content exhaustively audited"

#### Scenario: Shared-root issues are tracked separately from single-card issues
- **GIVEN** an issue discovered while auditing Gunslinger or Samurai
- **WHEN** the root cause belongs to a shared interaction, token, damage, or command path
- **THEN** the issue MUST be recorded as a shared-root audit item
- **AND** the completion status MUST depend on whether the shared path has been audited and fixed

### Requirement: Role-Level Acceptance Requires Both Domain Regressions and Real-Click E2E
The project SHALL require both representative domain regressions and representative real-click E2E coverage before treating a newly added DiceThrone hero as accepted for the current release scope.

#### Scenario: Representative domain regressions cover high-risk families
- **GIVEN** a newly added DiceThrone hero
- **WHEN** the project evaluates release readiness
- **THEN** domain regressions MUST cover each high-risk interaction family discovered during audit
- **AND** those families MUST include any shared custom-action, token-response, or multiplayer target-selection paths that were modified during the release

#### Scenario: Real-click E2E includes at least one true entry path per hero
- **GIVEN** a newly added DiceThrone hero
- **WHEN** the project evaluates release readiness
- **THEN** the E2E evidence MUST include at least one real-click entry path for that hero
- **AND** that entry path MUST begin from an actual player entry such as hand play, attack flow, or live response window
- **AND** the project MUST NOT treat pure state injection after the interaction is already open as sufficient by itself

### Requirement: Residual Scope Must Remain Explicit After Partial Closure
The project SHALL keep residual scope explicit when only part of a new hero's interaction families have been audited.

#### Scenario: Closed gaps do not imply exhaustive completion
- **GIVEN** Gunslinger and Samurai have closed several confirmed gaps across implementation, regression tests, and E2E
- **WHEN** some interaction families still lack role-level audit or representative E2E
- **THEN** the project MUST report those remaining families as residual scope
- **AND** it MUST NOT describe the two heroes as exhaustively complete
