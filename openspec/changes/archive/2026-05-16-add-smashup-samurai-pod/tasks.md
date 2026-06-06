## 1. OpenSpec

- [x] 1.1 Create the `add-smashup-samurai-pod` proposal, tasks, and spec delta
- [x] 1.2 Validate with `openspec validate add-smashup-samurai-pod --strict --no-interactive`

## 2. POD Faction

- [x] 2.1 Add `SAMURAI_POD` faction id and metadata
- [x] 2.2 Add `samurai_pod.ts` with explicit faction cards
- [x] 2.3 Register `base_shoguns_palace_pod` and `base_sakura_garden_pod`
- [x] 2.4 Reuse existing Samurai ability aliases and POD base-pool variant selection

## 3. Locale And Visibility

- [x] 3.1 Add locale entries for faction, cards, and bases
- [x] 3.2 Hide base `SAMURAI` from the English picker and expose `SAMURAI_POD`
- [x] 3.3 Align the shared base Samurai English wording with the POD errata wording

## 4. Tests

- [x] 4.1 Extend selection, audit, i18n, base, ongoing, and smoke tests
- [x] 4.2 Run focused validation and mark tasks complete
