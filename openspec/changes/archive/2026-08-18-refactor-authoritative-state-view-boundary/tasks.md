## 1. Proposal Gate
- [x] 1.1 Review and approve this OpenSpec proposal before implementation.
- [x] 1.2 Confirm this is a DomainCore boundary cleanup, not a new generic value framework.

## 2. Reference Alignment
- [x] 2.1 Record the relevant boardgame.io pattern: moves mutate game state; playerView only tailors state for a player.
- [x] 2.2 Record the relevant Colyseus pattern: clients request changes; server/room mutates authoritative state; clients listen.
- [x] 2.3 Record the relevant OpenRA pattern: orders drive deterministic world state; render/local visual state is separate from synced gameplay state.
- [x] 2.4 Translate the references into BoardGame terms: command/event/reducer writes; playerView/UI selector reads; AI hint and animation state stay non-authoritative.
- [x] 2.5 Record the relevant duolafashi1 pattern: data objects own HP/final damage; damage entry computes and writes formal values; UI syncs or reads results without writing back.

## 3. DiceThrone Boundary Audit
- [x] 3.1 Enumerate every reader and writer of displayed damage, pending attack damage, pending damage response values, bonus dice results, direct damage, prevention, evasion, and final HP loss.
- [x] 3.2 Classify each reader as rule write, rule validation, final reducer, player-visible selector, animation/log display, AI scoring, or test/debug helper.
- [x] 3.3 Identify any path where UI selector, AI estimate, animation value, or debug/test helper can influence rule validation, response settlement, or final HP loss.
- [x] 3.4 Decide whether each issue is fixed by existing DomainCore wiring, a DiceThrone-local helper, or a later shared helper candidate.

## 4. DiceThrone Fix Sample
- [x] 4.1 Add negative regression: player-visible damage summary does not call AI-only damage estimates.
- [x] 4.2 Verify Tree Treant Wild Roar II regression: displayed current damage, bonus dice settlement, and final HP loss come from the same rule path.
- [x] 4.3 Add CP-based custom action regression: AI / rule-gating estimate does not affect player-visible damage or final settlement.
- [x] 4.4 Add Token response regression: before-damage boost/reduction updates the same pending rule state consumed by final settlement.
- [x] 4.5 Add direct damage regression: direct damage during an in-progress attack does not change attack damage or onHit basis.
- [x] 4.6 Add prevention/evasion regression: prevention is not encoded as negative attack bonus, and zero HP loss does not erase required hit basis.
- [x] 4.7 Repair only the proven overreach paths; do not introduce a generic cross-game value framework.
- [x] 4.8 Repair DiceThrone damage display timing: reducer writes formal HP loss first, then animation/log consume the reducer-set `actualDamage` without shield or estimate recomputation.

## 5. Betrayal Dice Guardrail Sample
- [x] 5.1 Verify representative event/trait roll coverage where committed roll state drives the branch.
- [x] 5.2 Verify reroll item coverage where the committed reroll result drives the final branch.
- [x] 5.3 Verify monster movement roll coverage where committed movement dice drive formal movement.
- [x] 5.4 Document whether `betrayal` current pending roll structure already satisfies the boundary, or needs a follow-up proposal.

## 6. Documentation And Validation
- [x] 6.1 Update the closest state pipeline standard with the DomainCore write / selector read / AI hint isolation rule.
- [x] 6.2 Update DiceThrone damage-pipeline documentation only for DiceThrone-specific fallout.
- [x] 6.3 Avoid adding new shared primitives unless two real games need the same helper.
- [x] 6.4 Run `openspec validate refactor-authoritative-state-view-boundary --strict --no-interactive`.
- [x] 6.5 Run targeted DiceThrone and representative Betrayal regression tests before implementation closeout.

Implementation note:
- DiceThrone audit 3.1-3.4 covered `domain/`, `hooks/`, `ui/`, `Board.tsx`, and `game.ts` damage terms. Rule writes are `reduceCombat`, `tokenResponse` / `executeTokens`, bonus-dice settlement, effects/custom actions, and status events; validation reads are command validation, token usability, and pending attack helpers; player-visible reads are `damageSummary`, Board / right rail / Nyra UI; animation/log reads are `useAnimationEffects` and action log formatting; AI estimates stay in `abilityLookup` / flow gate usage. The only new overreach found in this pass was postDamage prevention filtering all damage events; it is fixed by a DiceThrone-local filter that removes only prevented defender damage, preserving attacker self-damage and other onHit follow-ups.
- DiceThrone regressions 4.4-4.6 are covered in `damage-tracking-regression.test.ts`: Token boost/reduction final settlement, direct damage during pending attack, PREVENT_DAMAGE state ownership, reducer-filled net HP loss, and evasion onHit follow-up damage.
- Betrayal representative tests already cover committed event/trait dice, reroll final branch, and monster movement dice. No shared helper was extracted because the second game did not require the same new code shape.
