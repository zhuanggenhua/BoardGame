# Kaiju POD implementation audit

## Scope

- Faction: `kaiju_pod`
- Source atlas: user-supplied `4 x 5` PNG, 20 physical card fronts, 14 unique runtime definitions.
- Runtime asset keys: `smashup/cards/kaiju_pod`, `smashup/cards/compressed/kaiju_pod`.
- Exclusions: no POD base art and no POD titan art were supplied, so this implementation reuses ordinary Kaiju base artwork/behavior and the existing `kaiju_gorgodzolla` titan.

## Object-level conclusions

| Object surface | Conclusion |
|---|---|
| card definitions | 14 explicit `_pod` definitions total 20 physical copies and use row-major atlas indexes from the supplied PNG |
| faction registry | `KAIJU_POD` is registered with display name, metadata, locales, cards, preload atlas, and explicit variant binding |
| gameplay behavior | POD cards share ordinary Kaiju handlers through `createVariantProfile(SMASHUP_FACTION_IDS.KAIJU, SMASHUP_FACTION_IDS.KAIJU_POD)`; no copied handler fork |
| bases | POD base pool is limited to `base_tokyo_pod` and `base_kaiju_island_pod`; base art falls back to existing ordinary Kaiju visuals because no POD base art was supplied |
| titan | `kaiju_gorgodzolla` is reused; no duplicate POD titan definition |
| manifests | Smash Up manifest validates; root i18n manifest was key-audited for the two Kaiju POD entries only because unrelated DiceThrone JSON drift blocks full root validation |

## Validation log

| Command | Result |
|---|---|
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/kaijuPodIntegration.test.ts src/games/smashup/__tests__/abilities/kaiju.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/variantBindingRuntime.test.ts src/games/smashup/__tests__/abilityRegistry.test.ts src/games/smashup/__tests__/abilityInteractionRegistry.test.ts src/games/smashup/__tests__/podPowerModifierRegistration.test.ts --configLoader native` | passed: 8 files, 132 tests |
| `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup` | passed |
| root i18n manifest key audit for `zh-CN/smashup/cards/kaiju_pod` and `zh-CN/smashup/cards/compressed/kaiju_pod` | passed: manifest bytes/SHA match on-disk PNG/WebP and Smash Up manifest variants |
| `openspec validate add-smashup-kaiju-pod --strict --no-interactive` | passed |
| `npm run i18n:check` | passed |
| `npm run typecheck` | passed |
| `npm run test:e2e:ci:file -- e2e/smashup/smashup-kaiju-pod.e2e.ts` | passed: 1 test |

## E2E evidence

- `test-results/evidence-screenshots/smashup/smashup-kaiju-pod.e2e/从派系选秀选择-Kaiju-POD-并使用新图集开始对局/01-Kaiju-POD-派系预览.jpg`
- `test-results/evidence-screenshots/smashup/smashup-kaiju-pod.e2e/从派系选秀选择-Kaiju-POD-并使用新图集开始对局/02-Kaiju-POD-开局完成.jpg`

## Upload status

- Dry-run selected exactly one object: `official/i18n/zh-CN/smashup/cards/compressed/kaiju_pod.webp`.
- Real upload was retried after E2E passed, but produced no success output before proxy/tool termination.
- Public check remains blocked: `curl.exe -I --max-time 30 https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/kaiju_pod.webp` returned `404 Not Found` at 2026-08-11 13:59 Asia/Shanghai.
- Delivery implication: the PR includes both source PNG and runtime WebP, but the public asset server still needs an authorized publisher to upload the WebP.
