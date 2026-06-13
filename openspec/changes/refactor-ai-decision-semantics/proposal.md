# Change: Refactor AI decision semantics

## Why
The current cross-game AI contract already centralizes `AiDecisionContext` and `legalActions`, but each game still has to inspect interaction shells such as `simple-choice`, `dt:card-interaction`, or `dt:defender-choice` to construct actions. This makes AI support fragile: a new UI interaction shell can represent an old decision such as "choose one enemy player" while AI sees it as a new unsupported case.

The platform goal is to support many games and UGC prototypes. AI should consume rule decision semantics, not UI presentation shapes.

## What Changes
- Add an engine-level AI decision semantics model for common blocking decisions such as selecting players, cards, board objects, dice, numeric values, optional skips, and confirmations.
- Allow `InteractionDescriptor` data to expose an optional AI-facing decision descriptor that is independent from the UI `kind`.
- Update `GameAiRuntime.buildLegalActions` expectations so game runtimes first normalize current interactions into semantic decisions, then adapt only game-specific commands and scoring hints.
- Add structural checks so any blocking interaction owned by an AI seat must either expose semantic AI support, provide an explicit game adapter, or fail a test/diagnostic gate instead of silently returning no actions.
- Migrate Dice Throne's player-target choices as the first reference implementation, including 4-player targeting roll and card-driven player selection.

## Impact
- Affected specs: `game-ai-system`, `interaction-system`
- Affected code: `src/engine/ai/types.ts`, `src/engine/ai/snapshots.ts`, `src/engine/ai/context.ts`, `src/engine/systems/InteractionSystem.ts`, game AI runtimes under `src/games/*/ai.ts`
- Migration risk: existing game-specific AI adapters may continue to work during migration, but new interaction types should be required to declare AI decision semantics or a documented non-AI reason.
