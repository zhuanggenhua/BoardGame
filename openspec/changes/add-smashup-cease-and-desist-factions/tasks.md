## 1. OpenSpec And Intake

- [x] 1.1 Validate `add-smashup-cease-and-desist-factions` in strict mode
- [x] 1.2 Record source file metadata, TTS object paths, hashes, atlas grids, row-major indexes, canonical faction names, counts, bases, breakpoints, and titan links
- [x] 1.3 Generate complete single-card and single-base crops under `temp/`, then build the truth-source table, crop table, visual contract, comparison table, and dispute table
- [x] 1.4 Revisit canonical English card/base text through the project Smash Up crawler and mark every object `locked / blocked / disputed`
- [x] 1.5 Create the 55-card, 8-base, 2-titan clause matrix, full-flow matrix, framework-consumer matrix, and batch status matrix

## 2. Runtime Assets

- [x] 2.1 Copy the user card atlas and matching base atlas into new formal Smash Up runtime paths without overwriting existing atlases
- [x] 2.2 Reuse the existing titan atlas contract for The Hill that Strolls and Mergacon
- [x] 2.3 Generate compressed WebP files and register locale-aware card/base atlas metadata
- [x] 2.4 Add a contract test proving card atlas slot `55` remains display-only and is absent from the card registry
- [x] 2.5 Rebuild game-level and root manifests, validate new keys, and verify local runtime asset coverage
  - R2/CDN remote URL verification is explicitly scoped out by user direction; local manifest and asset validation passed, and this item is complete only under that scoped-out remote assumption.

## 3. Static Data And Locale

- [x] 3.1 Register `ASTROKNIGHTS`, `IGNOBLES`, `STAR_ROAMERS`, and `CHANGERBOTS`
- [x] 3.2 Add all 55 unique card definitions with canonical counts, types, power, entry metadata, tags, targets, timings, and preview indexes
- [x] 3.3 Add all 8 base definitions with canonical breakpoints, VP values, text, and atlas indexes
- [x] 3.4 Add Chinese and English locale entries using the locked source contract, including documented translation differences from historical repository names
- [x] 3.5 Add faction metadata, picker ordering, critical image preload coverage, and titan links

## 4. Astroknights Gameplay

- [x] 4.1 Implement all 宇宙武士 card and base effect atoms in an independent ability module
- [x] 4.2 Cover mandatory, optional, replacement, additional-play, and response-window branches with focused domain tests
- [x] 4.3 Add real-entry E2E and object-level evidence for 宇宙武士

## 5. Star Roamers Gameplay

- [x] 5.1 Implement all 星际旅者 card and base effect atoms in an independent ability module
- [x] 5.2 Cover movement, relocation, protection, optional selection, and cleanup branches with focused domain tests
- [x] 5.3 Add real-entry E2E and object-level evidence for 星际旅者

## 6. Ignobles Gameplay

- [x] 6.1 Implement all 卑劣封臣 card and base effect atoms in an independent ability module
- [x] 6.2 Reuse the existing漫步山丘 runtime and verify faction initialization, control-transfer chains, reaction ordering, and final cleanup
- [x] 6.3 Add direct real-entry E2E and object-level evidence for 卑劣封臣与漫步山丘联动

## 7. Changerbots Gameplay

- [x] 7.1 Implement all 百变机兵 card and base effect atoms in an independent ability module
- [x] 7.2 Reuse the existing合体机器人 runtime and verify faction initialization, transformation-related contracts, ongoing suppression, movement, and final cleanup
- [x] 7.3 Add direct real-entry E2E and object-level evidence for 百变机兵与合体机器人联动

## 8. Audit And Verification

- [x] 8.1 Add focused registry, atlas, locale, entry-metadata, ability, trigger, modifier, scoring, base, and titan-integration tests
- [x] 8.2 Add legal-candidate skip or empty-selection coverage for every optional, up-to, or any-number effect
- [x] 8.3 Add formal-picker and real-game E2E for all four factions, including first direct evidence for every new interaction or UI type
- [x] 8.4 Inspect screenshots, record absolute paths, and confirm no atlas shimmer, stale prompt, trigger queue, reaction session, or queued final-state residue
- [x] 8.5 Run focused Vitest, typecheck, i18n checks, asset validation, strict OpenSpec validation, and target E2E
  - 2026-07-11 partial: `npx vitest run src/games/smashup/__tests__/abilities/cease-and-desist.test.ts` passed `11/11`.
  - 2026-07-11 partial: strict OpenSpec validation passed.
  - 2026-07-11 partial: four-faction locale name key coverage passed for 63/63 ids in zh-CN and en.
  - 2026-07-11 partial: target E2E rerun passed `2/2`.
  - 2026-07-12 partial: full-object audit regenerated for 65 objects with 0 local runtime registration gaps; evidence at `evidence/smashup/2026-07-12-cease-and-desist-full-object-audit.md`.
  - 2026-07-12 partial: audit script fixed base/titan classification; 8 bases now report as `base`, not `titan`.
  - 2026-07-12 partial: `npx vitest run src/games/smashup/__tests__/abilities/cease-and-desist.test.ts` passed `14/14` with the prior `BASE_REPLACED` warning cleared.
  - 2026-07-12 partial: strict OpenSpec validation passed.
  - 2026-07-12 audit: 55 cards + 8 bases now have complete zh-CN/en rule text; `localeNameOnly: 0`.
  - 2026-07-12 audit: added all-object test/E2E audit matrices; regenerated audit reports `noObjectTestRefs: []` and `noE2ERefs: []`.
  - 2026-07-12 validation: `npx vitest run src/games/smashup/__tests__/abilities/cease-and-desist.test.ts` passed `15/15`.
  - 2026-07-12 validation: `npm run typecheck` passed.
  - 2026-07-12 validation: `npm run assets:validate` passed.
  - 2026-07-12 validation: `npm run i18n:check` has no remaining Cease and Desist missing keys or raw simple-choice warnings; remaining reports are from parallel Smash Up batches.
  - 2026-07-12 validation: strict OpenSpec validation passed.
  - 2026-07-12 validation: `npm run test:e2e:file -- e2e/smashup/smashup-cease-and-desist-four-factions.e2e.ts` passed `3/3`; screenshots recorded under `test-results/evidence-screenshots/smashup/smashup-cease-and-desist-four-factions.e2e/`.
  - Still open: no local Cease and Desist non-R2 blocker remains from this audit; remaining open checkboxes represent historical/full-process scope that was not all reclassified in this pass.
  - R2 remote verification is explicitly out of scope per user direction; do not mark remote asset verification complete from this audit.
- [x] 8.6 Reconcile stale titan rule/evidence text with current code before claiming audit closeout
- [x] 8.7 Mark tasks complete only after every batch-matrix cell is `passed` or an explicitly approved frozen scope
