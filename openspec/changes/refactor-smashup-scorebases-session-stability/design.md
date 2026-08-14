## Context
Phase 1 audit was accepted on the latest `upstream/main` baseline. It found that SmashUp already has partial scoring-session infrastructure:

- `ScoringSession` lives in the `smashup:score-bases` resolution frame.
- Stable base refs already use `baseInstanceId` when available, with `slotIndex + baseDefId` fallback.
- Deferred post-scoring payloads already live on the scoring resolution frame.
- `finalizeCurrentScoringBase()` and the Flow path are the main clear/replace finalization owners.

The remaining issue is not absence of infrastructure. Global `scoreBases` progression is still distributed across the scoring driver, `scoreOneBase()`, technical wait flags, EventSystem recovery logic, ReactionSession, and ResponseWindow close/pass paths.

Phase 1 also confirmed the #128 gameplay bug: `onMinionDiscardedFromBase` could be collected from `scoringBase.minions` before actual `BASE_CLEARED`, so a First Mate that moved during After Scoring could still be treated as if it was later cleared/discarded. The ordering fix is now part of the upstream baseline and remains a prerequisite invariant for the semantic scoring stages.

## Goals / Non-Goals
- Goals for the completed Stage 1-6 stabilization:
  - Represent the current SmashUp scoring rule step authoritatively in existing `ScoringSession` / resolution-frame state.
  - Represent blocker/wait information separately from semantic rule progression.
  - Keep `currentBaseRef` ownership in `ScoringSession`.
  - Ensure only the scoring driver advances semantic rule steps.
  - Keep local scoring executors from reading global session state to decide global continuation.
  - Preserve existing continuation flags and shadow-reduce behavior as compatibility paths while adding the semantic representation.
- Non-Goals for the completed Stage 1-6 stabilization:
  - Do not further redesign the established #128 cleanup ordering.
  - Do not remove shadow reduce or core rollback yet.
  - Do not rewrite `ResponseWindowSystem`, merge it with `ReactionSession`, or redesign the generic engine.
  - Do not delete `beforeScoringTriggeredBases`, `whenScoringTriggeredBases`, `afterScoringTriggeredBases`, `flowHalted`, or `_waitFor...` flags merely because the new representation exists.
  - Do not decompose `finalize-base` or `complete-base` in this stage.
  - Do not change card behavior, scoring rules, or unrelated ability handlers.

## Completed Stabilization Decisions

### Decision 1: Dependency direction is driver -> explicit executor input
`scoreOneBase()` must not become a reader of global `ScoringSession` state. The scoring driver reads `ScoringSession`, determines `currentBaseRef`, semantic rule step, and blocker/suspension reason, then invokes a local scoring step executor with explicit inputs.

Allowed direction:

```text
Scoring driver
  -> reads ScoringSession
  -> determines currentBaseRef, ruleStep, blocker
  -> calls executeScoringStep(state, currentBaseRef, ruleStep, ...)
  -> receives explicit result
```

Disallowed direction:

```text
scoreOneBase() / executor
  -> reads global ScoringSession
  -> decides current base or global continuation
```

### Decision 2: Use one authoritative semantic rule progression plus blocker state
The representation distinguishes where the scoring transaction is in SmashUp game rules from why execution is temporarily blocked.

```text
currentBaseRef = Tortuga
ruleStep = after-scoring
blocker = interaction i-123
```

The transaction remains in After Scoring until the scoring driver advances it. Resolving an interaction clears or updates the blocker; it does not independently advance `ruleStep`.

`currentStep` may remain temporarily as compatibility/derived state, but it must not become a second independently writable authority beside `ruleStep`.

### Decision 3: #128 cleanup ordering is a prerequisite invariant
The semantic refactor builds on the upstream invariant:

```text
VP
  -> all After Scoring resolution
  -> actual BASE_CLEARED
  -> derive discard/leave triggers from cards that actually left
```

The semantic-session stages must preserve this ordering and must use the shared `scoringFinalization.ts` implementation rather than duplicate cleanup collection or finalization in `index.ts`.

### Decision 4: Deferred finalization remains driver/Flow-owned in Stage 1-6
Deferred finalization remains centralized through `finalizeCurrentScoringBase()` and its scoring driver/Flow path. Stage 1-6 does not move finalization into interaction handlers, ReactionSession, or the generic engine. Exactly-once consume/emit behavior remains covered by tests.

### Decision 5: Existing flags remain compatibility paths
`flowHalted`, `_waitForScoreBasesInteractionReduce`, `_waitForPostScoringReduce`, triggered-base arrays, reaction/session state, and response-window state still protect resume-order behavior. Stage 1-6 may map them into blocker/wait information, but does not delete them as a side effect of introducing semantic rule steps.

### Decision 6: Semantic rule execution uses a local synchronous driver loop
`driveScoreBasesSession()` reads the authoritative `ruleStep` and calls `executeCurrentScoringRuleStep()` with that explicit step. The executor returns its preview core, events, next semantic step, and any pipeline-yield/deferred-finalization request. The driver alone applies the returned session progression.

