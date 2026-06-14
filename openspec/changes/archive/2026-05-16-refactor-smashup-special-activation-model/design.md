## Context

Smash Up already has several partial models for non-normal card usage:

- `beforeScoringPlayable` for minions played from hand in the Me First! window
- `subtype === 'special'` and `responseWindowTiming` for action response-window play
- trigger registration (`beforeScoring` / `afterScoring`) for printed `Special:` text that is not manually activated
- `activatableAbilityKinds` for titans only

The problem is that non-titan cards still use `abilityTags.special` as an ambiguous bucket. That bucket is currently read by validation, UI, AI, and human data-entry, even though those readers need different semantics.

## Goals / Non-Goals

- Goals:
  - make manual activation explicit
  - make response-window playability explicit
  - make trigger-driven printed `Special:` text not appear as manual activation
  - align UI highlight, validation, and AI with the same explicit model
  - provide a migration path for existing Smash Up cards without a flag day rewrite
- Non-Goals:
  - redesign every Smash Up ability tag
  - change printed card text or i18n wording
  - refactor unrelated game systems outside Smash Up

## Current Semantic Buckets

The current `special` label is being used for at least four different behaviors:

1. **Manual board/discard activation**
   - Example: `skeletons_revenant`
   - Needs `ACTIVATE_SPECIAL` and highlight only when actually activatable

2. **Response-window play from hand**
   - Example: `pirate_full_sail`, `world_champs_eh`, `skeletons_hearse_fleet`
   - Should be offered in Me First! / afterScoring windows, not highlighted as a board-clickable minion ability

3. **Trigger-driven printed `Special:` text**
   - Example: `alien_scout`, `cthulhu_chosen`, `skeletons_gravestones`
   - The printed text uses `Special:`, but the runtime entry is a trigger or auto-created interaction, not manual activation

4. **Pure text/audit classification**
   - Needed for data-entry and audits, but must not drive runtime clickability by itself

## Decision

Introduce explicit runtime activation metadata and stop using `abilityTags.special` as gameplay truth.

### New runtime fields

Add explicit non-titan activation metadata to card defs:

- `manualSpecial?: {`
  - `zone: 'board' | 'discard'`
  - `timing?: 'playCards' | 'scoreBases'`
  - `limitGroup?: string`
  - `needsBase?: boolean`
  - `}`

- `responseWindowPlay?: {`
  - `timing: 'beforeScoring' | 'afterScoring'`
  - `needsBase?: boolean`
  - `}`

These fields are runtime behavior fields. They answer:

- can the player manually click this thing right now?
- can the player play this card from hand during a response window?

### Existing fields that remain

- `beforeScoringPlayable`
  - keep for minions from hand in Me First! window during migration
- `specialTiming` / `responseWindowTiming`
  - keep temporarily as compatibility sources for action cards
- `abilityTags.special`
  - deprecated as gameplay input
  - may remain temporarily for audit/text classification, but runtime readers must stop depending on it

### Trigger-driven printed `Special:` cards

Cards whose printed text starts with `Special:` but whose runtime entry is a trigger must not have `manualSpecial`.

Examples:

- `alien_scout`
- `cthulhu_chosen`
- `cowboys_sheriff`
- `skeletons_gravestones`

### Titan alignment

Titans already use `activatableAbilityKinds`. Non-titan cards should move toward the same principle: explicit activatable entrypoints instead of inferred tags.

## Reader Migration

### Validation

`ACTIVATE_SPECIAL` validation must read `manualSpecial` instead of `abilityTags.special`.

### UI highlight

`Board.tsx` / `BaseZone.tsx` must highlight only cards that pass `ACTIVATE_SPECIAL` under the explicit model.

### Response-window availability

`game.ts`, `utils.ts`, and related helpers must read `responseWindowPlay` / `beforeScoringPlayable`, not `abilityTags.special`.

### AI

AI reactive scoring must use explicit response-window/manual activation metadata instead of the generic `special` tag.

## Migration Plan

1. Add the new fields and helper functions without removing old fields.
2. Migrate validation/UI readers to the new helpers.
3. Migrate response-window readers to explicit response metadata.
4. Reclassify existing card defs into:
   - manual special
   - response-window playable
   - trigger-driven special text
5. Update tests and audits.
6. Remove remaining gameplay reads of `abilityTags.special`.

## Risks / Trade-offs

- Some cards currently rely on ambiguous fallback behavior; migration may expose hidden coupling.
  - Mitigation: migrate by semantic bucket and keep focused regression tests for each bucket.
- Data-entry docs and audits currently still reference `special` as a tag-level concept.
  - Mitigation: update workflow docs in the same change.

## Concrete File Targets

- `src/games/smashup/domain/types.ts`
  - add new activation metadata types
- `src/games/smashup/domain/commands.ts`
  - centralize non-titan manual special validation
- `src/games/smashup/domain/utils.ts`
  - centralize response-window behavior helpers
- `src/games/smashup/game.ts`
  - use explicit response metadata for window availability
- `src/games/smashup/Board.tsx`
  - use unified validation-driven highlight only
- `src/games/smashup/ai.ts`
  - switch reactive classification to explicit metadata
- `src/games/smashup/data/factions/**`
  - migrate card defs by semantic bucket

## Open Questions

- Whether to keep `abilityTags.special` temporarily as a text/audit marker or fully remove it from card data in this change.
- Whether to generalize `beforeScoringPlayable` into a broader minion response-window metadata field in the first migration step, or keep it as a compat alias.
