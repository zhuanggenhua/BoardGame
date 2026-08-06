## 1. Design Gate

- [x] 1.1 Read current project rules, OpenSpec context, new-game skill gates, and `betrayal` rule sources.
- [x] 1.2 Identify the current failing pattern:基础规则语义未先转成交互覆盖合同。
- [x] 1.3 Create the OpenSpec change boundary for interaction redesign.
- [x] 1.4 Create the first interaction coverage matrix for `betrayal`.
- [x] 1.5 Expand P0 entries into player flow, state truth, UI carrier, and verification contracts.
- [x] 1.6 Create the full rule interaction redesign ledger covering base rule sections and official-rulebook supplemental details.
- [x] 1.7 Create the 50-haunt directory-level redesign index and mark representative / contract-pending status.
- [x] 1.8 Create the 50-haunt official source-page mapping and correct the source-blocked vs contract-pending boundary.
- [x] 1.9 Add room discovery symbol mapping as a required rule contract before implementation.

## 2. Review Before Implementation

- [ ] 2.1 Confirm the full rule ledger scope with the user.
- [ ] 2.2 Confirm the P0 implementation slice and which items may remain representative-only.
- [ ] 2.3 Split implementation into small passes after design approval.
- [x] 2.4 Create per-haunt sub-ledgers under `docs/games/betrayal/haunts/` before claiming any haunt complete.
- [ ] 2.5 Confirm the room symbol refactor slice: room catalog symbols, explore draw consumption, tutorial explanation, and regression evidence.
- [ ] 2.5.1 Re-enter S0 data contract for room tiles: extract rule-defined fields first, including floor/back area, doorway topology, printed discovery symbol, room text/effect, source evidence, and blocked/disputed fields.

## 3. Implementation Plan After Approval

- [x] 3.1 Implement setup and scenario selection contract.
- [x] 3.2 Implement trait track data model and migration helpers.
- [x] 3.3 Implement haunt risk status and UI affordance.
- [x] 3.4 Implement room placement / orientation interaction.
- [ ] 3.4.1 After S0 room contract is locked, refactor room discovery to consume room tile symbol data instead of runtime draw-order assignment.
- [ ] 3.5 Rework tests around the interaction coverage matrix.
- [ ] 3.6 Implement trade, special action, attack, corpse, obstacle, and monster contracts.
- [ ] 3.7 Run agreed validation and update both ledgers with evidence.
