## Context

The previous reaction ordering refactor improved two symptoms:

- `sourceSelfState` can be materialized to a source instance.
- mandatory frame prompts can be limited to conflict components.

That did not remove the root cause. The root cause is that ordering still depends on a manually maintained `TriggerEffectContract` abstraction. This is not commercial-grade for a large card game because every card effect now has two separate behavior descriptions:

1. the real effect logic that emits events or opens interactions;
2. a hand-written footprint summary that may be incomplete, too coarse, or stale.

A scalable system should define legal resource references once and derive footprints from real runtime artifacts.

## Goals / Non-Goals

### Goals

- Centralize concrete reaction resources in a strongly typed model.
- Derive writes from `SmashUpEvent` payloads.
- Derive potential writes/reads from interaction options and target descriptors before the player chooses.
- Derive source/self/player/base/titan scopes from `TriggerInstance` context.
- Require explicit fallbacks only for genuinely non-derivable effects.
- Prevent optional `may/你可以` effects from entering mandatory ordering.
- Make optional titan special activation use the normal board/titan click surface during its timing window.

### Non-Goals

- Do not create a larger per-card DSL that every card must hand-author.
- Do not add more `ReactionOrderingAtom` variants as the long-term solution.
- Do not change printed card text or card rule semantics.
- Do not rewrite unrelated games.

## Design

### 1. Resource model

Add a Smash Up scoped resource model, conceptually:

```ts
type SmashUpResourceRef =
  | { kind: 'minion'; uid: string }
  | { kind: 'base'; index: number }
  | { kind: 'baseSlot'; index: number; zone: 'minions' | 'ongoingActions' | 'buriedCards' }
  | { kind: 'cardInstance'; uid: string }
  | { kind: 'sourceInstance'; uid: string }
  | { kind: 'titan'; uid: string }
  | { kind: 'playerHand'; playerId: string }
  | { kind: 'playerDeck'; playerId: string }
  | { kind: 'playerDiscard'; playerId: string }
  | { kind: 'playerPlayLimit'; playerId: string }
  | { kind: 'playerVp'; playerId: string }
  | { kind: 'turnFlag'; key: string; playerId?: string }
  | { kind: 'baseDeck' }
  | { kind: 'madnessDeck' }
  | { kind: 'global'; key: string };
```

The exact shape can be adjusted during implementation, but the invariant is stable: ordering compares concrete typed resource refs, not string buckets.

### 2. Footprint derivation pipeline

For each queued trigger/base ability candidate:

1. Build a `TriggerProbeContext` from the trigger source and frame.
2. Execute only enough to produce deterministic planned artifacts in an isolated draft/probe context.
3. Convert artifacts to `ResourceFootprint`:
   - events → actual write resources;
   - interactions/options → possible target resources and source resources;
   - source context → source/titan/base ownership resources;
   - no-op/empty result → no write footprint.
4. Compare footprints for conflicts.

The probe must not mutate authoritative state or consume real randomness. Existing pure event-returning triggers are already close to this model; interaction-producing triggers need target descriptor extraction.

### 3. Event footprint inference

Create a single mapping from event type to affected resources. Examples:

- `MINION_MOVED` writes the minion, source base, destination base, and related target availability.
- `MINION_DESTROYED` writes the minion, base slot, discard owner, and destruction turn flags if present.
- `CARDS_DRAWN` / draw events write player hand and deck.
- `ONGOING_DETACHED` writes source card/base slot/discard.
- `TITAN_PLAYED` / titan move/counter events write titan and destination base.
- `BASE_REPLACED` writes base and base deck.

This map is maintained per event type, not per card.

### 4. Interaction footprint inference

Interactions must expose enough structured target data for ordering to know possible resources before resolution. Existing option values already often contain fields such as `minionUid`, `baseIndex`, `cardUid`, `titanUid`, `playerId`.

Add helper extraction:

- infer target resources from option values;
- infer source resources from continuation context;
- mark unknown option shapes as fallback-required, not as global conflicts by default.

### 5. Fallback policy

Fallback is allowed only when automatic derivation cannot prove enough. Fallback must be explicit and auditable:

```ts
fallbackFootprint: {
  reason: 'dynamic script inspects arbitrary deck order',
  reads: [...],
  writes: [...]
}
```

Fallback count should trend down. New cards should not require fallback unless they introduce genuinely new event or interaction shapes.

### 6. Mandatory/optional split

Registration must distinguish:

- forced effect / bookkeeping;
- optional `may/你可以` branch;
- mixed effects that do both.

Mixed effects like Sprout and Invisible Ninja must not be represented as one mandatory trigger with an embedded optional prompt if that causes optional choices to enter mandatory ordering. They should be represented as forced event(s) plus a separate optional continuation when needed.

### 7. Optional titan UX

For回合开始 optional titan specials:

- timing window opens a non-generic activation surface;
- eligible titan card is highlighted in set-aside/base area;
- clicking the titan executes `ACTIVATE_SPECIAL`/equivalent with normal target selection;
- a visible pass/skip control closes the window;
- `smashup_reaction_choose` remains for true ordering or generic response choices, not as the main titan “do you want to play it” dialog.

## Risks / Trade-offs

- Probing trigger artifacts can expose impurity in existing trigger callbacks. Mitigation: start with event/interaction result extraction from current callbacks in isolated match-state copies and add tests for no state mutation.
- Some interactions have unstructured option values. Mitigation: add extraction helpers and fallback only for those exact shapes.
- Large migration risk. Mitigation: migrate in layers: resource model → event inference → interaction inference → ordering switch → optional titan UX → remove legacy enforcement.

## Migration Plan

1. Add resource model and footprint inference modules without changing behavior.
2. Add event-to-resource inference tests.
3. Add interaction-option inference tests using Mushroom Kingdom, Sprout, The Bride, Sphinx, Emperor Penguin, Mergacon.
4. Switch ordering conflict detection to derived footprints with legacy fallback.
5. Split known mixed mandatory/optional triggers.
6. Change optional titan UI entry to click/highlight model.
7. Remove/relax per-trigger `effectContract` requirement and delete stale declarations where no longer needed.
8. Run unit and E2E proof chain; update evidence.
