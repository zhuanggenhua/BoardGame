# Change: Add The Gang action log

## Why
The Gang foundation and runtime closeout are complete, but the player-visible action-log capability was explicitly split as a follow-up. The current runtime uses the default empty action-log system, so the HUD cannot explain the public sequence of chip selection, round advancement, showdown, or next heist setup.

## What Changes
- Add The Gang action-log formatting for public gameplay commands.
- Record chip selection, round advancement, showdown result, and next heist start with i18n log segments.
- Add tests that execute the real pipeline and prove `G.sys.actionLog.entries` is populated without exposing hidden hand details.

## Impact
- Affected specs: `action-log`
- Affected code: `src/games/the-gang/game.ts`, `src/games/the-gang/actionLog.ts`, `public/locales/*/game-the-gang.json`, The Gang tests
