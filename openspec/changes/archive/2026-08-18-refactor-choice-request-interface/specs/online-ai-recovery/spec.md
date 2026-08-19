## ADDED Requirements

### Requirement: Online AI Recovery SHALL Consume Choice Request Diagnostics

Online AI recovery SHALL use Choice Request diagnostics to understand why an AI-controlled seat is blocked, rather than inferring business targets or relying only on generic timeout recovery.

#### Scenario: AI lacks policy for current request
- **GIVEN** an online AI seat is blocked by a Choice Request
- **AND** legal action generation reports a missing AI policy
- **WHEN** recovery records the incident
- **THEN** the incident MUST identify the choice kind, request source, actor, candidate count, and missing policy category
- **AND** watchdog MUST NOT invent a target or choose the first business candidate as a substitute strategy

#### Scenario: Choice Request has invalid candidate bounds
- **GIVEN** an online AI seat is blocked by a mandatory Choice Request whose enabled candidates cannot satisfy the minimum selection count
- **WHEN** recovery evaluates the blocked seat
- **THEN** the incident MUST classify the failure as an invalid or unsatisfied request
- **AND** recovery MAY only use an explicit request-declared skip, pass, cancel, or confirm-current path if one exists

### Requirement: Watchdog SHALL Remain Recovery, Not Business Decision Logic

Online AI watchdog SHALL recover from stalls by re-entering the authoritative AI execution path or executing an explicit Choice Request recovery action; it MUST NOT become a parallel business selection engine.

#### Scenario: Choice Request declares explicit skip
- **GIVEN** a stalled AI-owned request declares an explicit skip or pass action
- **WHEN** watchdog recovery is allowed to act
- **THEN** watchdog MAY request execution of that declared recovery action through the authoritative AI/server path
- **AND** the action MUST be recorded as a recovery outcome with the Choice Request snapshot

#### Scenario: Choice Request requires strategic target choice
- **GIVEN** a stalled AI-owned request requires choosing among strategic targets
- **AND** no AI policy can score those targets
- **WHEN** watchdog recovery runs
- **THEN** watchdog MUST report the missing strategy as the blocking reason
- **AND** it MUST NOT choose a target solely because it is first, closest, visible, or easy to serialize
