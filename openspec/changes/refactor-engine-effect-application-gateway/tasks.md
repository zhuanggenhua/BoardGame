## 1. Spec And Design
- [x] 1.1 Extend `engine-primitives` spec with tag-aware effect specification and unified application gateway requirements.
- [x] 1.2 Document how the new gateway composes with existing `effects.ts`, `tags.ts`, and `modifier.ts`.

## 2. Engine Primitives
- [x] 2.1 Introduce generic `EffectSpec` / `EffectApplicationContext` / `EffectApplyResult` primitives.
- [x] 2.2 Add a tag-aware `applyEffectSpec(...)` gateway that checks required tags, blocked/immunity tags, granted tags, and remove-with-tags lifecycle.
- [x] 2.3 Keep primitive registries game-scoped and side-effect free.

## 3. Validation
- [x] 3.1 Add primitive tests covering accepted, blocked, inactive, and tag-driven removal flows.
- [x] 3.2 Verify existing `effects.ts` simple dispatch path still works for callers that do not opt into the new gateway.
