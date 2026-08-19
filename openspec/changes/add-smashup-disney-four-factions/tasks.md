## 0. Approval And Scope

- [x] 0.1 Obtain explicit approval to implement `add-smashup-disney-four-factions`
- [x] 0.2 Decide whether implementation stays in the current dirty worktree or moves to a user-approved clean branch/worktree
- [x] 0.3 Confirm release target: push-ready local branch / author handoff; actual push or PR remains separate user approval

## 1. Intake Contract

- [x] 1.1 Record source image path, dimensions, file size, SHA-256, capture time, and field ownership
- [x] 1.2 Generate low-resolution overview plus complete single-card crops under `temp/smashup-disney-four-factions-intake/`
- [x] 1.3 Lock exact grid, row-major indexes, four faction boundaries, and any tail/display-only slots
- [x] 1.4 Build truth-source table, crop table, visual contract table, comparison table, and dispute table
- [x] 1.5 Transcribe each card from complete single-card crops into rule text, atomized clauses, structured fields, and `locked / blocked / disputed` status
- [x] 1.6 Locate or mark blocked the corresponding base atlas/base text/breakpoint information
- [x] 1.7 Produce the implementation handoff package and batch matrix

## 2. Static Registry And Assets

- [x] 2.1 Copy approved runtime atlas assets into formal Smash Up asset paths without overwriting existing atlases
- [x] 2.2 Generate compressed WebP assets and confirm runtime dimensions are not downsampled
- [x] 2.3 Register Disney card/base atlas metadata in `atlasCatalog`
- [x] 2.4 Register faction IDs, card/base IDs, faction data files, and `cards.ts` imports
- [x] 2.5 Add `zh-CN` and `en` locale entries with source-backed names/effects
- [x] 2.6 Add faction metadata and critical image preload coverage
- [x] 2.7 Rebuild game-level and root manifests, then add static registry/resource tests

## 3. 超能陆战队 / Big Hero 6

- [x] 3.1 Implement all locked 超能陆战队 card/base effect atoms using existing shared mechanisms where possible
- [x] 3.2 Add focused L2 behavior tests for mandatory, optional, movement, power-marker, extra-play, and control-style clauses as applicable
- [x] 3.3 Add real-entry L3/L4 E2E and object-level evidence, including skip/empty-selection coverage for optional clauses

## 4. 冰雪奇缘 / Frozen

- [ ] 4.1 Implement all locked 冰雪奇缘 card/base effect atoms using existing shared mechanisms where possible（2026-08-19 回写：旧完成勾选被本地反馈推翻，当前保持实施中）
- [ ] 4.2 Add focused L2 behavior tests for movement, deck discard, hand/deck return, base lock, and scoring-related clauses as applicable（2026-08-19 回写：仍有 9 个冰雪对象缺对象级验证）
- [ ] 4.3 Add real-entry L3/L4 E2E and object-level evidence, including skip/empty-selection coverage for optional clauses（2026-08-19 回写：冰雪真实入口仍只有代表链 / 局部证据）

## 5. 狮子王 / The Lion King

- [x] 5.1 Implement all locked 狮子王 card/base effect atoms using existing shared mechanisms where possible
- [x] 5.2 Add focused L2 behavior tests for discard search, power gain, destruction, draw, extra-play, and deck-reorder clauses as applicable
- [x] 5.3 Add real-entry L3/L4 E2E and object-level evidence, including skip/empty-selection coverage for optional clauses

## 6. 花木兰 / Mulan

- [x] 6.1 Implement all locked 花木兰 card/base effect atoms using existing shared mechanisms where possible
- [x] 6.2 Add focused L2 behavior tests for power counters, extra play, draw, destruction, deck discard, and per-turn clauses as applicable
- [x] 6.3 Add real-entry L3/L4 E2E and object-level evidence, including skip/empty-selection coverage for optional clauses

## 7. Audit And Closeout

- [x] 7.1 Run strict OpenSpec validation
- [x] 7.2 Run focused Vitest, typecheck, i18n check, and targeted Smash Up asset validation
- [x] 7.3 Run target Smash Up E2E and inspect at least one screenshot per new interaction/UI type
- [ ] 7.4 Upload the mainline runtime resources to the server asset source and verify representative public URLs match current local bytes/hash
- [ ] 7.5 Write final full-object audit evidence with L0/L1/L2/L3/L4 matrix and residual-risk statement（2026-08-19 回写：旧 full-object / closeout 口径对冰雪不成立）
- [ ] 7.6 Update every task checkbox only after evidence supports the status（2026-08-19 回写：冰雪完成勾选已撤回）
- [ ] 7.7 Prepare push/PR handoff with a Chinese, information-dense commit message covering all four factions（2026-08-19 回写：四派系整体 handoff 需等冰雪重新收口）
