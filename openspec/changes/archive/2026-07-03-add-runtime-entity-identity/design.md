# Design: Runtime Entity Identity Phase 1

## Problem Model

The current failure mode is caused by treating a current coordinate as a durable identity. In Smash Up, a base slot number was stable enough for UI and traversal, but not stable enough for a temporary breakpoint modifier that outlives a single reducer branch. Once the old base left and a new base entered the same slot, the modifier had no way to know that its original target was gone.

The same class of bug applies to cards, units, summons, tokens, rooms, board cells with replaceable occupants, delayed prompts, response windows, and any object that can be removed and replaced while its slot remains valid.

## Goals

- Establish one shared identity primitive that future games can reuse instead of inventing one-off cleanup keys.
- Keep reducers deterministic and events serializable.
- Preserve replay and saved-game restore.
- Make stale references fail closed instead of silently applying to a replacement object.
- Preserve coordinates for UI and immediate command ergonomics.
- Prove the model in Smash Up base replacement before broad migration.

## Non-Goals

- Do not force all command payloads to use entity references immediately.
- Do not remove slot/index usage from rendering, hit testing, sorting, or immediate board traversal.
- Do not encode every game-specific replacement rule into the core engine.
- Do not silently auto-migrate old snapshots without a visible compatibility boundary.
- Do not implement a full engine-wide lifecycle registry in Phase 1.
- Do not migrate all prompts, response windows, resolution frames, or follow-ups in Phase 1.
- Do not migrate old games other than Smash Up in Phase 1.

## Phase 1 Scope

Implemented in this change:

- Shared entity identity primitives: deterministic entity ids, serializable entity refs, stale/kind-mismatched resolution failure, and small entity-scoped state helpers.
- Smash Up proving migration: bases in play receive instance identity, base-scoped temporary breakpoint and power modifiers bind to base identity, and base replacement clears the old base's bound state.
- Compatibility mirrors: existing Smash Up slot-index fields remain available while entity-id keyed state becomes authoritative for migrated modifier families.
- Regression coverage: Killer Plants no longer leaks a zero-breakpoint temporary modifier from a scored base to the replacement base in the same slot.

Deferred out of this change:

- A central lifecycle registry that automatically owns all entity-bound cleanup across every system.
- Generic migration of control-flow state such as prompts, response windows, resolution frames, and deferred follow-ups.
- Migration of every existing game and every existing coordinate-backed state family.
- Archiving broad system-layer or control-flow requirements as already built.

## Commercial Game Practice Check

Commercial engines generally separate durable runtime identity from transient list position or board coordinate:

- Unreal Gameplay Ability System uses an active effect handle when code outside the active-effect container needs to refer to one specific live effect. Epic's documentation describes `FActiveGameplayEffectHandle` as the external reference to a specific active gameplay effect, and states that a pointer or index into the active list is not sufficient because those are not synchronized between clients and server.
- Unity Netcode for GameObjects identifies spawned network objects by `NetworkObjectId`. Its documentation states that `NetworkObject`s are spawned and destroyed by `NetworkManager`, receive a unique `NetworkObjectId` when spawned, release it when destroyed, and are tracked in spawned-object maps keyed by that id.
- Production card/board-game implementations usually keep printed/card definition identity separate from runtime copy identity. A card definition such as "Killer Plants" is not enough to identify one live copy, and a base slot is not enough to identify the base currently occupying that slot.

The Phase 1 design follows that pattern at the domain layer: a runtime base instance gets an identity; slot index remains a coordinate; temporary base-scoped modifiers bind to the runtime base identity and fail closed after replacement. This is not yet the full commercial-grade lifecycle framework, but it is the correct foundation for one.

## Concepts

### Entity Id

An entity id is a deterministic runtime id allocated by domain logic, not a random UUID. It identifies one runtime object instance for the lifetime of that instance.

Examples:

- one specific base currently in play;
- one specific minion card after it enters play;
- one token or summoned object that can be referenced later;
- one replaceable board object in a zone.

Entity ids must be generated from deterministic state progression so replay produces the same ids.

### Entity Ref

An entity ref is a serializable pointer to a runtime object. It should carry enough information to resolve strongly and fail safely:

```ts
type EntityRef = {
  entityId: string;
  kind: EntityKind;
  fallback?: {
    coordinate?: unknown;
    defId?: string;
  };
};
```

The exact type shape can be refined during implementation. The important contract is:

- `entityId` is the primary identity;
- `kind` prevents cross-type accidental resolution;
- `fallback` exists only for compatibility, diagnostics, or migration from old snapshots.

### Coordinate

A coordinate is the current place where an entity is found. Examples include base slot index, board cell, row/column, hand index, discard position, or UI lane. Coordinates are allowed to change and may be reused by different entities over time.

Coordinates are valid for:

- UI layout and hit testing;
- immediate command targets when validated against current state;
- iteration and sorting;
- compatibility fallback when explicitly marked as such.

Coordinates are not valid as durable keys for long-lived state.

### Lifecycle-Bound State

Lifecycle-bound state is any state that must not accidentally survive the death, removal, replacement, or transformation of its target.

Examples:

- temporary power or breakpoint modifiers;
- future per-object locks, prompts, quotas, attachments, or dependent objects after they are individually migrated.

In Phase 1, the implemented lifecycle-bound state is Smash Up base-scoped temporary modifier state. Other state families remain migration debt until audited.

## Required Behavior

### Strong Resolution

When resolving an entity ref, the resolver must confirm that:

- the entity id exists in current state;
- the entity kind matches;
- the entity is in a valid lifecycle state for the operation;
- optional compatibility fields do not contradict the resolved entity.

If resolution fails, the operation must fail closed: reject, skip, or clean up according to the owning system's declared policy. It must not retarget by coordinate unless an explicit compatibility adapter says this is allowed.

### Lifecycle Cleanup

When an entity leaves its lifecycle scope, migrated state must clean or invalidate state bound to that entity. Games may choose the policy per state family:

- clear: remove the state;
- invalidate: keep a diagnostic marker but do not apply it;
- migrate: move state to a new entity only when game rules explicitly say so;
- transform: convert state through a declared game rule.

Default behavior for temporary effects should be clear or invalidate, not migrate. Phase 1 provides helper functions for entity-scoped temporary state, not a universal registry that discovers every bound state automatically.

### Compatibility

Old states may contain only slot/index references. Compatibility must be explicit and auditable:

- identify the old coordinate-backed state family;
- resolve against current state with coordinate plus definition checks where possible;
- convert to entity refs on load, start of game, or first reducer touch;
- record remaining high-risk slot-based state as migration debt.

Compatibility cannot silently treat a replacement occupant as the original object.

## First Proving Migration

Smash Up base identity should be the first proving migration because it has a concrete regression:

- old base receives a temporary breakpoint modifier;
- base scores and leaves play;
- replacement base enters the same slot;
- old modifier must not apply to the replacement base.

The migration should keep base slot index available for UI and immediate selection, but long-lived base-scoped state should bind to base entity identity.

## Risks

- Existing tests may assert slot-index internals rather than user-visible behavior.
- Old saved states may lack enough data to reconstruct identity with high confidence.
- Some games intentionally migrate effects across transformation; those must use explicit migration rules, not default coordinate reuse.
- A broad mechanical rewrite could create semantic regressions. Migration should proceed by state family and representative game, with focused regression tests.
- The Phase 1 primitive can prevent this bug only where code actually adopts it. Unmigrated games and unmigrated state families can still have coordinate-leak bugs.
