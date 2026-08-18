# Choice Request Migration Ledger

This ledger records the current blocking-choice families for the first refactor slice. It is family-level on purpose: migration should follow rule-choice responsibility, not one document per UI component or one line per helper call.

## Current simple-choice footprint

Count source: business-level `createSimpleChoice(` calls under `src/games/<gameId>/`, excluding system installation such as `createSimpleChoiceSystem()` and engine test facades.

| Game | Current calls | Migration stance |
| --- | ---: | --- |
| Smash Up | 655 | Heavy legacy user. Keep legacy adapter, then cut over one interaction family at a time. |
| Summoner Wars | 127 | Heavy legacy user. Keep legacy adapter, then cut over simple-choice / multistep families later. |
| Qidahen | 23 | First-batch request-first migration candidate. |
| DiceThrone | 1 generic choice bridge | Low-risk `CHOICE_REQUESTED` bridge migrated for DiceThrone / 王权骰铸; bonus dice, response windows, and defender selection remain dedicated paths. |
| Mage Wars | 5 | First-batch request-first migration candidate. |
| Cardia | 0 remaining business calls | Old-project compatibility user. Do not migrate in this change. |
| TicTacToe | 0 business calls | Old/simple compatibility user. No business-level migration in this change. |

## Choice families

| Family | Current surface | First-batch owner | Candidate source | AI policy owner | Skip / confirm behavior | Migration action |
| --- | --- | --- | --- | --- | --- | --- |
| Generic modal option choice | `simple-choice` | Engine adapter | `ChoiceRequest.candidates` projected to prompt options | shared policy when branch choice is non-strategic; game policy otherwise | explicit `recoveryAction` for skip/pass/cancel | Implemented thin adapter in this slice. |
| DiceThrone / 王权骰铸 generic choice event | `CHOICE_REQUESTED` -> `simple-choice` bridge | DiceThrone narrow bridge | existing event options projected as `ChoiceRequest.candidates` | existing DiceThrone option scorer over the same projected options | current mandatory option selection; no new watchdog target guessing | Migrated to request-owned simple-choice projection without changing dice / response / defender paths. |
| Direct board / field target choice | board highlights, source-target prompt, simple-choice fallback | Engine + game adapter | `ChoiceRequest.candidates` with stable object IDs | game policy for strategic targets | skip/pass only when request declares it | Next UI adapter slice; Smash Up stays legacy until family cutover. |
| Dice confirm / reroll | DiceThrone right-side dice controls and AI legal actions | DiceThrone reference | dice state / pending settlement | DiceThrone policy | confirm-current or reroll actions | Use as reference for Choice Request confirm-current shape; no immediate rewrite. |
| Mage Wars target / plan / action choice | `simple-choice` in `domain/systems.ts` | Mage Wars | spell/action/target candidates | Mage Wars policy for targets; shared policy for confirm/pass | phase-specific | First game migration after engine slice. |
| Qidahen map / battle / post-battle choice | `simple-choice` builders | Qidahen | map region, battle result, post-battle candidates | Qidahen policy | explicit skip/confirm depending on rule | First game migration after engine slice. |
| Betrayal next interaction batch | new code should not add naked `createSimpleChoice` | Betrayal | rule ledger / room / haunt candidates | game policy or unsupported declaration | rule-specific | Request-first only for new batch. |
| Smash Up scoring source-target choice | field direct selection and prompt handlers | Smash Up deferred | source object + target object pairs | Smash Up policy | no watchdog target guessing | First later heavy-user family candidate. |
| Summoner Wars interaction choices | simple-choice / multistep | Summoner Wars deferred | unit/card/space candidates | Summoner Wars policy | rule-specific | Later family cutover. |

## Direct-cut boundaries

- New games and first-batch in-progress games use `ChoiceRequest` as the business-choice source.
- `simple-choice` may render a request through the adapter, but cannot own candidate truth, AI strategy, permission, or recovery.
- Cardia and TicTacToe stay outside this direct-cut batch as old-project compatibility users.
- Heavy legacy games are not rewritten wholesale. Each later family must list its old external contract, cut all consumers in that family to Choice Request, then remove the old owner for that family.
