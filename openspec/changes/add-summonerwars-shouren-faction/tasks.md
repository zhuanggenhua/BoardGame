## 1. Intake And Contract

- [x] 1.1 Lock source asset dimensions, hashes and `8x2` slot mapping for `hero/shouren`
- [x] 1.2 Record summoner, starting setup, card names, values, rules and tip-name conflicts
- [x] 1.3 Add a Summoner Wars faction intake workflow under `.spec/skills/summonerwars-faction-intake/SKILL.md`

## 2. Static Runtime

- [x] 2.1 Add `shouren` faction ID, `tundra` deck symbol, catalog entry, deck factory and card registry coverage
- [x] 2.2 Add Shouren atlas config, sprite registration and critical image resolver coverage
- [x] 2.3 Add zh-CN/en faction, card ability, interaction and action-log text
- [x] 2.4 Add summoner, units, events, structures, starting setup and AI/audio registration

## 3. Domain Mechanics

- [x] 3.1 Implement 恢复、鲜血羁绊、远射、刺骨冰霜、狂乱打击、北方魔法、迟钝
- [x] 3.2 Implement `pendingAttackRoll`, `ATTACK_ROLL_PENDING`, `RESOLVE_PENDING_ATTACK` and 激励 reroll/keep interaction with AI-visible choices
- [x] 3.3 Implement 血腥急袭 optional self-damage/push-pull chain
- [x] 3.4 Implement 狂暴 and 原始狂怒 push-pull/extra-attack chains with recursion bounds
- [x] 3.5 Implement 冻结 target persistence and domain-wide move/attack/push-pull/target/ability restrictions
- [x] 3.6 Implement 粗暴蛮力/蛮力冲击 and 无上荣耀/鲁莽打击 active-event grants
- [x] 3.7 Add action-log source mapping and lifecycle cleanup for all new effects

## 4. Resources

- [x] 4.1 Generate non-downsampled runtime WebP assets for cards/hero/tip
- [x] 4.2 Rebuild game-level and root i18n manifests and assert Shouren keys exist
- [x] 4.3 Run single-faction server asset precheck, upload, Android index refresh and public HEAD checks

## 5. Verification And Closeout

- [x] 5.1 Add static registration, deck composition, atlas, preload, i18n and card-pool tests
- [x] 5.2 Add L2 tests for every rule clause, including negative and optional-skip paths
- [x] 5.3 Add attack pending-settlement regression tests proving no damage before 激励 resolves
- [x] 5.4 Extend `DiceResultOverlay` for the 激励 pending-roll UI and add a direct real-entry E2E screenshot chain
- [x] 5.5 Add real-entry E2E for faction selection/setup and every remaining new interaction family with screenshot chains
- [x] 5.6 Complete object-level L0-L4 audit evidence, D-dimension matrix, framework-consumer matrix and residual-risk statement
- [x] 5.7 Run targeted Summoner Wars tests, typecheck/lint/i18n/resource gates and completion guard
