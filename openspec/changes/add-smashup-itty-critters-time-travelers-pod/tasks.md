## 1. OpenSpec And Intake Contract

- [x] 1.1 Validate `add-smashup-itty-critters-time-travelers-pod` with strict OpenSpec validation
- [x] 1.2 Create the source, crop/index, visual contract, comparison, conflict, and implementation-handoff tables for both POD factions
- [x] 1.3 Lock both `1876 x 2100`, `4 x 5` row-major atlas mappings down to each physical card slot and unique runtime object
- [x] 1.4 Record both source paths, sizes, hashes, acquisition time, runtime destinations, compressed artifacts, and planned remote URLs in evidence

## 2. Runtime Assets

- [x] 2.1 Copy the two user-supplied source atlases into faction-specific formal runtime paths without replacing existing shared atlases
- [x] 2.2 Generate compressed WebP assets and register two unique `4 x 5` card atlas IDs
- [x] 2.3 Add both POD atlases to Smash Up critical/warm preload resolution and verify locale-aware asset paths
- [ ] 2.4 Rebuild the Smash Up and root i18n manifests, validate the new keys, upload only the new runtime assets, and verify representative remote URLs with `HEAD 200`
  - Blocked on `2026-07-10`: both manifests and local validation pass. The official uploader now supports `--only` and its selection contract passes, but the actual two-WebP upload returns `Unauthorized` with exit code `1`; both runtime URLs remain `404`.
  - Rechecked on `2026-07-11`: the current worktree still has no `.env` and no R2 credential environment variables; both local WebP files are present (`621570` / `740164` bytes), but the official URLs still do not provide `HEAD 200` (`curl -I` resets the connection). Task 2.4 remains blocked until valid R2 credentials are available.

## 3. POD Faction Registry And Data

- [x] 3.1 Add `ITTY_CRITTERS_POD` and `TIME_TRAVELERS_POD` faction IDs, display names, metadata, and locale visibility
- [x] 3.2 Add explicit `itty_critters_pod.ts` and `time_travelers_pod.ts` definitions with complete fields, `_pod` card IDs, counts, tags, targets, timings, and POD atlas preview indexes
- [x] 3.3 Register both POD card sets without mutating the existing base-faction definitions or shared atlas contracts
- [x] 3.4 Register POD base IDs for both factions; preserve base rules and reuse current base artwork because no POD base artwork was supplied
- [x] 3.5 Add explicit locale entries for both POD factions, cards, and bases while preserving the current base-faction locale entries

## 4. Shared Gameplay And Variant Binding

- [x] 4.1 Prove card-by-card that the supplied POD rules match the locked base-faction contract; mark any discovered difference as blocked/disputed before implementation
- [x] 4.2 Bind both POD families to the existing ability, interaction, ongoing, modifier, and base-ability surfaces through the explicit variant mechanism available in the implementation tree
- [x] 4.3 Verify that POD registrations do not add duplicate behavior to the base versions and that base IDs never resolve POD-only surfaces
- [x] 4.4 Reuse 彩虹鸟（`itty_critters_rainboroc`）and 时间盒子（`time_travelers_time_box`）through faction fallback without creating duplicate POD titan definitions
- [x] 4.5 Ensure POD faction base pools resolve only `_pod` base IDs while the base factions continue to resolve only base IDs

## 5. Tests, Audit, And E2E

- [x] 5.1 Add atlas/index, registry, locale, faction-selection, preload, manifest, base-pool, titan-fallback, and POD consistency tests
- [x] 5.2 Extend the existing迷你萌宠 and 时间旅行者 ability suites so representative POD IDs prove shared behavior, optional skip paths, cleanup, and final authoritative state
- [x] 5.3 Create object-level rule-clause and complete-skill-flow matrices for every POD card, base, and reused titan, including L0-L4 status and shared-chain equivalence evidence
- [x] 5.4 Add real-entry E2E coverage for selecting each POD faction, initializing a match, rendering the correct POD atlas, and completing representative real gameplay chains without pre-opened prompts
- [x] 5.5 Capture and inspect real-page screenshots, record absolute paths and `.atlas-shimmer` results, and distinguish task failures from historical baseline debt
- [x] 5.6 Run focused Vitest, i18n, typecheck, asset validation, strict OpenSpec validation, and the new E2E cases; update all task boxes only after the evidence is complete
