## 1. Spec And Design
- [x] 1.1 Define the `smashup-effect-semantics` capability and semantic boundaries for target, material, and reference queries.
- [x] 1.2 Tighten `smashup-ongoing-effect-authoring` so `selfManaged` only covers custom arithmetic, not ad hoc semantic gating.
- [x] 1.3 Document migration rules for selector/gateway usage, fail-fast behavior, and temporary legacy exceptions.

## 2. Runtime Foundations
- [x] 2.1 Introduce shared semantic descriptors/helpers for runtime object identity, controller lens, variant normalization, and copied/borrowed reads.
- [ ] 2.2 Introduce mandatory semantic application gateways for target-affecting effects such as destroy, move, return, control, attach/detach, and modifier application.
- [x] 2.3 Split semantic query paths for applied targets versus material/reference queries.

## 3. Migration
- [ ] 3.1 Refactor high-risk shared helpers in `abilityHelpers`, `ongoingEffects`, `ongoingModifiers`, and reducer post-processing to consume the new semantic runtime.
- [x] 3.2 Migrate representative abilities/modifiers that currently hand-roll protection/controller/material semantics.
- [x] 3.3 Add audit coverage or equivalent guards to prevent new raw semantic bypass paths from being introduced silently.

## 4. Validation
- [x] 4.1 Add focused tests for protection-aware application gateways, material-vs-target separation, and copied/borrowed/controller-lens consistency.
- [x] 4.2 Validate `openspec` strict checks and ensure proposal-only state remains unimplemented until approved.
