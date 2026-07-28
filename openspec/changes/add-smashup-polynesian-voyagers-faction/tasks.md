## 1. Intake And Source Contract

- [x] 1.1 Copy the supplied 3-row x 4-column card atlas into the formal Smash Up card atlas source path only after approval.
- [x] 1.2 Generate complete single-card crops under `temp/` and record card-slot readability, row-major index, card type, count, power and text.
- [x] 1.3 Write `evidence/smashup/*polynesian-voyagers*` source, crop, card/base contract, comparison and blocker tables.
- [x] 1.4 Lock the shared Culture Shock base atlas slots for Island Chain, Island Peak and Tropical Paradise without duplicate atlas registration.
- [x] 1.5 Decide and document the Chinese faction display name compatibility between `波利尼西亚航海者` and existing `波利尼西亚人`.

## 2. Static Data And Assets

- [x] 2.1 Ensure atlas ids, faction id and atlas catalog entries match the existing `POLYNESIAN_VOYAGERS_*` contracts.
- [x] 2.2 Add `src/games/smashup/data/factions/polynesian_voyagers.ts` with 20-card composition and 3 bases.
- [x] 2.3 Register the faction cards and bases in `src/games/smashup/data/cards.ts`.
- [x] 2.4 Add Simplified Chinese and English locale entries for faction, cards and bases.
- [x] 2.5 Add faction metadata and critical image preload coverage.
- [x] 2.6 Compress runtime images without downsampling and rebuild game-level plus root asset manifests.

## 3. Gameplay Implementation

- [x] 3.1 Implement direct draw, ongoing power modifier and start-turn +1 counter effects.
- [x] 3.2 Implement movement to bases where the player has no minions, including talent and on-play paths.
- [x] 3.3 Implement extra base creation/replacement effects for 毛伊人, 火山爆发 and 岛链.
- [x] 3.4 Implement actions played on minions for 海洋纹身、鲨鱼纹身、太阳纹身 and 纹身艺术家.
- [x] 3.5 Implement 莫艾 movement restrictions for other players moving to its base and moving 莫艾 away.
- [x] 3.6 Implement 太阳纹身 after-scoring special with the "no actions on it" condition and destination choice.
- [x] 3.7 Implement 岛峰 and 热带天堂 base abilities, including start-turn counter and dynamic breakpoint behavior.
- [ ] 3.8 Record any scoped-debt only if the user explicitly approves freezing a gameplay clause.

## 4. Validation And Evidence

- [x] 4.1 Add targeted Vitest suites for static composition, atlas/manifest, i18n, ability registration and key behavior clauses.
- [ ] 4.2 Add or update direct E2E coverage for faction selection, initial game rendering and at least one new movement/tattoo interaction path.
- [ ] 4.3 Verify final authoritative state for movement, counters, extra bases, scoring special and dynamic base breakpoint.
- [x] 4.4 Run targeted Vitest, relevant audit tests, i18n check, typecheck and OpenSpec strict validation.
- [x] 4.5 Write closeout evidence with object-level L0/L1/L2/L3/L4 matrix, screenshots and residual risk statement.

## 5. Upload, Commit And PR

- [x] 5.1 Run resource upload precheck for the new card atlas and the reused base atlas entries.
- [ ] 5.2 Upload runtime WebP resources to the server asset source and verify representative public `HEAD 200` URLs. Blocked: SSH publickey permission denied for `admin@8.148.71.102`; public URL still returns 404.
- [x] 5.3 Review the final diff so unrelated existing worktree changes are not silently bundled unless explicitly approved.
- [x] 5.4 Commit with a Chinese message that names 波利尼西亚航海者 and the atlas/resource work.
- [x] 5.5 Push the branch and open a PR for the author with the atlas included in the PR scope.
