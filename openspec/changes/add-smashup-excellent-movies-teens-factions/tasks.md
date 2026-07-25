## 0. Approval And Coordination

- [x] 0.1 Obtain explicit approval to implement `add-smashup-excellent-movies-teens-factions`.
- [x] 0.2 Confirm whether current unrelated Smash Up POD / Disney untracked work should remain side-by-side or be isolated before implementation.
- [x] 0.3 Keep runtime code, assets and tests untouched until approval; proposal/preflight evidence updates are allowed.

## 1. Intake Contract

- [x] 1.1 Record the supplied image source path, dimensions, hash, acquisition time and covered factions.
- [x] 1.2 Generate low-resolution overview, per-row contact sheets and complete single-card crops under `temp/`.
- [x] 1.3 Lock faction list, canonical English names, provisional Chinese names and unresolved naming conflicts.
- [x] 1.4 Build source contract tables for card text, card counts, power, atlas slot, base data and external comparison sources.
- [x] 1.5 Mark every card/base contract as `locked`, `blocked` or `disputed`; do not enter implementation for unresolved objects.

## 2. Static Registry And Assets

- [ ] 2.1 Add atlas IDs and formal runtime asset paths for the five card atlases and required base atlases.
- [ ] 2.2 Compress runtime images without downsampling, rebuild game-level and root i18n asset manifests.
- [ ] 2.3 Add faction IDs, display names, faction metadata and selection ordering.
- [ ] 2.4 Add complete card/base definitions with counts, types, power, preview refs and entry metadata.
- [ ] 2.5 Add Simplified Chinese and English locale keys for factions, cards, bases and required prompts.

## 3. Gameplay Implementation

- [ ] 3.1 Implement 动作英雄 core chains and solo/last-stand style effects with L2 tests.
- [ ] 3.2 Implement 返时者 stasis lifecycle, stasis entry/exit effects and representative L3/L4 flow.
- [ ] 3.3 Implement 异形变体 deck-top/reveal/use-from-deck effects and interaction cleanup.
- [ ] 3.4 Implement 青少年 power-3 / group synergy effects and skip/optional branches where applicable.
- [ ] 3.5 Implement 怨灵捕手 Wraith action model, related trigger windows and representative action-resolution UI.

## 4. Verification And Closeout

- [ ] 4.1 Add targeted Vitest suites for registry, i18n, card entry metadata and each faction's key gameplay atoms.
- [ ] 4.2 Add or extend real-entry E2E covering faction selection, card/base image visibility and at least one direct L3/L4 chain per new interaction family.
- [ ] 4.3 Write evidence with object-level L0/L1/L2/L3/L4 matrix, source contract, implementation handoff and residual risks.
- [ ] 4.4 Run targeted Vitest, i18n check, typecheck, asset validation and `openspec validate add-smashup-excellent-movies-teens-factions --strict --no-interactive`.
- [ ] 4.5 Publish new Smash Up runtime WebP assets to the server asset source and verify representative public `HEAD 200`.
