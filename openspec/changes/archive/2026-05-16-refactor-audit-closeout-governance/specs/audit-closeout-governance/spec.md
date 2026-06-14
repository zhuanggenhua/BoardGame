## ADDED Requirements

### Requirement: Completion Claims MUST Declare Their Evidence Level
The project SHALL classify audit claims by evidence level instead of using a single ambiguous "closed" conclusion.

#### Scenario: Structural checks cannot be reported as gameplay closure
- **GIVEN** a task has passed metadata, registration, targetType, defId, or interaction completeness audits
- **WHEN** the project reports the task status
- **THEN** it MUST describe that result as structural or contract-level evidence
- **AND** it MUST NOT describe that result alone as gameplay-complete or fully closed

#### Scenario: Release-scope closure requires real entry-path evidence
- **GIVEN** a task claims current release-scope completion for gameplay or interaction behavior
- **WHEN** the claim is written in an evidence document, review summary, or workflow closeout
- **THEN** the claim MUST include representative domain evidence and at least one real entry-path interaction proof
- **AND** that interaction proof MUST begin from an actual gameplay entry such as playing a card, entering a response window, or triggering a live rule path

### Requirement: The Project MUST Distinguish Invalid Proof From Valid Closure Evidence
The project SHALL explicitly forbid known false-positive evidence patterns from being used as the sole basis for gameplay closure.

#### Scenario: Display-only E2E cannot close gameplay audit
- **GIVEN** an E2E run only proves faction selection, banners, room UI, or static asset display
- **WHEN** the project evaluates gameplay audit completion
- **THEN** that evidence MUST be treated as display or availability proof only
- **AND** it MUST NOT be used by itself to claim gameplay or rules closure

#### Scenario: Static coverage cannot masquerade as behavior completeness
- **GIVEN** the project has verified that `registerAbility` entries appear in a regression file or that static coverage gaps are zero
- **WHEN** the project evaluates implementation completeness
- **THEN** it MUST treat that result as coverage bookkeeping only
- **AND** it MUST NOT infer that the corresponding behaviors are fully correct without behavioral evidence

#### Scenario: Injected interactions cannot masquerade as true entry-path proof
- **GIVEN** an interaction is opened by state injection or by entering after the prompt is already active
- **WHEN** the project evaluates end-to-end evidence strength
- **THEN** that run MUST be labeled as injected-interaction evidence
- **AND** it MUST NOT be treated as equivalent to a true entry-path gameplay proof

### Requirement: Residual Scope and Shared-Root Status MUST Remain Explicit
The project SHALL keep residual scope and shared-root status explicit whenever only part of the audited object has been verified.

#### Scenario: Partial closure keeps residual families visible
- **GIVEN** a module, faction, hero, or feature has closed some confirmed gaps
- **WHEN** other interaction families or rule paths remain unaudited or only structurally checked
- **THEN** the report MUST list those remaining families as residual scope
- **AND** it MUST NOT collapse the object into an unqualified "fully complete" statement

#### Scenario: Shared-root defects block object-level closure
- **GIVEN** a defect is discovered during object audit
- **WHEN** the root cause belongs to a shared reducer, helper, trigger path, interaction system, or UI consumption path
- **THEN** the report MUST classify it as a shared-root audit item
- **AND** object-level closure MUST depend on whether that shared path has been audited and fixed

### Requirement: Invalidated Conclusions MUST Be Written Back to the Original Audit Record
The project SHALL revoke previous audit conclusions when later evidence proves they were incomplete or incorrect.

#### Scenario: New evidence invalidates a previous closeout
- **GIVEN** an evidence document or rollout summary previously declared an object closed
- **WHEN** later verification finds a missed rule path, misread rule text, or false-positive validation basis
- **THEN** the original audit record MUST be updated with an invalidation note
- **AND** later summary documents MUST stop repeating the old closure claim without that invalidation context

#### Scenario: Repaired scope must explain the old mistake
- **GIVEN** an old closeout conclusion has been revoked
- **WHEN** the project writes the repair record
- **THEN** it MUST explain which previous conclusion failed
- **AND** it MUST state why the earlier evidence was insufficient
- **AND** it MUST link the new regression or real-entry verification that replaces the old claim
