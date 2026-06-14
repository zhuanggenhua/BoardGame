## 1. OpenSpec

- [x] 1.1 Create the `add-smashup-ancient-egyptians-pod` proposal, tasks, and spec deltas
- [x] 1.2 Validate with `openspec validate add-smashup-ancient-egyptians-pod --strict --no-interactive`

## 2. POD Faction

- [x] 2.1 Add `ANCIENT_EGYPTIANS_POD` faction id and metadata
- [x] 2.2 Add `ancient_egyptians_pod.ts` with explicit faction cards
- [x] 2.3 Register `base_pyramids_pod` and `base_star_portal_pod`
- [x] 2.4 Wire `factionMeta` visibility and selection behavior

## 3. Sphinx Titan

- [x] 3.1 Add shared titan data for `sphinx`
- [x] 3.2 Implement start-of-turn, after-scoring, and talent behavior
- [x] 3.3 Reuse `sphinx` for POD via titan fallback

## 4. Buried Return Chain

- [x] 4.1 Add `BURIED_CARD_RETURNED_TO_HAND` event type, payload, and helper
- [x] 4.2 Reduce buried-to-hand without discard or uncover
- [x] 4.3 Extend return-to-hand trigger coverage for buried sources

## 5. Locale And Tests

- [x] 5.1 Add locale entries for faction, cards, bases, and titan
- [x] 5.2 Extend selection, audit, i18n, base, ongoing, bury, and smoke tests
- [x] 5.3 Run focused validation and mark tasks complete
