# AI Decision Semantics Audit

## Scope
This audit records the current AI-owned blocking interaction patterns reviewed for the `refactor-ai-decision-semantics` change.

## Findings

| Game | Current AI-owned blocking interaction pattern | Mapping |
| --- | --- | --- |
| Dice Throne | `dt:defender-choice` for targeting roll and `dt:card-interaction` with `selectPlayer` | Reference-migrated to `select-player` semantics with game command adapters |
| Smash Up | `simple-choice` is consumed directly by the game AI runtime for reaction and follow-up prompts | Needs gradual migration: generic `choose-option` for branch/pass prompts, `select-object`/`select-card` for board and card targets |
| Splendor | AI actions are mostly built directly from visible core state, not from blocking interaction shells | No immediate blocking-interaction migration required; diagnostics still apply if future prompts are added |
| Summoner Wars | `simple-choice` and `multistep-choice` are consumed by game AI branches | Needs gradual migration: `choose-option` for simple prompts, `select-object` for board units/spaces, `select-card` for summon/build choices |
| Cardia | `simple-choice` wraps domain interaction choices and is consumed directly by the AI runtime | Needs gradual migration: `choose-option` for ability branches and `select-card`/`select-object` where candidates have stable IDs |

## Migration Rule
New blocking interactions that can be assigned to an AI-controlled seat must declare one of:

- `ai.status = 'semantic'` with one or more decision descriptors.
- `ai.status = 'adapter'` when a game runtime intentionally handles the interaction kind itself.
- `ai.status = 'unsupported'` with a reason, and the interaction must not be assigned to AI seats in normal gameplay.

If none of these is true, diagnostics must treat an empty AI legal-action set as a support gap, not as a valid idle decision.

## Anti-Patterns for New Games

New games must not copy these legacy patterns:

- Reading `interaction.kind === 'simple-choice'` as the primary AI meaning instead of declaring a rule decision semantic.
- Treating `data.type`, `targetType`, option labels, translated text, or option array indices as stable AI target identity.
- Returning an empty legal-action list for an AI-owned blocking interaction without a diagnostic, cancel/fallback action, semantic descriptor, adapter declaration, or explicit unsupported marker.
- Reusing stale candidates across chained decisions instead of rebuilding descriptors from the current interaction state.
- Exposing hidden hand/deck/private prompt candidates through shared AI semantics instead of deriving descriptors from the AI player's visible state.

The acceptable temporary compatibility path for legacy games is `ai.status = 'adapter'` plus a named adapter. The target architecture is still semantic descriptors.
