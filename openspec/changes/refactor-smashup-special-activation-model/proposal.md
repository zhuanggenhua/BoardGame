# Change: Refactor Smash Up special activation model

## Why

Smash Up currently overloads `special` across multiple unrelated semantics:

- card text keyword (`Special:` in the printed text)
- manual activation from the board or discard pile
- response-window playability from hand
- trigger-driven timing text that is not manually clickable
- AI "reactive card" classification

This causes recurring false highlights, incorrect validation, brittle data-entry rules, and accidental regressions when one card's `special` behavior is "fixed" by changing a shared tag.

## What Changes

- Introduce explicit Smash Up activation metadata for:
  - manual activation surfaces
  - response-window playability
  - trigger-driven special text
- Stop using `abilityTags.special` as the source of truth for board highlight and `ACTIVATE_SPECIAL` validation
- Migrate existing Smash Up cards to the new explicit activation model
- Keep compatibility only where needed during migration, then remove lingering gameplay reads of ambiguous `special` tags
- Update audit / intake rules so data-entry no longer treats printed `Special:` text as equivalent to "clickable special ability"

## Impact

- Affected specs:
  - `smashup-ability-activation` (new)
- Affected code:
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/domain/utils.ts`
  - `src/games/smashup/game.ts`
  - `src/games/smashup/Board.tsx`
  - `src/games/smashup/ui/BaseZone.tsx`
  - `src/games/smashup/ai.ts`
  - `src/games/smashup/data/factions/**`
  - Smash Up audit / intake docs and regression tests
