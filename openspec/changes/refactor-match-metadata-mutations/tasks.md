## 1. Specification
- [x] 1.1 Confirm whether the storage seam should be generic or targeted.
- [x] 1.2 Identify high-risk metadata writers and mark which ones migrate in phase 1.

## 2. Implementation
- [x] 2.1 Add a match metadata mutation seam to `MatchStorage` and all storage adapters.
- [x] 2.2 Implement Mongo atomic updates for seat credential/name mutation.
- [x] 2.3 Implement per-match serialization for in-memory metadata mutation.
- [x] 2.4 Migrate `claim-seat` to the new seam.
- [x] 2.5 Refresh or merge active transport metadata after mutation where required.
- [x] 2.6 Audit connection status, disconnect marker, and gameover writers; migrate phase-1 writers only.

## 3. Verification
- [x] 3.1 Add a concurrent multi-seat `claim-seat` regression test that fails on full metadata replacement.
- [x] 3.2 Add storage-level tests for Mongo/memory mutation semantics.
- [x] 3.3 Re-run the 4-player 3-AI manual faction E2E.
- [x] 3.4 Run typecheck and the focused server/lobby tests.
