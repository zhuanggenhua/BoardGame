## 1. Intake And Contract

- [x] 1.1 Lock user-provided source dimensions, hashes, object ownership and `8x2` slot mapping.
- [x] 1.2 Record the summoner, starting setup, card fields, rules text and empty slots.
- [x] 1.3 Record the visual contract and excluded mixed-in source images in evidence.

## 2. Static Runtime

- [x] 2.1 Add `shadow` faction ID, symbols, catalog entry, deck factory, card registry and faction-name mapping.
- [x] 2.2 Add independent Shadow atlas configuration, sprite registration and critical image resolver coverage.
- [x] 2.3 Add zh-CN/en faction, card and ability text.
- [x] 2.4 Add the shadow deck to all required configuration/adapters without changing other factions' contracts.

## 3. Domain Mechanics

- [x] 3.1 Register all 13 shadow abilities with explicit trigger/condition/effect or an explicit blocked contract.
- [x] 3.2 Implement summon/move/attack/death/phase-triggered effects supported by existing domain events and executors.
- [x] 3.3 Implement shadow event cards, including optional targets, discard retrieval, continuous replacement and final cleanup.
- [x] 3.4 Add negative/skip/once-per-turn tests for every optional or limited rule clause that is implemented.

## 4. Resources

- [x] 4.1 Verify non-downsampled runtime WebP output and source/produced dimensions.
- [x] 4.2 Rebuild game-level and root i18n asset manifests and assert the new keys.
- [x] 4.3 Run the single-faction asset precheck, upload and representative URL `HEAD` checks when the configured server route is reachable.

## 5. Verification And Closeout

- [x] 5.1 Add static registration, deck composition, atlas, preload, i18n and card-pool tests.
- [x] 5.2 Add L2 tests for each implemented rule clause and document blocked clauses.
- [x] 5.3 Add real-entry E2E for selection/setup and all introduced interaction families. Eleven scenes pass with 36 screenshots covering selection/setup, multi-target events, move-after abilities, summon-after abilities, active ability plus continuous replacement, event target/discard retrieval, charge-on-damage/departure, phase-end branches, attack-after push/pull, death triggers and through-unit attacks; all 13 abilities and 4 event cards have browser-level L3/L4 evidence.
- [x] 5.4 Update object-level evidence with L0-L4 status, D dimensions, consumer contracts, screenshots and residual risks.
- [x] 5.5 Run targeted Summoner Wars validation and report the exact completion level; targeted tests, typecheck, product lint, eleven real-entry E2E scenes, strict OpenSpec validation and the completion guard are green. The change closes at static/L2 plus browser-level L3/L4 evidence for all 13 abilities and 4 event cards; the faction catalog intentionally remains `under_construction`.
