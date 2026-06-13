## Context
The engine already has a cross-game AI layer:

- `AiDecisionContext` carries visible state, interaction snapshot, response window, legal actions, rules version, budget, and difficulty.
- `GameAiRuntime.buildLegalActions` remains the per-game adapter that turns state into executable commands.
- `AiHint` and scoring utilities provide a shared way to express target relation, effect intent, and estimated value.

The missing abstraction is the step before legal actions: interaction data does not declare what decision it represents. As a result, each game AI inspects `interaction.kind` directly and builds commands with bespoke branches. This is acceptable for one game, but it does not scale to many games.

## Goals
- Make common AI decision categories explicit and reusable across games.
- Keep UI presentation independent from AI semantics.
- Preserve the existing command pipeline: AI still chooses a legal action, then commands still pass validate / execute / reduce / systems.
- Provide a migration path where games can add semantic descriptors gradually.
- Add a gate that catches unsupported AI-owned interactions before they become runtime stalls.
- Support complex games with chained decisions, private information, ordered selections, dynamic candidate refresh, and response windows.

## Non-Goals
- Do not replace each game's strategic evaluation model.
- Do not force every game to use the same UI interaction kind.
- Do not let AI bypass game validation or generate commands outside `legalActions`.
- Do not solve full strategic strength for every game in this change.

## Proposed Model
Add a cross-game `AiDecisionDescriptor` family in the AI layer. Initial kinds:

- `select-player`: choose one or more player IDs.
- `select-card`: choose cards from a declared zone or candidate list.
- `select-object`: choose board objects such as minions, bases, pieces, tiles, or spaces.
- `select-dice`: choose dice by ID, with optional owner/opponent metadata.
- `modify-value`: choose or adjust numeric values.
- `choose-option`: choose opaque options that carry `AiHint` metadata.
- `confirm`: continue/confirm without meaningful strategic choice.
- `optional-skip`: explicit skip/pass choice.

Each descriptor should include the acting player, candidate list, selection bounds, skip policy, AI hints, and a command adapter. Games may provide the command adapter when the generic descriptor cannot express the command payload directly.

## Commercial-Grade Constraints
- Stable candidate identity: every candidate must expose a stable ID that remains valid for the current decision. UI labels and array indices are not identity.
- Visibility safety: descriptors included in AI context must be derived from the AI player's visible state and must not reveal hidden hands, deck order, private prompt contents, or private choices belonging to another player.
- Selection bounds: every selectable descriptor must declare min/max selection counts and whether order matters.
- Dynamic refresh: chained interactions must rebuild descriptors from the current interaction state after every command; AI must not reuse stale candidates from an earlier decision epoch.
- Command authority: semantic descriptors can help build commands, but command validation remains authoritative.
- Fallback visibility: if a blocking interaction cannot produce actions, the diagnostic must identify the interaction kind, source, owner, and unsupported reason.
- Strategy separation: descriptors describe what can be chosen and why it may matter; they do not decide which candidate is strategically best for a specific game.

## Migration Strategy
1. Keep existing `GameAiRuntime.buildLegalActions` API.
2. Add helpers that extract `AiDecisionDescriptor[]` from `state.sys.interaction.current`.
3. Let game runtimes register descriptor adapters for legacy or custom interaction kinds.
4. Convert descriptors into `AiLegalAction[]` using shared builders.
5. Add tests that enumerate AI-owned blocking interactions and assert they produce at least one legal action, an explicit cancel action, or a documented unsupported marker.
6. Migrate Dice Throne first, then apply the same pattern to Smash Up and Splendor only after the shared helper proves stable.

## Open Questions
- Whether `AiDecisionDescriptor` should live purely under `src/engine/ai/` or be referenced directly by `InteractionDescriptor.data`.
- Whether generic command adapters should be serializable for remote AI views, or whether only resulting `AiLegalAction` objects need to be serializable.
- How strict the gate should be for UGC prototypes: hard error in tests, runtime warning in development, or visible room setup warning.
