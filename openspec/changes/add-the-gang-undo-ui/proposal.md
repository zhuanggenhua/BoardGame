# Change: Add The Gang undo UI bridge

## Why
The Gang already configures undo snapshots, but its Board does not provide game state to the shared undo HUD context. That leaves the capability as a backend snapshot only, not a player-visible undo entry.

## What Changes
- Wrap The Gang Board with the shared `UndoProvider`.
- Split The Gang undo snapshot allowlist from the action-log allowlist so snapshot policy is explicit.
- Add runtime tests proving The Gang Board provides undo state for the shared HUD.
- Update The Gang capability docs from "no undo UI" to "shared undo UI bridge completed".

## Impact
- Affected specs: `undo-system`
- Affected code: `src/games/the-gang/Board.tsx`, `src/games/the-gang/game.ts`, `src/games/the-gang/actionLog.ts`, The Gang tests and docs
