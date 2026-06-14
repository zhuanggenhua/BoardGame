## 1. OpenSpec

- [x] 1.1 Create the `add-smashup-cowboys-pod` proposal, tasks, and spec deltas
- [x] 1.2 Validate with `openspec validate add-smashup-cowboys-pod --strict --no-interactive`

## 2. POD Faction

- [x] 2.1 Add `COWBOYS_POD` faction id and metadata
- [x] 2.2 Add `cowboys_pod.ts` with explicit faction cards
- [x] 2.3 Register `base_saloon_pod` and `base_so_so_corral_pod`
- [x] 2.4 Reuse existing Cowboys POD aliases and POD base-pool variant selection

## 3. Pecos Bill

- [x] 3.1 Add shared titan data for `pecos_bill`
- [x] 3.2 Add duel-start / duel-resolved shared trigger timings for titan integration
- [x] 3.3 Implement Pecos Bill deploy, protection, draw, and deferred clash behavior

## 4. Locale And Tests

- [x] 4.1 Add locale entries for faction, cards, bases, and titan
- [x] 4.2 Hide base `COWBOYS` from the English picker and expose `COWBOYS_POD`
- [x] 4.3 Extend selection, audit, i18n, base, faction, ongoing, titan, and smoke tests
