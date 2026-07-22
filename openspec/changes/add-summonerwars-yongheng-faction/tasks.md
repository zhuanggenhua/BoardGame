## 1. Intake And Contract

- [x] 1.1 Lock source asset dimensions, hashes and `8x2` slot mapping for `hero/yongheng`
- [x] 1.2 Record summoner, starting setup, card names, values, rules and empty slots
- [x] 1.3 Build object-level rule clause and visual contract evidence

## 2. Static Runtime

- [x] 2.1 Add `yongheng` faction ID, deck symbols, catalog entry, deck factory and card registry coverage
- [x] 2.2 Add Yongheng atlas config, sprite registration and critical image resolver coverage
- [x] 2.3 Add zh-CN/en faction, card ability, interaction and action-log text
- [x] 2.4 Add summoner, units, events, structures, starting setup and AI/audio registration

## 3. Domain Mechanics

- [x] 3.1 Implement 动能虹吸、情报、智慧、分析、探寻 and phase-start card draw effects
- [x] 3.2 Implement 唤起恐惧、惩戒 and attack/summon discard pressure
- [x] 3.3 Implement 警告、运用 and hand-to-deck-bottom targeting/damage/push-pull effects
- [x] 3.4 Implement 洞察 / 学习 / 坚毅 / 谋划 / 力量强化 charge and strength modifiers
- [x] 3.5 Implement 延续 event retention when a continuous event would be discarded

## 4. Resources

- [x] 4.1 Generate non-downsampled runtime WebP assets for cards/hero/tip
- [x] 4.2 Rebuild game-level and root i18n manifests and assert Yongheng keys exist
- [x] 4.3 Run single-faction server asset precheck, upload, Android index refresh and public HEAD checks

## 5. Verification And Closeout

- [x] 5.1 Add/update static registration, deck composition, atlas, preload, i18n and card-pool tests
- [x] 5.2 Add L2 tests for every rule clause, including negative and optional-skip paths
- [x] 5.3 Add real-entry E2E for faction selection/setup and each new interaction family with screenshot chains
- [x] 5.4 Complete object-level L0-L4 audit evidence, D-dimension matrix, framework-consumer matrix and residual-risk statement
- [x] 5.5 Run targeted Summoner Wars tests, ESLint/typecheck/i18n/resource gates and completion guard

Current scoped note: Yongheng object scope is closed through L0-L4. Targeted ESLint passed with 0 errors, targeted Vitest passed 68/68, full Yongheng E2E passed 7/7 with 19 screenshot artifacts, and `npx openspec validate add-summonerwars-yongheng-faction --strict --no-interactive` reports the change valid. The only known resource-manifest residual is a non-Yongheng historical Betrayal root-manifest baseline debt.
