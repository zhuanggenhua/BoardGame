# Kaiju POD intake and implementation contract

## Scope and conclusion

This contract locks the user-supplied Kaiju POD card atlas before runtime implementation. The source contains exactly 20 valid card fronts in a uniform `4 x 5` grid, representing 14 unique runtime card definitions. It contains no base art, titan art, card back, logo, or empty slot.

## Truth-source contract

| Field | Primary truth source | Comparison source | Ruling |
|---|---|---|---|
| source pixels / slot order / physical copies | user-supplied PNG | manual full-grid inspection | supplied PNG wins |
| card names visible on atlas | user-supplied PNG | ordinary Kaiju data | supplied PNG and ordinary names agree |
| static gameplay fields | ordinary Kaiju card definitions | supplied card faces | reuse only after object-by-object identity check |
| gameplay implementation | ordinary Kaiju ability/runtime suites | variant binding registry | explicit shared binding; no copied handlers |
| POD base art | none supplied | ordinary Kaiju base atlas | use existing art through POD skeletons |
| titan | ordinary Kaiju titan registry | faction fallback | reuse `kaiju_gorgodzolla` |

## Source metadata

| Property | Value |
|---|---|
| source path | `C:/Users/Dqm/.codex/attachments/f382a7f0-a7a3-4b3d-857e-6c0a6659df1c/image-1.png` |
| received / filesystem time (UTC) | `2026-08-10 13:40:16` |
| size | `5,928,968` bytes |
| pixels | `1876 x 2100` |
| SHA-256 | `887F27DDE9579B9BA77E1C67653F9F29A2DA33F76899CBBC479419AD52C901E3` |
| declared / observed grid | `4 rows x 5 columns` |
| observed card fronts | `20` |
| backs / empty / non-card slots | `0 / 0 / 0` |
| formal source path | `public/assets/i18n/zh-CN/smashup/cards/kaiju_pod.png` |
| formal runtime path | `public/assets/i18n/zh-CN/smashup/cards/compressed/kaiju_pod.webp` |
| Smash Up manifest keys | `cards/kaiju_pod`, `cards/compressed/kaiju_pod` |
| root i18n manifest keys | `zh-CN/smashup/cards/kaiju_pod`, `zh-CN/smashup/cards/compressed/kaiju_pod` |
| planned public URL | `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/kaiju_pod.webp` |

## Full-grid scan (row-major)

| Index | Row | Col | Visible object | Runtime family |
|---:|---:|---:|---|---|
| 0 | 0 | 0 | Stomp | `kaiju_stomp` |
| 1 | 0 | 1 | Stomp | `kaiju_stomp` |
| 2 | 0 | 2 | Radioactive Breath | `kaiju_radioactive_breath` |
| 3 | 0 | 3 | Radioactive Breath | `kaiju_radioactive_breath` |
| 4 | 0 | 4 | Radioactive Breath | `kaiju_radioactive_breath` |
| 5 | 1 | 0 | Tail Smash | `kaiju_tail_smash` |
| 6 | 1 | 1 | Wade Through the Buildings | `kaiju_wade_through_the_buildings` |
| 7 | 1 | 2 | Oh, No! | `kaiju_oh_no` |
| 8 | 1 | 3 | Pick Up a Bus | `kaiju_pick_up_a_bus` |
| 9 | 1 | 4 | Pick Up a Bus | `kaiju_pick_up_a_bus` |
| 10 | 2 | 0 | The Folly of Men | `kaiju_the_folly_of_men` |
| 11 | 2 | 1 | Kaiju Conflict | `kaiju_kaiju_conflict` |
| 12 | 2 | 2 | Kaiju Conflict | `kaiju_kaiju_conflict` |
| 13 | 2 | 3 | There Goes Tokyo | `kaiju_there_goes_tokyo` |
| 14 | 2 | 4 | They Say He’s Got to Go | `kaiju_they_say_hes_got_to_go` |
| 15 | 3 | 0 | Kaiju Alliance | `kaiju_kaiju_alliance` |
| 16 | 3 | 1 | Kaiju Alliance | `kaiju_kaiju_alliance` |
| 17 | 3 | 2 | Johnny | `kaiju_johnny` |
| 18 | 3 | 3 | Tiny Priestesses | `kaiju_tiny_priestesses` |
| 19 | 3 | 4 | Kaijookey | `kaiju_kaijookey` |

