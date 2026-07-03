# Change: Add Runtime Entity Identity Phase 1

## Why

Smash Up exposed a cross-game engine risk: a temporary effect was keyed by a base slot number, then the base was scored and replaced in the same slot. The old effect followed the slot instead of the old base, so the replacement base inherited a stale breakpoint override.

That is not a Smash Up-only bug. For a platform intended to host many games, any long-lived reference that uses an array index, board slot, UI position, or phase-local coordinate as identity can leak across replacement, movement, removal, delayed resolution, replay, or saved-game restore.

Phase 1 establishes the smallest shared framework contract needed to stop this class of bug from being reimplemented per game:

- runtime entity identity: which object this is across events;
- current coordinate: where the object currently sits;
- lifecycle-bound state: temporary effects and modifiers attached to that object.

This change intentionally uses Smash Up base replacement as the proving migration. It does not claim that every game, every prompt, or every control-flow frame has been migrated.

## What Changes

- Introduce shared runtime entity identity primitives for game objects that can be referenced beyond an immediate command.
- Define entity references as serializable, deterministic references suitable for reducers, events, replay, and saved games.
- Require newly migrated durable object-scoped state to bind to entity identity, not board position or array index.
- Keep slot/index/base position as current coordinates for UI, traversal, and immediate command targeting.
- Add minimal shared helpers for binding and clearing entity-scoped temporary state.
- Add a compatibility path for existing Smash Up state that still contains slot-based references.
- Migrate Smash Up base-scoped temporary breakpoint and power modifiers as the first proving case.

## Impact

- Affected specs:
  - `domain-core`
  - `engine-primitives`
- Expected code areas:
  - shared engine primitive types and deterministic id allocation;
  - helper functions for binding and cleaning entity-scoped temporary state;
  - Smash Up base state and scoring replacement flow as the first proving case.
- Compatibility:
  - Existing slot/index commands may continue as immediate coordinate targets.
  - Existing Smash Up slot-based modifier mirrors remain during compatibility.
  - New or newly migrated long-lived object-scoped state should use entity identity by default.

## Non-Goals

- This change does not require migrating every existing game in one implementation pass.
- This change does not remove coordinates such as slot index, base index, board cell, row, column, or hand index.
- This change does not make UI code use opaque identities for layout; UI may still render by coordinates after resolving entity references.
- This change does not implement a full engine-wide lifecycle registry that automatically scans and cleans every entity-bound state family.
- This change does not migrate all resolution frames, prompts, response windows, or deferred follow-ups to entity references.
- This change does not define each game's semantic lifecycle rules. Games still decide whether a state should clear, migrate, or transform; the framework supplies only the Phase 1 identity primitive and cleanup helper.
