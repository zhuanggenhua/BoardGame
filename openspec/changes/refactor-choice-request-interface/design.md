## Context

The existing engine already has interaction descriptors, AI decision semantics, `legalActions`, online AI decision views, and watchdog recovery. Those pieces are useful, but the source of a blocking player choice is still often the UI shell or a game-specific adapter. That is why a field-click UI, a simple-choice modal, and a dice confirmation bar can represent the same kind of rule choice while AI support depends on which shell happened to be used.

This change moves the source of truth one step earlier: a rule-level player choice is first represented as a `Choice Request`. UI, AI, service-side recovery, and tests consume projections of that request.

## Goals / Non-Goals

- Goals:
  - Make every blocking player choice have one authoritative candidate set and lifecycle owner.
  - Guarantee human/AI action parity for AI-controllable seats under the same visible information boundary.
  - Make missing AI strategy a visible implementation error or unsupported declaration, not a silent idle state.
  - Let new games and low-simple-choice games cut directly to Choice Request without thick compatibility bridges.
  - Collapse documentation around one interaction interface entry, with simple-choice documented only as a legacy surface adapter.
- Non-Goals:
  - Do not rewrite React components as the primary solution; UI surfaces are downstream adapters.
  - Do not migrate all Smash Up or Summoner Wars prompts in one batch.
  - Do not let watchdog choose business targets or infer strategy.
  - Do not create a second AI-only decision state beside the authoritative rule decision.

## Decisions

### Decision: Choice Request owns the rule choice

Each blocking player choice is represented by a request with stable identity and explicit invariants:

- `requestId`, `gameId`, `playerId`, `ownerFrameId`
- `kind` / `choiceKind`
- `candidates` with stable candidate IDs, visibility, enabled state, disabled reason, command metadata, and AI-only hints
- `selection` constraints: min, max, ordered, allow duplicates if ever needed
- `skipPolicy`: forbidden, optional skip, forced pass, confirm-current, cancel-only
- `resolution`: command mapping or frame callback owner
- `diagnostics`: source, rule reference if available, failure classification

The request can project to existing `InteractionDescriptor` or future UI-specific surfaces, but those projections do not become the truth.

### Decision: LegalAction generation is a projection, not a separate model

`ChoiceRequest -> AiLegalAction[]` becomes the only cross-game AI action enumeration path for request-owned choices. Existing `AiDecisionDescriptor` work can be reused as a projection or internal descriptor family, but it must not be a second candidate source with different freshness or visibility rules.

### Decision: AI strategy is required for every AI-controllable ChoiceKind

The engine owns common choice shapes and action enumeration. Games own strategy: scoring, tie-break preferences, domain command adapters, and game-specific hints. If a request can block an AI seat, one of these must be true:

- the shared engine policy can resolve it safely;
- the game registers a policy for that `ChoiceKind`;
- the request is explicitly unsupported and cannot be assigned to AI seats.

Returning an empty action list without an explicit reason is a request failure.

### Decision: UI surface adapters have no business authority

Simple-choice, direct field selection, right-side dice controls, hand-card highlights, board-cell highlights, and future mobile surfaces all adapt the same request. A surface may change layout, preview, confirmation affordance, and accessibility behavior; it may not own legal candidates, AI support, skip semantics, or recovery behavior.

### Decision: Migration cuts directly where feasible

New games and low-simple-choice games move directly to request-first builders. No thick compatibility layer is created for them. Existing heavy users remain stable through a thin legacy adapter, then migrate by interaction family:

- first batch: engine runtime, Betrayal, Mage Wars, Qidahen, Cardia, TicTacToe;
- later batches: Smash Up scoring/direct-field target families, then high-risk ability prompt families;
- later batches: Summoner Wars simple-choice/multistep interaction families.

Thin legacy adapter means only translating an existing simple-choice into a Choice Request projection or vice versa for display. It cannot own strategy, permission, recovery, or a second lifecycle.

### Decision: Documentation has one interface entry

The long-term documentation shape is a single interaction interface standard that covers Choice Request, UI surfaces, AI actions, recovery, and tests. Simple-choice is a legacy surface section or appendix, not a standalone architectural destination. Component-specific docs should exist only when a component has non-obvious interface contracts; otherwise they are indexed under the interface entry.

## Risks / Trade-offs

- Early type design can become too broad. Mitigation: implement only the first-batch choice kinds observed in real games, then extend by request tests.
- Direct cutover can expose missing UI affordances. Mitigation: migrate small games first and require human/AI parity tests for each decision kind.
- Existing `AiDecisionDescriptor` may overlap with Choice Request. Mitigation: reuse it as an AI projection where it fits, but keep candidate ownership in Choice Request.
- Watchdog behavior may appear less “helpful” because it stops guessing. Mitigation: emit precise incidents so missing policy or bad request is fixed at the source.

## Migration Plan

1. Build a request ledger for current blocking choice families, including simple-choice, field direct selection, dice confirmation, card/board target selection, optional skip, ordered multi-select, and response windows.
2. Add the core `ChoiceRequest` type, invariants, projection helpers, and diagnostics in the engine.
3. Wire AI `legalActions` generation to request projections and add missing-policy fail-close behavior.
4. Add UI adapters for simple-choice legacy display, direct board/field selection, and dice confirmation.
5. Migrate first-batch games and prove human/AI parity through tests.
6. Add recovery diagnostics that report request failure categories instead of relying on generic emergency skip.
7. Fold or re-index simple-choice docs into the single interaction interface entry.

## Open Questions

- Final type names may be adjusted during implementation to reuse current `AiDecisionDescriptor` naming where it reduces churn.
- The first Smash Up migration family should be chosen after the first-batch games are green; likely candidates are scoring field target selection and base/source-target prompts.