## Unique runtime object contract

| POD defId | First slot | Count | Ordinary source object | Shared surfaces |
|---|---:|---:|---|---|
| `kaiju_stomp_pod` | 0 | 2 | `kaiju_stomp` | ability / interaction / ongoing / base ability / power modifier |
| `kaiju_radioactive_breath_pod` | 2 | 3 | `kaiju_radioactive_breath` | same |
| `kaiju_tail_smash_pod` | 5 | 1 | `kaiju_tail_smash` | same |
| `kaiju_wade_through_the_buildings_pod` | 6 | 1 | `kaiju_wade_through_the_buildings` | same |
| `kaiju_oh_no_pod` | 7 | 1 | `kaiju_oh_no` | same |
| `kaiju_pick_up_a_bus_pod` | 8 | 2 | `kaiju_pick_up_a_bus` | same |
| `kaiju_the_folly_of_men_pod` | 10 | 1 | `kaiju_the_folly_of_men` | same |
| `kaiju_kaiju_conflict_pod` | 11 | 2 | `kaiju_kaiju_conflict` | same |
| `kaiju_there_goes_tokyo_pod` | 13 | 1 | `kaiju_there_goes_tokyo` | same |
| `kaiju_they_say_hes_got_to_go_pod` | 14 | 1 | `kaiju_they_say_hes_got_to_go` | same |
| `kaiju_kaiju_alliance_pod` | 15 | 2 | `kaiju_kaiju_alliance` | same |
| `kaiju_johnny_pod` | 17 | 1 | `kaiju_johnny` | same |
| `kaiju_tiny_priestesses_pod` | 18 | 1 | `kaiju_tiny_priestesses` | same |
| `kaiju_kaijookey_pod` | 19 | 1 | `kaiju_kaijookey` | same |

Unique definitions: `14`. Physical count sum: `20`.

## Visual contract

- Every runtime `previewRef` uses `SMASHUP_ATLAS_IDS.KAIJU_POD_CARDS`.
- The atlas catalog entry uses `image: 'smashup/cards/kaiju_pod'` and `grid: { rows: 4, cols: 5 }`.
- Repeated physical copies share the first visible slot and use `count`; the runtime does not create duplicate definitions.
- The source and WebP must preserve `1876 x 2100` pixels; runtime compression may change encoding only.
- The generated WebP is `1,393,084` bytes with SHA-256 `F178424B2BB49012FB67FFA743FDAD657E18CF1C3967B0965C7ABE0E6A839DF1`.
- No candidate base atlas is allowed in the formal base asset tree because no POD base image was supplied.

## Shared-chain and boundary contract

| Consumer | Ordinary owner | POD behavior | Evidence owner |
|---|---|---|---|
| card ability registry | Kaiju handlers | shared through variant profile | focused integration + existing Kaiju suites |
| interaction handlers | Kaiju interaction families | shared | variant relation assertions |
| ongoing registry | Kaiju ongoing families | shared | static equivalence + registry tests |
| power modifier registry | Kaiju modifier families | shared | variant relation assertions |
| base abilities | `base_tokyo`, `base_kaiju_island` | shared by `_pod` skeleton IDs | base-pool and English atlas-map assertions |
| base pool | ordinary Kaiju | separate POD IDs only | `getBaseDefIdsForFactions` assertion |
| titan | `kaiju_gorgodzolla` | faction fallback reuse | titan registry assertion |

Ordinary Kaiju is a shared consumer of the same handlers. This change must not alter its definitions, registration count, base pool, or titan identity.

## Conflict and blocker table

