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

- [x] 2.1 Add atlas IDs and formal runtime asset paths for the five card atlases and required base atlases. Card atlas and runtime base atlas paths are wired. Note: the base atlas uses photo sources; 8 Excellent Movies Dudes bases are lower-resolution web photos and can be replaced later with higher-quality scans.
- [x] 2.2 Compress runtime images without downsampling, rebuild game-level and root i18n asset manifests. Local card/base PNG+WebP assets exist; root i18n and `zh-CN/smashup` manifests are rebuilt and `npm run assets:validate` passes. Server publication remains tracked separately in 4.5.
- [x] 2.3 Add faction IDs, display names, faction metadata and selection ordering.
- [x] 2.4 Add complete card/base definitions with counts, types, power, preview refs and entry metadata. Cards and bases are defined; all 10 bases now use `SMASHUP_ATLAS_IDS.EXCELLENT_MOVIES_TEENS_BASES` with slots 0-9.
- [x] 2.5 Add Simplified Chinese and English locale keys for factions, cards, bases and required prompts. Note: five-faction keys are complete; remaining `i18n:check` failures are unrelated Goblins / Round Table Knights debt.

## 3. Gameplay Implementation

- [x] 3.1 Implement 动作英雄 core chains and solo/last-stand style effects with L2 tests.
- [x] 3.2 Implement 返时者 stasis lifecycle, stasis entry/exit effects and representative L3/L4 flow.
- [x] 3.3 Implement 异形变体 deck-top/reveal/use-from-deck effects and interaction cleanup.
- [x] 3.4 Implement 青少年 power-3 / group synergy effects and skip/optional branches where applicable. Includes the 2026-08-03 早午餐帮 multi-step fix so the +2 power lands on a 3-power minion still remaining at the original base after the move step.
- [x] 3.5 Implement 怨灵捕手 Wraith action model, related trigger windows and representative action-resolution UI.

## 4. Verification And Closeout

- [x] 4.1 Add targeted Vitest suites for registry, i18n, card entry metadata and each faction's key gameplay atoms. Latest targeted ability suite passes at 53 tests; latest three-file regression passes at 68 tests.
- [x] 4.2 Add or extend real-entry E2E covering faction selection, card/base image visibility and at least one direct L3/L4 chain per new interaction family. Current representative E2E passes for faction selection/details, card preview visibility, base atlas id/index/img visibility for all five factions, and the 异形变体蛋田 direct L3/L4 interaction chain.
- [x] 4.3 Write evidence with object-level L0/L1/L2/L3/L4 matrix, source contract, implementation handoff and residual risks.
- [x] 4.4 Run targeted Vitest, i18n check, typecheck, asset validation and `openspec validate add-smashup-excellent-movies-teens-factions --strict --no-interactive`. Targeted Vitest (53-test ability suite, 4-test integration suite and 68-test three-file regression), typecheck, manifest validation, `npm run assets:validate`, isolated E2E and OpenSpec pass. `npm run i18n:check` still fails only on unrelated Goblins / Round Table Knights historical items.
- [x] 4.5 Gameplay-fix scope note: server asset publication is not a blocker for this repair pass because the user clarified the online asset package already exists and this pass is scoped to gameplay implementation/fixes. Remote card/base WebP state is recorded in closeout evidence as an observation only, not as a gameplay completion gate.
