# Tasks

This checklist is scoped to Phase 1: shared identity primitives plus the Smash Up proving migration. Future engine-wide lifecycle orchestration is listed separately and is not part of this change's completion claim.

## 1. Identity Primitives

- [x] Define serializable runtime entity id and entity ref primitives.
- [x] Add deterministic entity id allocation helpers for reducer-safe replay.
- [x] Add entity ref resolver behavior that fails closed on stale, missing, or kind-mismatched refs.
- [x] Add unit tests for deterministic allocation and stale ref resolution.

## 2. Phase 1 Lifecycle Binding

- [x] Define lifecycle-bound state policies in the OpenSpec design: clear, invalidate, migrate, transform.
- [x] Add shared cleanup helpers for entity-scoped temporary state.
- [x] Add tests proving replacement occupants do not inherit stale bound state by coordinate reuse.
- [x] Document that migration to a new entity must be explicit game-rule behavior.

## 3. Compatibility and Migration Guardrails

- [x] Add compatibility guidance for old coordinate-backed state in the design/spec deltas.
- [x] Preserve old coordinate fields as compatibility mirrors for existing Smash Up state/tests.
- [x] Mark broad old-game coordinate migration as deferred; this change only migrates Smash Up.
- [x] Ensure stale entity refs cannot silently retarget to replacement entities.

## 4. Smash Up Proving Migration

- [x] Add runtime identity to bases in play.
- [x] Migrate base-scoped temporary breakpoint and power modifiers from base slot keys to base entity refs.
- [x] Preserve base slot index for UI, traversal, and immediate command targeting.
- [x] Keep the Killer Plants regression covered: replacement base does not inherit the old base's zero-breakpoint modifier.

## 5. Phase 1 Cross-Game Adoption

- [x] Limit old-game implementation scope to Smash Up for this first migration.
- [x] Update OpenSpec deltas so new or newly migrated durable object-scoped state defaults to entity identity.
- [x] Add review checklist expectations in the task/design text: identity owner, coordinate fallback, lifecycle cleanup, replay behavior.
- [x] Defer broad per-game migration until each game's state families are audited.

## Deferred Future Work

The following items are intentionally outside this change's acceptance scope:

- Add a central lifecycle registry for all entity-bound state families after more migrations prove the shape.
- Migrate generic prompts, response windows, resolution frames, and deferred follow-ups to entity refs where they target runtime objects.
- Audit and migrate other games' coordinate-backed durable state family by family.
- Define per-game migration adapters for old saved states that cannot reconstruct entity identity safely.
