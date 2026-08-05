## 0. Approval And Scope

- [x] 0.1 Obtain explicit approval to implement `add-smashup-disney-aladdin-beauty-nightmare-ralph`
- [x] 0.2 Move implementation target to a clean branch/worktree separate from the dirty POD worktree
- [x] 0.3 Confirm release target: local closeout / author handoff; actual push or PR remains separate user approval

## 1. Intake Contract

- [x] 1.1 Record source image path, dimensions, file size, SHA-256, capture time, and field ownership in evidence
- [x] 1.2 Generate low-resolution overview plus complete single-card crops under `temp/smashup-disney-aladdin-beauty-nightmare-ralph-intake/`
- [x] 1.3 Lock exact grid, row-major indexes, four faction boundaries, and any tail/display-only slots
- [x] 1.4 Build truth-source table, crop table, visual contract table, comparison table, and dispute table
- [x] 1.5 Transcribe each card from complete single-card crops into rule text, atomized clauses, structured fields, and `locked / blocked / disputed` status
- [x] 1.6 Lock corresponding base atlas/base text/breakpoint/VP information from source-backed evidence, or mark specific base fields `blocked`
- [x] 1.7 Produce the implementation handoff package and batch matrix

## 2. Static Registry And Assets

- [x] 2.1 Copy approved runtime atlas assets into formal Smash Up asset paths without overwriting existing atlases
- [x] 2.2 Generate compressed WebP assets and confirm runtime dimensions are not downsampled
- [x] 2.3 Register Disney card/base atlas metadata in `atlasCatalog`
- [x] 2.4 Register faction IDs, card/base IDs, faction data files, and `cards.ts` imports
- [x] 2.5 Add `zh-CN` and `en` locale entries with source-backed names/effects
- [x] 2.6 Add faction metadata and critical image preload coverage
- [x] 2.7 Rebuild game-level and root manifests, then add static registry/resource tests

## 3. 阿拉丁

- [x] 3.1 Implement all locked 阿拉丁 card/base effect atoms using existing shared mechanisms where possible
- [x] 3.2 Add focused L2 behavior tests for search, discard-action costs, extra actions, movement, power counters, one-use Wish effects, and before-scoring special clauses as applicable
- [x] 3.3 Add real-entry L3/L4 E2E and object-level evidence, including skip/empty-selection coverage for optional clauses

## 4. 美女与野兽

- [x] 4.1 Implement all locked 美女与野兽 card/base effect atoms using existing shared mechanisms where possible
- [x] 4.2 Add focused L2 behavior tests for extra actions, extra characters, draws, power counters, deck/discard search, ongoing/base-modifier clauses, and villain interaction clauses as applicable
- [x] 4.3 Add real-entry L3/L4 E2E and object-level evidence, including skip/empty-selection coverage for optional clauses

## 5. 圣诞夜惊魂

- [x] 5.1 Implement all locked 圣诞夜惊魂 card/base effect atoms using existing shared mechanisms where possible
- [x] 5.2 Add focused L2 behavior tests for character equipment, movement, draw/discard, power gain, deck reveal, base scoring, and per-turn equipment clauses as applicable
- [x] 5.3 Add real-entry L3/L4 E2E and object-level evidence, including skip/empty-selection coverage for optional clauses

## 6. 无敌破坏王

- [x] 6.1 Implement all locked 无敌破坏王 card/base effect atoms using existing shared mechanisms where possible
- [x] 6.2 Add focused L2 behavior tests for base modifiers, character modifiers, power counters, movement, destruction/replacement, stasis/box-style handling if applicable, and base-breakpoint reduction as applicable
- [x] 6.3 Add real-entry L3/L4 E2E and object-level evidence, including skip/empty-selection coverage for optional clauses

## 7. Audit And Closeout

- [x] 7.1 Run strict OpenSpec validation
- [x] 7.2 Run focused Vitest, ESLint on changed TS/TSX files, typecheck, i18n check, and asset validation
- [x] 7.3 Run target Smash Up E2E and inspect at least one screenshot per new interaction/UI type
- [x] 7.4 Upload runtime resources to the server asset source and verify representative public URLs with `HEAD 200`
- [x] 7.5 Write final full-object audit evidence with L0/L1/L2/L3/L4 matrix and residual-risk statement
  - 2026-08-05 closeout evidence records Vitest / ESLint / typecheck / i18n / assets / OpenSpec / E2E results and public resource `HEAD 200`.
- [x] 7.6 Update every task checkbox only after evidence supports the status
- [x] 7.7 Prepare push/PR handoff with a Chinese, information-dense commit message covering all four factions
