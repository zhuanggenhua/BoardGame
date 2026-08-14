# Change: 收敛 SmashUp 计分结算链并稳定多重 afterScoring 场景

## Why
Phase 1 audit confirmed that SmashUp already has partial `ScoringSession`, stable base refs, and resolution-frame deferred payload infrastructure. However, `scoreBases` progression is still split across `onPhaseEnter/onPhaseExit('scoreBases')`, `onAutoContinueCheck()`, `scoreOneBase()`, the `multi_base_scoring` prompt handler, `SmashUpEventSystem.afterEvents()`, `ReactionSession`, `ResponseWindowSystem`, and compatibility flags such as `flowHalted`, `_waitForScoreBasesInteractionReduce`, and `_waitForPostScoringReduce`.

This change remains deliberately narrower than the original broad refactor: it represents the current SmashUp scoring rule step authoritatively in the existing `ScoringSession` / resolution frame, while preserving existing continuation mechanisms as compatibility paths.

Phase 1 also confirmed the #128 cleanup/discard-trigger timing bug. Its ordering fix was rebased and established first, before the semantic scoring-session stages were applied in this cumulative branch.

## What Changes
- Clarify `ScoringSession` as the global `scoreBases` progression owner: current base, semantic rule step, blocker/suspension reason, current-base completion, and transition to the next base.
- Distinguish semantic rule progression from temporary blockers/waits. A blocker can pause the current rule step, but it must not become a second authoritative state machine.
- Keep `scoreOneBase()` / future local step executors from reading global `ScoringSession` to decide what to do. The scoring driver reads session state and passes explicit inputs to the executor.
- Preserve existing compatibility flags and shadow-reduce behavior during this PR; do not delete them merely because the new semantic representation exists.
- Keep deferred `BASE_CLEARED / BASE_REPLACED` finalization substantially centralized in the Flow / `finalizeCurrentScoringBase()` path, and add tests that finalization still happens exactly once.
- Execute `before-scoring`, `when-scoring`, `award-vp`, and `after-scoring` through an explicit single-step executor; the driver loops synchronously only while no child blocker or pipeline boundary exists.
- Add behavior tests proving interaction/response-window suspension does not restart scoring, rule-step advancement is single-owner, VP is not repeated, and finalization is not repeated.

## Impact
- Affected specs:
  - `smashup-scoring-session`
- Affected code:
  - `src/games/smashup/domain/scoringSession.ts`
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/domain/systems.ts`
  - SmashUp 相关 scoring / afterScoring 测试与 E2E 证据文件
- Explicitly out of scope for this PR:
  - Generic engine rewrites, including `InteractionSystem`, `ResponseWindowSystem`, and resolution-stack redesign.
  - Further cleanup of the already-established #128 ordering fix.
  - Decomposition of `finalize-base` / `complete-base`, shadow-reduce removal, or unrelated ability rewrites.
