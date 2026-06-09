## 1. Specification and Baseline
- [x] 1.1 Confirm the final `AiDecisionDescriptor` shape and naming.
- [x] 1.2 Audit current interaction kinds in Dice Throne, Smash Up, Splendor, and Summoner Wars for AI-owned blocking decisions.
- [x] 1.3 Mark which interaction kinds can map to generic descriptors and which need game-specific adapters.

## 2. Engine AI Semantics
- [x] 2.1 Add cross-game AI decision descriptor types under the engine AI layer.
- [x] 2.2 Add shared builders that convert descriptor candidates into `AiLegalAction[]`.
- [x] 2.3 Extend AI interaction snapshots to expose semantic descriptors or a normalized equivalent without leaking hidden information.
- [x] 2.4 Add diagnostics for AI-owned interactions that have no semantic descriptor and no adapter.
- [x] 2.5 Cover stable candidate IDs, ordered multi-selection, skip policy, and stale-candidate refresh in tests.

## 3. Interaction System Integration
- [x] 3.1 Allow interactions to carry optional AI semantics independent from `kind`.
- [x] 3.2 Preserve existing UI behavior for `simple-choice`, `multistep-choice`, and game-specific interaction kinds.
- [x] 3.3 Add tests proving two different UI interaction kinds can map to the same AI decision semantic.

## 4. Dice Throne Reference Migration
- [x] 4.1 Migrate four-player targeting roll defender choice to `select-player` semantics.
- [x] 4.2 Migrate `dt:card-interaction` `selectPlayer` to the same semantic path.
- [x] 4.3 Keep existing command payloads (`SELECT_DEFENDER_TARGET`, `RESOLVE_INTERACTION`) behind adapters.
- [x] 4.4 Preserve and expand regression coverage for targeting roll 5/6 and card target selection.

## 5. Cross-Game Gate
- [x] 5.1 Add a structural test or diagnostic helper that detects unsupported AI-owned blocking interactions.
- [x] 5.2 Apply the gate to at least Dice Throne and one non-Dice-Throne game.
- [x] 5.3 Document the migration rule for new games and UGC prototypes.

## 6. Validation
- [x] 6.1 Run focused AI tests for migrated games.
- [x] 6.2 Run relevant engine AI tests.
- [x] 6.3 Run OpenSpec validation for this change.
