## Context
Match metadata stores authentication and lifecycle fields such as `players[*].credentials`, `players[*].name`, `players[*].isConnected`, `disconnectedSince`, `status`, and `gameover`. The current `MatchStorage` interface only exposes `fetch` and `setMetadata`, so callers must overwrite the whole metadata object even when they only need to update one seat.

## Goals / Non-Goals
- Goal: Provide a deep metadata mutation module whose interface preserves concurrent updates to unrelated metadata fields.
- Goal: Make `claim-seat` safe when several seats are claimed concurrently.
- Goal: Concentrate metadata concurrency rules in storage/server infrastructure instead of frontend call ordering.
- Non-Goal: Change game AI decision timing, faction selection rules, or SmashUp gameplay behavior.
- Non-Goal: Rewrite all metadata writers in one pass; migrate high-risk writers first.

## Decisions
- Decision: Add a storage seam such as `mutateMetadata(matchID, updater)` or targeted helpers such as `claimSeatMetadata(matchID, playerID, patch)`.
- Decision: Mongo implementation MUST use atomic document updates (`$set`, conditional update, or retry-on-conflict), not full metadata replacement for seat credential writes.
- Decision: In-memory implementation MUST serialize metadata mutations per match, because JavaScript object references can otherwise mask lost-update bugs in tests.
- Decision: `claim-seat` MUST own seat credential idempotency on the server. If credentials already exist, it returns the existing credential without overwriting unrelated seat metadata.

## Risks / Trade-offs
- Adding a generic updater can become a shallow pass-through if callers still own all concurrency rules; prefer targeted helpers for high-risk flows when possible.
- Mongo `$set` paths are safer for seat fields but harder for whole-object transformations; leave low-risk full replacements in place until migrated.
- Active transport metadata cache must be refreshed/merged after storage mutations, otherwise socket auth may read stale credentials.

## Migration Plan
1. Add storage mutation seam and tests for Mongo/memory behavior.
2. Migrate `claim-seat` to the new seam and add concurrent multi-seat regression.
3. Re-run manual AI faction E2E to prove the original issue is covered without frontend ordering assumptions.
4. Audit and migrate remaining high-risk metadata writers in priority order.

## Open Questions
- Should the first implementation expose one generic `mutateMetadata` seam, or only targeted operations for `claimSeat`, `setConnected`, and `setGameover`?
- Should optimistic versioning be added to metadata now, or should Mongo atomic operators plus memory mutex be the first step?