| Item | Status | Ruling |
|---|---|---|
| 20 source slots vs 14 definitions | resolved | repeated cards are represented by `count` |
| no POD base artwork | resolved | use automatic `_pod` base skeletons and ordinary art |
| no POD titan artwork/object | resolved | reuse `kaiju_gorgodzolla` |
| upload credentials / remote `HEAD 200` | blocked | dry-run selected only `official/i18n/zh-CN/smashup/cards/compressed/kaiju_pod.webp`; real upload was retried but produced no success output, and public `HEAD` remains `404 Not Found` as of 2026-08-11 13:59 Asia/Shanghai |
| source assets ignored by Git | resolved by user instruction | force-add only `kaiju_pod.png` and `compressed/kaiju_pod.webp` |

## L0-L4 matrix

All 14 card rows share one explicit runtime family relation but retain individual L0/L1 conclusions.

| Objects | L0 source/index | L1 static/registry | L2 behavior | L3 real entry | L4 authoritative state |
|---|---|---|---|---|---|
| 14 Kaiju POD card definitions | passed by full-grid table | passed by focused integration and manifest audit | passed through explicit Kaiju variant profile and ordinary Kaiju suites | passed by faction-picker/start E2E | shared with existing Kaiju chains; no copied handlers |
| 2 POD base skeletons | ordinary art slots locked | passed by base-pool assertions and fallback whitelist update | shared base abilities | passed by match-start render without new POD base art | existing base authoritative state |
| Gorgodzolla | ordinary titan source | passed by titan fallback assertion | unchanged | not duplicated | existing titan authoritative state |

The final audit may claim only the level actually proven by commands and screenshots. The faction-picker E2E is visual/entry evidence and does not replace the ordinary Kaiju gameplay suites; gameplay reuse is accepted only if all shared surfaces resolve through the explicit profile and the POD static fields are equivalent except for identity and preview.

## Validation and delivery evidence

| Area | Result | Evidence |
|---|---|---|
| focused Vitest / shared regressions | passed: 8 files, 132 tests | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/kaijuPodIntegration.test.ts src/games/smashup/__tests__/abilities/kaiju.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/variantBindingRuntime.test.ts src/games/smashup/__tests__/abilityRegistry.test.ts src/games/smashup/__tests__/abilityInteractionRegistry.test.ts src/games/smashup/__tests__/podPowerModifierRegistration.test.ts --configLoader native` |
| Smash Up manifest | passed | `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup` |
| root i18n manifest | key-level Kaiju POD audit passed; full validate blocked by unrelated DiceThrone local JSON drift | audited only `zh-CN/smashup/cards/kaiju_pod` and `zh-CN/smashup/cards/compressed/kaiju_pod` against on-disk bytes/SHA |
| OpenSpec | passed | `openspec validate add-smashup-kaiju-pod --strict --no-interactive` |
| i18n | passed | `npm run i18n:check` |
| typecheck | passed | `npm run typecheck` |
| real entry E2E | passed: 1 test | `npm run test:e2e:ci:file -- e2e/smashup/smashup-kaiju-pod.e2e.ts` |
| E2E screenshots | captured | `test-results/evidence-screenshots/smashup/smashup-kaiju-pod.e2e/从派系选秀选择-Kaiju-POD-并使用新图集开始对局/01-Kaiju-POD-派系预览.jpg`; `.../02-Kaiju-POD-开局完成.jpg` |
| upload dry-run | passed | selected exactly `official/i18n/zh-CN/smashup/cards/compressed/kaiju_pod.webp` |
| real upload | blocked | retry produced no success output before proxy/tool termination; public `curl.exe -I --max-time 30 https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/kaiju_pod.webp` returned `404 Not Found` |

## Implementation handoff

- Add `KAIJU_POD_CARDS` and `KAIJU_POD` constants.
- Add the `4 x 5` atlas catalog entry.
- Add `kaiju_pod.ts` with the 14 rows above.
- Register the cards and add the Kaiju variant profile.
- Add faction metadata and locale entries.
- Prove automatic POD bases are `base_tokyo_pod` and `base_kaiju_island_pod`; do not hand-author base art.
- Prove titan fallback returns only `kaiju_gorgodzolla`.
- Rebuild both manifests, upload only the WebP, and run a public URL check.
- Add focused Vitest and real faction selection/match-start E2E with a checked screenshot.
