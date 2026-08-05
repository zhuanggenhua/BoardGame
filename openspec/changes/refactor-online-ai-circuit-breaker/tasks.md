## 1. Specification and Baseline

- [x] 1.1 Confirm online-ai-recovery as the existing capability owner.
- [x] 1.2 Confirm the production CPU mechanism from repeated stale AI commands and watchdog recovery logs.
- [x] 1.3 Confirm the current three-attempt limit is fingerprint-scoped and does not cover direct AI commands.
- [x] 1.4 Define the `matchId + AI seat` circuit-breaker boundary and stale-decision lifecycle.
- [x] 1.5 Review and approve this change before implementation.

## 2. Circuit-Breaker Owner

- [x] 2.1 Add a focused transport-layer owner for per-match/per-AI-seat failure-window state.
- [x] 2.2 Add configurable window, failure budget, stale-epoch suppression, and one-shot safe-unblock policy.
- [x] 2.3 Remove progress-marker changes as an implicit counter reset while retaining the marker for diagnostics.
- [x] 2.4 Ensure unload, match completion, and explicit human takeover release the in-memory circuit state.

## 3. Command and Recovery Integration

- [x] 3.1 Gate Socket single commands before pipeline execution for AI seats.
- [x] 3.2 Gate batch and queued AI commands with the same seat-level budget.
- [x] 3.3 Record stale-state rejection as decision invalidation and suppress same-epoch replay.
- [x] 3.4 Route watchdog recovery and repeated-recovery handling through the same circuit owner.
- [x] 3.5 Keep safe-unblock to one audited attempt and prevent failure from rearming automatic retries.
- [x] 3.6 Preserve human-seat behavior and existing authoritative domain validation.

## 4. Diagnostics and Client Recovery

- [x] 4.1 Add structured circuit-breaker diagnostics to automatic feedback and server logs.
- [x] 4.2 Make the online AI bridge discard stale actions and wait for a new authoritative state before deciding again.
- [x] 4.3 Keep feedback and sync retry cooldowns as secondary observability/resilience mechanisms.

## 5. Regression and Production Validation

- [x] 5.1 Add focused unit tests for window budget, marker changes, stale epoch and one-shot safe-unblock.
- [x] 5.2 Add transport tests for command, batch, queue and watchdog convergence on one seat budget.
- [x] 5.3 Add a SmashUp stale-card-command regression reproducing the production failure shape.
- [x] 5.4 Run typecheck, focused tests and the repository's required quality gates.
- [ ] 5.5 After implementation approval and validation, use the formal deployment path and re-check CPU telemetry; do not treat restart success alone as root-cause closure.
