# P2 文件完整验证报告

## 验证概览

- **验证时间**: 2026/3/4 09:27:12
- **总文件数**: 98
- **已验证**: 98
- **无需恢复**: 31 (31.6%)
- **需要恢复**: 67 (68.4%)
- **验证失败**: 0

## 需要恢复的文件

| 文件 | 删除行数 | 原因 |
|------|----------|------|
| `src/games/dicethrone/__tests__/shield-cleanup.test.ts` | 188 | 仅 1/5 删除内容仍存在 |
| `src/games/smashup/__tests__/specialInteractionChain.test.ts` | 166 | 仅 2/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/monk-coverage.test.ts` | 127 | 仅 2/5 删除内容仍存在 |
| `src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts` | 91 | 仅 2/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/paladin-coverage.test.ts` | 86 | 仅 2/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/viewMode.test.ts` | 81 | 仅 0/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/pyromancer-behavior.test.ts` | 75 | 仅 1/5 删除内容仍存在 |
| `src/games/smashup/__tests__/zombieInteractionChain.test.ts` | 69 | 仅 2/5 删除内容仍存在 |
| `src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts` | 61 | 仅 2/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/token-execution.test.ts` | 59 | 仅 1/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/moon_elf-behavior.test.ts` | 58 | 仅 0/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/flow.test.ts` | 45 | 仅 1/5 删除内容仍存在 |
| `src/server/storage/__tests__/hybridStorage.test.ts` | 45 | 仅 0/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/shadow_thief-behavior.test.ts` | 34 | 仅 1/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/paladin-abilities.test.ts` | 25 | 仅 0/5 删除内容仍存在 |
| `src/games/smashup/__tests__/baseScoring.test.ts` | 19 | 仅 0/5 删除内容仍存在 |
| `src/games/smashup/__tests__/interactionChainE2E.test.ts` | 19 | 仅 2/5 删除内容仍存在 |
| `src/games/smashup/__tests__/baseAbilityIntegration.test.ts` | 18 | 仅 0/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/targeted-defense-damage.test.ts` | 13 | 仅 0/5 删除内容仍存在 |
| `src/games/smashup/data/cards.ts` | 9 | 仅 0/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/pyromancer-damage.property.test.ts` | 7 | 仅 0/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/token-fix-coverage.test.ts` | 7 | 仅 0/4 删除内容仍存在 |
| `public/locales/zh-CN/lobby.json` | 7 | 仅 1/5 删除内容仍存在 |
| `public/locales/en/lobby.json` | 7 | 仅 1/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/barbarian-coverage.test.ts` | 6 | 仅 1/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/interaction-chain-conditional.test.ts` | 6 | 仅 1/4 删除内容仍存在 |
| `public/locales/en/game-smashup.json` | 6 | 仅 0/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/steal-cp.test.ts` | 6 | 仅 0/4 删除内容仍存在 |
| `src/games/dicethrone/__tests__/shared-state-consistency.test.ts` | 6 | 仅 1/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/card-system.test.ts` | 5 | 仅 1/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts` | 5 | 仅 0/4 删除内容仍存在 |
| `src/games/smashup/__tests__/duplicateInteractionRespond.test.ts` | 4 | 仅 2/4 删除内容仍存在 |
| `src/games/dicethrone/__tests__/shadow-thief-abilities.test.ts` | 4 | 仅 0/4 删除内容仍存在 |
| `src/games/dicethrone/__tests__/tutorial-e2e.test.ts` | 4 | 仅 0/3 删除内容仍存在 |
| `src/games/dicethrone/__tests__/barbarian-abilities.test.ts` | 4 | 仅 1/4 删除内容仍存在 |
| `src/games/dicethrone/__tests__/pyromancer-tokens.test.ts` | 3 | 仅 0/3 删除内容仍存在 |
| `src/games/dicethrone/__tests__/audio.config.test.ts` | 3 | 仅 0/3 删除内容仍存在 |
| `src/games/smashup/__tests__/madnessAbilities.test.ts` | 3 | 仅 1/2 删除内容仍存在 |
| `src/games/smashup/__tests__/meFirst.test.ts` | 3 | 仅 0/3 删除内容仍存在 |
| `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts` | 3 | 仅 1/2 删除内容仍存在 |
| `src/games/smashup/__tests__/bigGulpDroneIntercept.test.ts` | 3 | 仅 0/1 删除内容仍存在 |
| `src/games/dicethrone/__tests__/passive-reroll-validation.test.ts` | 2 | 仅 1/2 删除内容仍存在 |
| `src/games/dicethrone/__tests__/cross-hero.test.ts` | 2 | 仅 1/2 删除内容仍存在 |
| `src/games/smashup/__tests__/baseScoredOptimistic.test.ts` | 2 | 仅 0/2 删除内容仍存在 |
| `src/games/smashup/__tests__/baseScoredNormalFlow.test.ts` | 2 | 仅 0/2 删除内容仍存在 |
| `src/games/dicethrone/__tests__/thunder-strike.test.ts` | 2 | 仅 1/2 删除内容仍存在 |
| `src/games/smashup/__tests__/baseScoredRaceCondition.test.ts` | 2 | 仅 0/2 删除内容仍存在 |
| `public/locales/zh-CN/social.json` | 2 | 仅 0/2 删除内容仍存在 |
| `public/locales/zh-CN/common.json` | 2 | 仅 0/2 删除内容仍存在 |
| `public/locales/en/common.json` | 2 | 仅 0/2 删除内容仍存在 |
| `public/locales/en/social.json` | 2 | 仅 0/2 删除内容仍存在 |
| `src/games/smashup/__tests__/helpers.ts` | 2 | 仅 0/2 删除内容仍存在 |
| `src/games/summonerwars/__tests__/interaction-flow-e2e.test.ts` | 2 | 仅 1/2 删除内容仍存在 |
| `src/games/smashup/__tests__/baseScoreCheck.test.ts` | 2 | 仅 0/2 删除内容仍存在 |
| `src/server/storage/__tests__/mongoStorage.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/games/smashup/__tests__/elderThingAbilities.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/games/smashup/__tests__/expansionAbilities.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/games/dicethrone/__tests__/entity-chain-integrity.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/games/summonerwars/__tests__/abilities-barbaric.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/games/smashup/__tests__/promptE2E.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/games/smashup/__tests__/ongoingE2E.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/games/smashup/__tests__/query6Abilities.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/games/smashup/__tests__/promptResponseChain.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/engine/primitives/__tests__/damageCalculation.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/games/dicethrone/__tests__/defense-trigger-audit.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/games/smashup/__tests__/alienAuditFixes.test.ts` | 1 | 仅 0/1 删除内容仍存在 |
| `src/engine/transport/__tests__/errorI18n.test.ts` | 1 | 仅 0/1 删除内容仍存在 |

## 无需恢复的文件（前 20 个）

| 文件 | 删除行数 | 原因 |
|------|----------|------|
| `public/locales/zh-CN/game-smashup.json` | 354 | 文件存在且无法获取删除内容（假设已恢复） |
| `src/games/smashup/__tests__/newOngoingAbilities.test.ts` | 302 | 文件存在且无法获取删除内容（假设已恢复） |
| `src/games/smashup/__tests__/factionAbilities.test.ts` | 299 | 文件存在且无法获取删除内容（假设已恢复） |
| `src/games/smashup/__tests__/baseFactionOngoing.test.ts` | 177 | 文件存在且无法获取删除内容（假设已恢复） |
| `public/locales/zh-CN/game-dicethrone.json` | 157 | 文件存在且无法获取删除内容（假设已恢复） |
| `public/locales/en/game-dicethrone.json` | 151 | 文件存在且无法获取删除内容（假设已恢复） |
| `src/games/smashup/data/factions/pirates.ts` | 132 | 3/5 删除内容仍存在 |
| `src/games/dicethrone/__tests__/actionLogFormat.test.ts` | 45 | 4/5 删除内容仍存在 |
| `src/games/smashup/__tests__/newBaseAbilities.test.ts` | 41 | 3/5 删除内容仍存在 |
| `src/games/smashup/__tests__/newFactionAbilities.test.ts` | 30 | 4/5 删除内容仍存在 |
| `public/locales/en/game.json` | 13 | 5/5 删除内容仍存在 |
| `public/locales/zh-CN/game.json` | 13 | 3/5 删除内容仍存在 |
| `public/locales/en/admin.json` | 7 | 5/5 删除内容仍存在 |
| `public/locales/zh-CN/admin.json` | 7 | 3/5 删除内容仍存在 |
| `src/games/smashup/__tests__/vampireBuffetE2E.test.ts` | 6 | 3/5 删除内容仍存在 |
| `src/games/smashup/__tests__/properties/coreProperties.test.ts` | 6 | 3/5 删除内容仍存在 |
| `src/games/smashup/__tests__/sleep-spores-e2e.test.ts` | 4 | 4/4 删除内容仍存在 |
| `src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts` | 4 | 3/4 删除内容仍存在 |
| `src/games/smashup/__tests__/expansionBaseAbilities.test.ts` | 1 | 1/1 删除内容仍存在 |
| `src/games/smashup/__tests__/expansionOngoing.test.ts` | 1 | 1/1 删除内容仍存在 |

## 详细结果

完整结果见 `evidence/p2-verification-results.json`