The driver may synchronously continue through `before-scoring`, `when-scoring`, `award-vp`, and `after-scoring` while no child interaction, ReactionSession, or pipeline-yield boundary exists. This preserves the existing combined event batch and one shadow-core rollback. Trigger queues that require the outer pipeline to materialize a child prompt yield before advancing the current semantic step.

The public `scoreOneBase()` remains a compatibility wrapper for direct callers and loops over the same explicit step executor. It does not make runtime base-selection or global continuation decisions.

## Follow-Up Architecture Decisions

The decisions below remain the target of later stages. They are not claims about the completed Stage 1-6 implementation.

### Decision 7: The scoring frame becomes the complete settlement authority
The `smashup:score-bases` resolution frame should eventually own the complete rule progression, including locked scoring targets, the current base, completed bases, deferred post-scoring events, initial After Scoring power snapshots, cleanup, replacement, reveal reactions, and completion.

Each future frame step may emit formally reduced domain events, open a child frame and pause, or advance without side effects. Once migrated, continuation should no longer be reconstructed from loose flags.

### Decision 8: Deferred cleanup has one frame-owned emission point
After the follow-up migration, only the scoring frame driver may emit deferred `BASE_CLEARED` / `BASE_REPLACED` events. Interaction handlers and `SmashUpEventSystem.afterEvents()` must not determine whether they are the last continuation point, and the generic InteractionSystem must treat continuation context as opaque data.

### Decision 9: Stable base references remain mandatory across replacement
Long-running scoring state must distinguish the original scoring target, its slot, and the replacement base. Bare `baseIndex` values are insufficient for continuation across `BASE_CLEARED` / `BASE_REPLACED`.

### Decision 10: Authoritative core changes only through formal pipeline reduction
Future decomposition must remove preview core writeback and rollback. `scoreOneBase()`, reaction queues, interaction handlers, and `afterEvents()` may plan events, but must not persist temporary `reduce()` results and later restore or manually merge core fields.

If a step depends on state changed by pending events, the driver must yield and resume after those events are formally reduced. `buildPreviewStateWithPendingDomainEvents()`, `mergePromptResultCoreWithPreEventState()`, and the `preScoreCore` rollback pattern remain migration targets.

### Decision 11: SmashUp reaction state becomes the sole responder authority
For SmashUp Me First and After Scoring windows, one reaction frame/session should eventually own responder order, current responder, passes, action-reset behavior, and closure. Generic `ResponseWindowSystem` state must not mirror or drive the same SmashUp window. Other games may continue using the generic system.

Availability checks and displayed reaction options must share one candidate builder and legality path.

### Decision 12: Clearing reactions originate from actual clearing
Discard and leave-play reactions must be derived after `BASE_CLEARED` formally moves the relevant objects. This preserves the #128 invariant and ensures follow-up effects see updated zones and correct last-known information.

### Decision 13: Pipeline rounds and visual delays are not rule semantics
Technical `_waitFor...Reduce` flags should eventually stop acting as rule continuation conditions. Reveal animation delay should move to the client event-presentation layer so refresh, reconnect, and AI recovery do not depend on wall-clock deadlines to advance game rules.

## Risks / Trade-offs
- Introducing `ruleStep` while old wait flags remain creates temporary duplication. The mitigation is to keep old `currentStep`/wait values compatibility-only, not independent authorities.
- If local executors read `ScoringSession`, the refactor only hides global control behind a new API. Explicit executor inputs and focused tests enforce the intended dependency direction.
- Shadow reduce and core rollback remain in Stage 1-6, so the completed work improves ownership without yet simplifying event reduction.
- The follow-up architecture has a larger behavioral blast radius and requires transaction-level and real-entry validation before compatibility paths can be removed.

## Migration Plan

### Completed Stage 1-6 baseline
1. Establish the #128 cleanup-ordering invariant before semantic-session production changes.
2. Add semantic `ruleStep` and blocker/wait representation to existing scoring-session frame metadata, with compatibility mapping for `currentStep`.
3. Move global progression into `driveScoreBasesSession()`.
4. Decompose the four executable scoring rule steps behind explicit executor input and driver-owned progression.
5. Preserve existing flags, marker arrays, deferred finalization, and shadow reduce while adding tests around interaction/response suspension and exactly-once advancement/finalization.

### Follow-up migration
1. Add transaction-level characterization for formally reduced events, actual-clear reactions, and shared reaction-option construction.
2. Expand the scoring frame through cleanup, replacement, reveal reactions, and completion.
3. Remove continuation ownership from interaction handlers, EventSystem recovery, and generic InteractionSystem payload handling.
4. Make the SmashUp reaction frame the only responder authority and remove mirrored generic response-window progression.
5. Remove shadow reduce/core restore, technical pipeline-round flags, and rule-layer visual delay only after the replacement flow is proven.
6. Validate progressively from single-base through multi-base, chained After Scoring, rescoring, and First Mate/discard-zone behavior.

## Open Questions
- When should marker arrays that remain as replay protection be removed?
- What dedicated migration can remove shadow reduce/core rollback without changing outer pipeline event ordering?
- Should pending post-scoring actions move fully into scoring-frame metadata?
- Which domain events should anchor the client-only reveal animation lifecycle?
