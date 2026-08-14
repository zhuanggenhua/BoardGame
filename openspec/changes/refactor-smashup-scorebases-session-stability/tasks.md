## 0. Phase 1 Audit / Characterization Baseline
- [x] 0.1 Re-audit latest `upstream/main` instead of relying on stale OpenSpec checkboxes.
- [x] 0.2 Confirm existing `ScoringSession`, stable base refs, and resolution-frame deferred payload infrastructure are already partially implemented.
- [x] 0.3 Add/confirm behavior contract tests without production code changes.
- [x] 0.4 Record validation honestly: focused scoring suite passed; `test:changed` and `test:smashup` timed out and must remain TIMEOUT, not PASS.

## 1. Ordering Gate
- [x] 1.1 Keep the Phase 1 characterization contracts intact while production stages are applied.
- [x] 1.2 Establish the upstream #128 cleanup-ordering fix before building the semantic scoring-session refactor.
- [x] 1.3 Preserve the #128 ordering invariant through the later semantic decomposition.

## 2. Narrow Stage 1-5 Implementation
- [x] 2.1 Define a semantic scoring rule-step representation in existing `ScoringSession` / scoring resolution-frame metadata.
- [x] 2.2 Represent blocker/wait information separately from semantic rule progression; treat legacy `currentStep` as compatibility/derived state if it remains.
- [x] 2.3 Map existing `currentStep` values into semantic progression, blocker/wait information, or compatibility-only information before changing driver behavior.
- [x] 2.4 Update the scoring driver (`onPhaseEnter/onPhaseExit/onAutoContinueCheck` and nearby session helpers as needed) so only the driver advances semantic rule steps.
- [x] 2.5 Keep `scoreOneBase()` / local step executors explicit-input driven; they do not read global `ScoringSession` to discover the current rule step or global continuation.
- [x] 2.6 Preserve `finalizeCurrentScoringBase()` / Flow as the main deferred clear/replace finalization owner and keep exactly-once consume/emit behavior.
- [x] 2.7 Preserve compatibility flags (`flowHalted`, `_waitForScoreBasesInteractionReduce`, `_waitForPostScoringReduce`, triggered-base arrays, reaction/session and response-window state) during this stage.
- [x] 2.8 Do not rewrite `ResponseWindowSystem`, merge `ReactionSession` with response windows, remove shadow reduce/core rollback, decompose finalize/complete, or refactor unrelated abilities.

## 3. Stage 6 Semantic Step Decomposition
- [x] 3.1 Execute exactly one explicit `before-scoring`, `when-scoring`, `award-vp`, or `after-scoring` step per executor call.
- [x] 3.2 Let the driver synchronously continue across unblocked steps while preserving one event batch and one final preview-core rollback.
- [x] 3.3 Yield to the outer pipeline when a queued Before Scoring base trigger must materialize a child prompt; do not advance `ruleStep` before that child completes.
- [x] 3.4 Keep public `scoreOneBase()` behavior-compatible through a bounded compatibility loop over the same step executor.

## 4. Stage 1-6 Validation
- [x] 4.1 Add tests proving interaction suspension clears blocker/wait state without restarting the current semantic rule step.
- [x] 4.2 Add tests proving response-window suspension clears blocker/wait state without restarting the current semantic rule step.
- [x] 4.3 Add tests proving semantic rule-step advancement happens once through the scoring driver.
- [x] 4.4 Re-run existing contracts for VP not repeated, deferred finalization not repeated, multi-base continuation, and stable base identity.
- [x] 4.5 Run focused modified tests first, then scoring-related SmashUp Vitest files.
- [x] 4.6 Run broader changed/SmashUp suites; record TIMEOUT as TIMEOUT, never PASS.
- [x] 4.7 Run `npm run typecheck`, ESLint for changed files, `git diff --check`, and `openspec validate refactor-smashup-scorebases-session-stability --strict --no-interactive`.

Validation record (2026-08-14):
- Focused scoring matrix: 9 files / 188 tests passed.
- `npm run test:smashup`: TIMEOUT at 5 minutes; not recorded as PASS.
- `npm run test:changed`: TIMEOUT at 5 minutes; not recorded as PASS.
- `npm run typecheck`, focused Stage 6 ESLint, `git diff --check`, and strict OpenSpec validation passed.
- ESLint across all cumulatively changed TypeScript files reported 0 errors and 22 pre-existing warnings in `reduce.ts`, `systems.ts`, and `types.ts`; the Stage 6 files reported 0 warnings.

## 5. Follow-Up Transaction Characterization
- [ ] 5.1 Add transaction-level tests for monotonic full-frame progression, exactly-once formal event reduction, and suspension represented only by child frame/blocker state.
- [ ] 5.2 Cover `BASE_CLEARED`-originated discard reactions: a moved First Mate has no discard trigger, while actually cleared cards and follow-up draw/shuffle observe the updated discard zone.
- [ ] 5.3 Use one candidate builder for both reaction availability and actual options across Me First, After Scoring, and base restrictions.

## 6. Follow-Up Complete Scoring Authority
- [ ] 6.1 Expand the `smashup:score-bases` frame to own cleanup, replacement, reveal reactions, deferred actions, and completion in addition to the Stage 1-6 semantic steps.
- [ ] 6.2 Advance only from formally reduced frame state instead of reconstructing continuation from `flowHalted`, marker arrays, power snapshots, and technical wait flags.
- [ ] 6.3 Turn `scoreOneBase()` into an event-planning step with no authoritative preview-core writeback or `preScoreCore` rollback.
- [ ] 6.4 Remove SmashUp-specific deferred propagation/emission ownership from `InteractionSystem.resolveInteraction()`, individual handlers, and `SmashUpEventSystem.afterEvents()`.
- [ ] 6.5 Migrate After Scoring handlers, including First Mate, Pirate Cove, Tortuga, Temple of Goju, Mothership, and Scout chains, to emit only their local business outcomes.

## 7. Follow-Up Reaction And Presentation Cleanup
- [ ] 7.1 Make the SmashUp reaction frame/session the sole responder authority and remove mirrored `ResponseWindowSystem` progression and pass bridging.
- [ ] 7.2 Delete `buildPreviewStateWithPendingDomainEvents()`, `mergePromptResultCoreWithPreEventState()`, and other shadow-reduce/core-merge paths after the replacement flow is proven.
- [ ] 7.3 Remove `_waitForPostScoringReduce`, `_waitForScoreBasesInteractionReduce`, and `_waitForStartTurnInteractionReduce` from rule continuation.
- [ ] 7.4 Move post-scoring reveal delay to the client event-presentation layer so domain recovery no longer reads a visual deadline.

## 8. Follow-Up Validation
- [ ] 8.1 Run transaction regressions covering `scoreBases-mefirst-window`, `base-tortuga-recovery`, deferred finalization, multi-base recovery, After Scoring rescoring, and Before Scoring prompt recovery.
- [ ] 8.2 Cover single-base, multi-base, base/minion triggers, After Scoring rescoring, and exactly-once clear/replacement combinations.
- [ ] 8.3 Run representative real-entry E2E and record evidence for multi-base + After Scoring + First Mate behavior.
- [ ] 8.4 Run changed-file ESLint, typecheck, focused tests, and strict OpenSpec validation for each follow-up stage.
