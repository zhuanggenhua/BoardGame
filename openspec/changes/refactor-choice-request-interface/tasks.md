## 1. Request ledger

- [x] 1.1 Inventory current blocking decision families across engine, Betrayal, Mage Wars, Qidahen, old compatibility users, Smash Up, Summoner Wars, and DiceThrone.
- [x] 1.2 Classify each family by decision kind, candidate source, UI surface, AI policy owner, skip/confirm behavior, and recovery behavior.
- [x] 1.3 Mark first-batch direct-cut migrations and legacy adapter families.

## 2. Engine runtime

- [x] 2.1 Define `ChoiceRequest` and invariant checks for actor, owner frame, candidates, selection bounds, visibility, skip policy, and resolution owner.
- [x] 2.2 Add projection helpers from Choice Request to interaction UI surfaces and from Choice Request to AI legal actions.
- [x] 2.3 Add fail-close diagnostics for missing policy, missing candidates, stale candidates, invalid selection bounds, and unsupported AI assignment.

## 3. AI integration

- [ ] 3.1 Register shared policies for skip, pass, confirm-current, single required candidate, ordered/unordered selection, and simple target selection where strategy is generic.
  - [x] 3.1a Add an opt-in shared `AiDecisionDescriptor -> SYS_INTERACTION_RESPOND` projection helper for request-owned interaction candidates.
- [ ] 3.2 Require game policy registration for non-generic choice kinds before an AI seat can own that request.
- [ ] 3.3 Update AI context building so request-owned choices do not rely on UI kind names or candidate array order.
  - [x] 3.3a Apply the shared semantic projection only to first-batch request-owned choices; old compatibility users keep legacy behavior until separately approved.

## 4. UI adapters

- [x] 4.1 Implement a simple-choice legacy surface adapter that renders Choice Requests without owning candidates or AI semantics.
- [ ] 4.2 Implement direct board/field selection adapter behavior for Choice Request candidates.
- [ ] 4.3 Implement confirm-current / dice confirmation adapter behavior for Choice Request candidates.

## 5. First-batch migrations

- [x] 5.1 Migrate Mage Wars blocking target/plan/action choices to request-first builders.
- [x] 5.2 Migrate Qidahen map, battle, and post-battle blocking selections to request-first builders where still simple-choice-backed.
- [ ] 5.3 Migrate Betrayal next interaction batch to request-first builders instead of new simple-choice entry points.
  - [x] 5.3a Confirm Betrayal currently has no existing business-level `createSimpleChoice(` migration point; keep the next interaction batch under request-first rules.
- [x] 5.4 Exclude Cardia and TicTacToe from this direct migration batch; keep them as old-project compatibility users.
- [ ] 5.5 Keep Smash Up and Summoner Wars as legacy adapter users, then nominate the first family for later direct cutover.
- [x] 5.6 Migrate the low-risk DiceThrone / 王权骰铸 generic `CHOICE_REQUESTED` bridge to request-owned simple-choice projection without touching bonus dice, response windows, defender selection, or Cardia.

## 6. Verification

- [x] 6.1 Add Choice Request invariant tests for impossible mandatory choices, empty optional choices, ordered selections, stale candidates, and visibility filtering.
- [x] 6.2 Add AI parity tests proving every human-visible first-batch Choice Request candidate maps to an AI legal action or explicit skip/pass/confirm action.
  - [x] 6.2a Add engine semantic projection tests for request-owned interaction AI parity.
  - [x] 6.2b Add Mage Wars and Qidahen first-batch semantic decision parity coverage.
  - [x] 6.2c Add DiceThrone bridge coverage proving projected options preserve value semantics and still produce an executable AI interaction response.
- [x] 6.3 Add missing-policy tests proving AI-owned unsupported requests report diagnostics instead of returning an empty action list.
- [ ] 6.4 Add online recovery tests proving watchdog uses Choice Request diagnostics and does not infer business targets.
- [ ] 6.5 Run focused unit tests, relevant E2E tests for first-batch games, and `openspec validate refactor-choice-request-interface --strict --no-interactive`.
  - [x] 6.5a Run typecheck, focused engine / Mage Wars / Qidahen unit tests, OpenSpec strict validation, and project spec lint.
  - [ ] 6.5b Run or explicitly waive relevant E2E coverage for first-batch UI adapter surfaces.

## 7. Documentation

- [x] 7.1 Update the project interaction standard so Choice Request is the single interface entry.
- [x] 7.2 Re-index simple-choice as a legacy surface / adapter section rather than a parallel framework document.
- [x] 7.3 Record migration status and legacy boundaries without duplicating component-specific docs.
