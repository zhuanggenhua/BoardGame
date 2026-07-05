# Change: Add The Gang visible local AI

## Why
The Gang already has a deterministic automatic test path, but the game still declares `localAi: false` and does not register a visible local AI runtime. Players therefore cannot add local AI seats through the standard AI seat controller flow.

## What Changes
- Add a The Gang local AI runtime that exposes legal chip-selection and public heist-progression actions.
- Add a baseline local policy that only chooses from `AiDecisionContext.legalActions`.
- Enable `manifest.ai.localAi` for The Gang and register the runtime from the game module.
- Add tests for legal action generation, occupied-chip exclusion, progression actions, and policy legality.

## Impact
- Affected specs: `game-ai-system`
- Affected code: `src/games/the-gang/ai.ts`, `src/games/the-gang/game.ts`, `src/games/the-gang/manifest.ts`, The Gang tests and docs
