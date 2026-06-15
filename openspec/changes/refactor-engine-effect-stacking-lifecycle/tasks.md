## 1. Spec And Design
- [x] 1.1 Extend `engine-primitives` spec with stacking policy and instance-owned granted tag lifecycle requirements.
- [x] 1.2 Document source-vs-target stacking semantics and granted tag ownership trade-offs.

## 2. Engine Primitives
- [x] 2.1 Add generic stacking policy primitives and reconciliation outcomes for persistent effects.
- [x] 2.2 Add source-owned / instance-owned granted tag lifecycle support so effect removal does not over-remove shared tags.
- [x] 2.3 Keep the new lifecycle APIs game-scoped and side-effect free.

## 3. Validation
- [x] 3.1 Add primitive tests covering target/source stacking, refresh semantics, and precise granted-tag teardown.
- [x] 3.2 Verify the existing first-batch `applyEffectSpec(...)` callers remain compatible when they do not opt into stacking.
