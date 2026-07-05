# Change: Add The Gang basic tutorial

## Why
The Gang still has an empty tutorial manifest, so the tutorial entry can load without teaching the player how the game works. The foundation and action-log paths are now complete enough to add a focused basic tutorial.

## What Changes
- Add a basic The Gang tutorial manifest with real steps and i18n text.
- Wire Board tutorial bridge and stable `data-tutorial-id` anchors for highlight targets.
- Add tests proving the tutorial is non-empty, uses valid command/event IDs, and Board exposes the tutorial anchors.

## Impact
- Affected specs: `tutorial-engine`
- Affected code: `src/games/the-gang/tutorial.ts`, `src/games/the-gang/Board.tsx`, `public/locales/*/game-the-gang.json`, The Gang tests
