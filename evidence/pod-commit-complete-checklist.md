# POD 提交完整文件清单（逐个排查用）

## 生成时间
2026-03-03

---

## 总体统计

- **总文件数**: 336
- **总删除行数**: 9580
- **总新增行数**: 9026

---

## 按类别统计

| 类别 | 文件数 | 删除行数 | 是否应该修改 | 审计状态 |
|------|--------|----------|--------------|----------|| DiceThrone | 105 | 3148 | NO | ⚠️ 部分（1.5/105） |
| SmashUp-Existing | 99 | 3080 | NO |  未审计 |
| Other | 23 | 884 | MAYBE |  未审计 |
| Engine | 20 | 886 | NO | ⚠️ 部分（18/20） |
| SmashUp-POD | 20 | 0 | YES |  未审计 |
| SummonerWars | 18 | 169 | NO |  未审计 |
| i18n | 16 | 732 | MAYBE |  未审计 |
| Components | 11 | 131 | MAYBE |  未审计 |
| Server | 6 | 144 | NO |  部分（1/6） |
| Framework | 5 | 253 | NO |  未审计 |
| Lib | 4 | 82 | MAYBE |  未审计 |
| Context | 3 | 5 | MAYBE |  未审计 |
| Common | 3 | 42 | MAYBE |  未审计 |
| TicTacToe | 2 | 15 | NO |  未审计 |
| Hooks | 1 | 9 | MAYBE |  未审计 |

---

## 详细文件清单（按类别分组）

> 说明：
> -  **应该修改**：POD 相关的文件
> -  **不应该修改**：非 POD 相关的文件
> - ⚠️ **需要判断**：可能包含 POD 和非 POD 混合的修改
> - 🔴 **高优先级**：删除行数 > 100
> - 🟡 **中优先级**：删除行数 50-100
> - 🟢 **低优先级**：删除行数 < 50

---
### DiceThrone (105 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
| 🔴 | ❌ | 12 | 246 | -234 | `src/games/dicethrone/game.ts` |  |
| 🔴 | ❌ | 62 | 210 | -148 | `src/games/dicethrone/hooks/useAnimationEffects.ts` |  |
| 🔴 | ❌ | 0 | 188 | -188 | `src/games/dicethrone/__tests__/shield-cleanup.test.ts` |  |
| 🔴 | ❌ | 14 | 172 | -158 | `src/games/dicethrone/domain/rules.ts` |  |
| 🔴 | ❌ | 28 | 133 | -105 | `src/games/dicethrone/Board.tsx` |  |
| 🔴 | ❌ | 0 | 127 | -127 | `src/games/dicethrone/__tests__/monk-coverage.test.ts` |  |
| 🔴 | ❌ | 13 | 112 | -99 | `src/games/dicethrone/domain/reduceCombat.ts` |  |
| 🔴 | ❌ | 32 | 104 | -72 | `src/games/dicethrone/domain/flowHooks.ts` |  |
|  | ❌ | 1 | 86 | -85 | `src/games/dicethrone/__tests__/paladin-coverage.test.ts` |  |
|  | ❌ | 0 | 81 | -81 | `src/games/dicethrone/__tests__/viewMode.test.ts` |  |
|  | ❌ | 0 | 77 | -77 | `src/games/dicethrone/debug-config.tsx` |  |
|  | ❌ | 82 | 76 | 6 | `src/games/dicethrone/heroes/paladin/abilities.ts` |  |
|  | ❌ | 6 | 75 | -69 | `src/games/dicethrone/__tests__/pyromancer-behavior.test.ts` |  |
|  | ❌ | 3 | 66 | -63 | `src/games/dicethrone/ui/RightSidebar.tsx` |  |
|  | ❌ | 27 | 61 | -34 | `src/games/dicethrone/domain/customActions/shadow_thief.ts` |  |
|  | ❌ | 63 | 61 | 2 | `src/games/dicethrone/ui/PlayerStats.tsx` |  |
|  | ❌ | 28 | 59 | -31 | `src/games/dicethrone/__tests__/token-execution.test.ts` |  |
|  | ❌ | 26 | 58 | -32 | `src/games/dicethrone/__tests__/moon_elf-behavior.test.ts` |  |
|  | ❌ | 7 | 56 | -49 | `src/games/dicethrone/ui/AbilityOverlays.tsx` |  |
|  | ❌ | 21 | 55 | -34 | `src/games/dicethrone/ui/GameHints.tsx` |  |
|  | ❌ | 3 | 47 | -44 | `src/games/dicethrone/domain/index.ts` |  |
|  | ❌ | 4 | 46 | -42 | `src/games/dicethrone/domain/commandValidation.ts` |  |
|  | ❌ | 0 | 45 | -45 | `src/games/dicethrone/__tests__/actionLogFormat.test.ts` |  |
|  | ❌ | 3 | 45 | -42 | `src/games/dicethrone/__tests__/flow.test.ts` |  |
|  | ❌ | 2 | 37 | -35 | `src/games/dicethrone/domain/effects.ts` |  |
|  | ❌ | 21 | 37 | -16 | `src/games/dicethrone/heroes/shadow_thief/abilities.ts` |  |
|  | ❌ | 42 | 36 | 6 | `src/games/dicethrone/domain/customActions/moon_elf.ts` |  |
|  | ❌ | 0 | 34 | -34 | `src/games/dicethrone/domain/utils.ts` |  |
|  | ❌ | 1 | 34 | -33 | `src/games/dicethrone/__tests__/shadow_thief-behavior.test.ts` |  |
|  | ❌ | 2 | 33 | -31 | `src/games/dicethrone/domain/attack.ts` |  |
|  | ❌ | 2 | 31 | -29 | `src/games/dicethrone/domain/reducer.ts` |  |
|  | ❌ | 1 | 30 | -29 | `src/games/dicethrone/heroes/pyromancer/abilities.ts` |  |
|  | ❌ | 14 | 29 | -15 | `src/games/dicethrone/domain/customActions/pyromancer.ts` |  |
|  | ❌ | 0 | 29 | -29 | `src/games/dicethrone/domain/characters.ts` |  |
|  | ❌ | 13 | 28 | -15 | `src/games/dicethrone/ui/DiceTray.tsx` |  |
|  | ❌ | 13 | 26 | -13 | `src/games/dicethrone/ui/LeftSidebar.tsx` |  |
|  | ❌ | 12 | 25 | -13 | `src/games/dicethrone/__tests__/paladin-abilities.test.ts` |  |
|  | ❌ | 0 | 25 | -25 | `src/games/dicethrone/domain/ids.ts` |  |
|  | ❌ | 4 | 24 | -20 | `src/games/dicethrone/ui/BoardOverlays.tsx` |  |
|  | ❌ | 1 | 22 | -21 | `src/games/dicethrone/domain/core-types.ts` |  |
|  | ❌ | 7 | 22 | -15 | `src/games/dicethrone/heroes/barbarian/abilities.ts` |  |
|  | ❌ | 1 | 19 | -18 | `src/games/dicethrone/domain/events.ts` |  |
|  | ❌ | 2 | 18 | -16 | `src/games/dicethrone/ui/viewMode.ts` |  |
|  | ❌ | 6 | 17 | -11 | `src/games/dicethrone/hooks/useAttackShowcase.ts` |  |
|  | ❌ | 7 | 16 | -9 | `src/games/dicethrone/ui/DiceThroneHeroSelection.tsx` |  |
|  | ❌ | 1 | 16 | -15 | `src/games/dicethrone/domain/tokenTypes.ts` |  |
|  | ❌ | 4 | 15 | -11 | `src/games/dicethrone/domain/abilityLookup.ts` |  |
|  | ❌ | 4 | 15 | -11 | `src/games/dicethrone/domain/execute.ts` |  |
|  | ❌ | 1 | 14 | -13 | `src/games/dicethrone/domain/systems.ts` |  |
|  | ❌ | 11 | 13 | -2 | `src/games/dicethrone/__tests__/targeted-defense-damage.test.ts` |  |
|  | ❌ | 8 | 12 | -4 | `src/games/dicethrone/ui/HeroSelectionOverlay.tsx` |  |
|  | ❌ | 1 | 11 | -10 | `src/games/dicethrone/domain/tokenResponse.ts` |  |
|  | ❌ | 0 | 10 | -10 | `src/games/dicethrone/tutorial.ts` |  |
|  | ❌ | 1 | 8 | -7 | `src/games/dicethrone/ui/fxSetup.ts` |  |
|  | ❌ | 8 | 8 | 0 | `src/games/dicethrone/heroes/moon_elf/abilities.ts` |  |
|  | ❌ | 4 | 7 | -3 | `src/games/dicethrone/__tests__/pyromancer-damage.property.test.ts` |  |
|  | ❌ | 6 | 7 | -1 | `src/games/dicethrone/__tests__/token-fix-coverage.test.ts` |  |
|  | ❌ | 4 | 6 | -2 | `src/games/dicethrone/__tests__/barbarian-coverage.test.ts` |  |
|  | ❌ | 23 | 6 | 17 | `src/games/dicethrone/__tests__/shared-state-consistency.test.ts` |  |
|  | ❌ | 0 | 6 | -6 | `src/games/dicethrone/domain/commands.ts` |  |
|  | ❌ | 6 | 6 | 0 | `src/games/dicethrone/__tests__/steal-cp.test.ts` |  |
|  | ❌ | 3 | 6 | -3 | `src/games/dicethrone/__tests__/interaction-chain-conditional.test.ts` |  |
|  | ❌ | 1 | 5 | -4 | `src/games/dicethrone/ui/OpponentHeader.tsx` |  |
|  | ❌ | 3 | 5 | -2 | `src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts` |  |
|  | ❌ | 0 | 5 | -5 | `src/games/dicethrone/ui/CenterBoard.tsx` |  |
|  | ❌ | 0 | 5 | -5 | `src/games/dicethrone/latencyConfig.ts` |  |
|  | ❌ | 2 | 5 | -3 | `src/games/dicethrone/heroes/moon_elf/tokens.ts` |  |
|  | ❌ | 3 | 5 | -2 | `src/games/dicethrone/__tests__/card-system.test.ts` |  |
|  | ❌ | 4 | 4 | 0 | `src/games/dicethrone/__tests__/barbarian-abilities.test.ts` |  |
|  | ❌ | 0 | 4 | -4 | `src/games/dicethrone/__tests__/tutorial-e2e.test.ts` |  |
|  | ❌ | 32 | 4 | 28 | `src/games/dicethrone/audio.config.ts` |  |
|  | ❌ | 1 | 4 | -3 | `src/games/dicethrone/ui/TokenResponseModal.tsx` |  |
|  | ❌ | 4 | 4 | 0 | `src/games/dicethrone/__tests__/shadow-thief-abilities.test.ts` |  |
|  | ❌ | 4 | 4 | 0 | `src/games/dicethrone/heroes/pyromancer/tokens.ts` |  |
|  | ❌ | 3 | 4 | -1 | `src/games/dicethrone/domain/executeCards.ts` |  |
|  | ❌ | 4 | 4 | 0 | `src/games/dicethrone/heroes/monk/cards.ts` |  |
|  | ❌ | 3 | 3 | 0 | `src/games/dicethrone/domain/customActions/barbarian.ts` |  |
|  | ❌ | 3 | 3 | 0 | `src/games/dicethrone/__tests__/audio.config.test.ts` |  |
|  | ❌ | 1 | 3 | -2 | `src/games/dicethrone/domain/customActions/paladin.ts` |  |
|  | ❌ | 1 | 3 | -2 | `src/games/dicethrone/domain/view.ts` |  |
|  | ❌ | 3 | 3 | 0 | `src/games/dicethrone/__tests__/pyromancer-tokens.test.ts` |  |
|  | ❌ | 1 | 3 | -2 | `src/games/dicethrone/hooks/useCardSpotlight.ts` |  |
|  | ❌ | 4 | 3 | 1 | `src/games/dicethrone/heroes/shadow_thief/tokens.ts` |  |
|  | ❌ | 3 | 3 | 0 | `src/games/dicethrone/domain/passiveAbility.ts` |  |
|  | ❌ | 0 | 3 | -3 | `src/games/dicethrone/domain/combat/CombatAbilityManager.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/dicethrone/__tests__/passive-reroll-validation.test.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/dicethrone/heroes/monk/abilities.ts` |  |
|  | ❌ | 0 | 2 | -2 | `src/games/dicethrone/heroes/moon_elf/cards.ts` |  |
|  | ❌ | 0 | 2 | -2 | `src/games/dicethrone/domain/combat/types.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/dicethrone/__tests__/cross-hero.test.ts` |  |
|  | ❌ | 0 | 2 | -2 | `src/games/dicethrone/ui/resolveMoves.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/dicethrone/ui/HandArea.tsx` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/dicethrone/domain/commonCards.ts` |  |
|  | ❌ | 0 | 2 | -2 | `src/games/dicethrone/heroes/pyromancer/cards.ts` |  |
|  | ❌ | 0 | 2 | -2 | `src/games/dicethrone/criticalImageResolver.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/dicethrone/heroes/shadow_thief/cards.ts` |  |
|  | ❌ | 0 | 2 | -2 | `src/games/dicethrone/ui/CharacterSelectionAdapter.tsx` |  |
|  | ❌ | 1 | 2 | -1 | `src/games/dicethrone/__tests__/thunder-strike.test.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/dicethrone/domain/customActions/monk.ts` |  |
|  | ❌ | 0 | 2 | -2 | `src/games/dicethrone/domain/commandCategories.ts` |  |
|  | ❌ | 0 | 1 | -1 | `src/games/dicethrone/heroes/barbarian/cards.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/dicethrone/ui/CardSpotlightOverlay.tsx` |  |
|  | ❌ | 0 | 1 | -1 | `src/games/dicethrone/manifest.ts` |  |
|  | ❌ | 0 | 1 | -1 | `src/games/dicethrone/__tests__/entity-chain-integrity.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/dicethrone/__tests__/defense-trigger-audit.test.ts` |  |

---

### SmashUp-Existing (99 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
| 🔴 | ❌ | 1 | 302 | -301 | `src/games/smashup/__tests__/newOngoingAbilities.test.ts` |  |
| 🔴 | ❌ | 2 | 299 | -297 | `src/games/smashup/__tests__/factionAbilities.test.ts` |  |
| 🔴 | ❌ | 25 | 295 | -270 | `src/games/smashup/domain/reducer.ts` |  |
| 🔴 | ❌ | 90 | 241 | -151 | `src/games/smashup/domain/index.ts` |  |
| 🔴 | ❌ | 58 | 177 | -119 | `src/games/smashup/__tests__/baseFactionOngoing.test.ts` |  |
| 🔴 | ❌ | 6 | 166 | -160 | `src/games/smashup/__tests__/specialInteractionChain.test.ts` |  |
| 🔴 | ❌ | 123 | 132 | -9 | `src/games/smashup/data/factions/pirates.ts` |  |
| 🔴 | ❌ | 217 | 119 | 98 | `src/games/smashup/domain/baseAbilities.ts` |  |
| 🔴 | ❌ | 201 | 115 | 86 | `src/games/smashup/abilities/ninjas.ts` |  |
| 🔴 | ❌ | 116 | 101 | 15 | `src/games/smashup/abilities/dinosaurs.ts` |  |
|  | ❌ | 78 | 97 | -19 | `src/games/smashup/ui/BaseZone.tsx` |  |
|  | ❌ | 6 | 91 | -85 | `src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts` |  |
|  | ❌ | 6 | 75 | -69 | `src/games/smashup/domain/commands.ts` |  |
|  | ❌ | 77 | 69 | 8 | `src/games/smashup/Board.tsx` |  |
|  | ❌ | 17 | 69 | -52 | `src/games/smashup/domain/reduce.ts` |  |
|  | ❌ | 1 | 69 | -68 | `src/games/smashup/__tests__/zombieInteractionChain.test.ts` |  |
|  | ❌ | 13 | 61 | -48 | `src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts` |  |
|  | ❌ | 225 | 57 | 168 | `src/games/smashup/abilities/pirates.ts` |  |
|  | ❌ | 3 | 43 | -40 | `src/games/smashup/domain/systems.ts` |  |
|  | ❌ | 4 | 42 | -38 | `src/games/smashup/domain/types.ts` |  |
|  | ❌ | 6 | 41 | -35 | `src/games/smashup/__tests__/newBaseAbilities.test.ts` |  |
|  | ❌ | 3 | 33 | -30 | `src/games/smashup/domain/ongoingModifiers.ts` |  |
|  | ❌ | 66 | 32 | 34 | `src/games/smashup/abilities/zombies.ts` |  |
|  | ❌ | 36 | 30 | 6 | `src/games/smashup/__tests__/newFactionAbilities.test.ts` |  |
|  | ❌ | 24 | 24 | 0 | `src/games/smashup/abilities/giant_ants.ts` |  |
|  | ❌ | 19 | 19 | 0 | `src/games/smashup/__tests__/baseScoring.test.ts` |  |
|  | ❌ | 25 | 19 | 6 | `src/games/smashup/__tests__/interactionChainE2E.test.ts` |  |
|  | ❌ | 18 | 18 | 0 | `src/games/smashup/__tests__/baseAbilityIntegration.test.ts` |  |
|  | ❌ | 8 | 17 | -9 | `src/games/smashup/abilities/robots.ts` |  |
|  | ❌ | 38 | 17 | 21 | `src/games/smashup/ui/factionMeta.ts` |  |
|  | ❌ | 14 | 16 | -2 | `src/games/smashup/ui/PromptOverlay.tsx` |  |
|  | ❌ | 1 | 16 | -15 | `src/games/smashup/domain/abilityHelpers.ts` |  |
|  | ❌ | 4 | 15 | -11 | `src/games/smashup/game.ts` |  |
|  | ❌ | 15 | 10 | 5 | `src/games/smashup/abilities/ongoing_modifiers.ts` |  |
|  | ❌ | 5 | 9 | -4 | `src/games/smashup/domain/baseAbilities_expansion.ts` |  |
|  | ❌ | 58 | 9 | 49 | `src/games/smashup/data/cards.ts` |  |
|  | ❌ | 7 | 7 | 0 | `src/games/smashup/abilities/bear_cavalry.ts` |  |
|  | ❌ | 7 | 7 | 0 | `src/games/smashup/audio.config.ts` |  |
|  | ❌ | 6 | 6 | 0 | `src/games/smashup/__tests__/properties/coreProperties.test.ts` |  |
|  | ❌ | 6 | 6 | 0 | `src/games/smashup/__tests__/vampireBuffetE2E.test.ts` |  |
|  | ❌ | 0 | 5 | -5 | `src/games/smashup/domain/ongoingEffects.ts` |  |
|  | ❌ | 5 | 5 | 0 | `src/games/smashup/abilities/aliens.ts` |  |
|  | ❌ | 10 | 5 | 5 | `src/games/smashup/abilities/frankenstein.ts` |  |
|  | ❌ | 4 | 4 | 0 | `src/games/smashup/ui/playerConfig.ts` |  |
|  | ❌ | 4 | 4 | 0 | `src/games/smashup/__tests__/duplicateInteractionRespond.test.ts` |  |
|  | ❌ | 0 | 4 | -4 | `src/games/smashup/domain/events.ts` |  |
|  | ❌ | 0 | 4 | -4 | `src/games/smashup/__tests__/sleep-spores-e2e.test.ts` |  |
|  | ❌ | 4 | 4 | 0 | `src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts` |  |
|  | ❌ | 3 | 4 | -1 | `src/games/smashup/ui/RevealOverlay.tsx` |  |
|  | ❌ | 4 | 3 | 1 | `src/games/smashup/ui/DeckDiscardZone.tsx` |  |
|  | ❌ | 2 | 3 | -1 | `src/games/smashup/abilities/elder_things.ts` |  |
|  | ❌ | 2 | 3 | -1 | `src/games/smashup/__tests__/meFirst.test.ts` |  |
|  | ❌ | 2 | 3 | -1 | `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts` |  |
|  | ❌ | 3 | 3 | 0 | `src/games/smashup/__tests__/bigGulpDroneIntercept.test.ts` |  |
|  | ❌ | 3 | 3 | 0 | `src/games/smashup/__tests__/madnessAbilities.test.ts` |  |
|  | ❌ | 3 | 3 | 0 | `src/games/smashup/abilities/steampunks.ts` |  |
|  | ❌ | 11 | 3 | 8 | `src/games/smashup/ui/FactionSelection.tsx` |  |
|  | ❌ | 3 | 3 | 0 | `src/games/smashup/abilities/ghosts.ts` |  |
|  | ❌ | 3 | 3 | 0 | `src/games/smashup/abilities/innsmouth.ts` |  |
|  | ❌ | 6 | 2 | 4 | `src/games/smashup/ui/cardPreviewHelper.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/smashup/abilities/miskatonic.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/smashup/__tests__/baseScoreCheck.test.ts` |  |
|  | ❌ | 5 | 2 | 3 | `src/games/smashup/abilities/vampires.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/smashup/__tests__/baseScoredRaceCondition.test.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/smashup/__tests__/baseScoredNormalFlow.test.ts` |  |
|  | ❌ | 8 | 2 | 6 | `src/games/smashup/abilities/index.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/smashup/__tests__/baseScoredOptimistic.test.ts` |  |
|  | ❌ | 0 | 2 | -2 | `src/games/smashup/__tests__/helpers.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts` |  |
|  | ❌ | 3 | 1 | 2 | `src/games/smashup/ui/CardMagnifyOverlay.tsx` |  |
|  | ❌ | 0 | 1 | -1 | `src/games/smashup/__tests__/expansionOngoing.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/baseProtection.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/promptE2E.test.ts` |  |
|  | ❌ | 0 | 1 | -1 | `src/games/smashup/data/factions/ninjas.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/zombieWizardAbilities.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/abilities/cthulhu.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/ui-interaction-manual.test.ts` |  |
|  | ❌ | 3 | 1 | 2 | `src/games/smashup/ui/HandArea.tsx` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/abilities/tricksters.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/choice-audit-fixes.test.ts` |  |
|  | ❌ | 0 | 1 | -1 | `src/games/smashup/__tests__/promptResponseChain.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/alienAuditFixes.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/madnessPromptAbilities.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/query6Abilities.test.ts` |  |
|  | ❌ | 0 | 1 | -1 | `src/games/smashup/__tests__/ongoingEffects.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/expansionBaseAbilities.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/ghostsAbilities.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/ongoingE2E.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/expansionAbilities.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/smashup/__tests__/elderThingAbilities.test.ts` |  |
|  | ❌ | 1 | 0 | 1 | `src/games/smashup/data/factions/cthulhu.ts` |  |
|  | ❌ | 2210 | 0 | 2210 | `src/games/smashup/data/englishAtlasMap.json` |  |
|  | ❌ | 21 | 0 | 21 | `src/games/smashup/domain/abilityInteractionHandlers.ts` |  |
|  | ❌ | 28 | 0 | 28 | `src/games/smashup/domain/abilityRegistry.ts` |  |
|  | ❌ | 1 | 0 | 1 | `src/games/smashup/data/factions/aliens.ts` |  |
|  | ❌ | 66 | 0 | 66 | `src/games/smashup/ui/SmashUpOverlayContext.tsx` |  |
|  | ❌ | 14 | 0 | 14 | `src/games/smashup/ui/cardAtlas.ts` |  |
|  | ❌ | 34 | 0 | 34 | `src/games/smashup/domain/ids.ts` |  |
|  | ❌ | 141 | 0 | 141 | `src/games/smashup/ui/SmashUpCardRenderer.tsx` |  |

---

### Other (23 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
| 🔴 |  | 3 | 458 | -455 | `src/pages/admin/Matches.tsx` |  |
|  |  | 1 | 91 | -90 | `src/pages/MatchRoom.tsx` |  |
|  |  | 9 | 70 | -61 | `src/pages/admin/Feedback.tsx` |  |
|  |  | 12 | 70 | -58 | `src/pages/admin/index.tsx` |  |
|  |  | 6 | 47 | -41 | `src/services/matchSocket.ts` |  |
|  |  | 0 | 34 | -34 | `src/index.css` |  |
|  |  | 2 | 30 | -28 | `src/pages/admin/Notifications.tsx` |  |
|  |  | 10 | 25 | -15 | `src/pages/Home.tsx` |  |
|  |  | 6 | 10 | -4 | `src/services/matchApi.ts` |  |
|  |  | 7 | 10 | -3 | `src/App.tsx` |  |
|  |  | 0 | 9 | -9 | `src/services/lobbySocket.ts` |  |
|  |  | 0 | 6 | -6 | `src/main.tsx` |  |
|  |  | 6 | 5 | 1 | `src/core/AssetLoader.ts` |  |
|  |  | 4 | 4 | 0 | `src/ugc/builder/pages/panels/PropertyPanel.tsx` |  |
|  |  | 0 | 3 | -3 | `src/shared/chat.ts` |  |
|  |  | 3 | 3 | 0 | `src/ugc/builder/pages/panels/BuilderModals.tsx` |  |
|  |  | 2 | 2 | 0 | `src/ugc/builder/pages/components/RenderComponentManager.tsx` |  |
|  |  | 1 | 2 | -1 | `src/pages/devtools/AudioBrowser.tsx` |  |
|  |  | 0 | 1 | -1 | `"src/games/dicethrone/rule/\347\216\213\346\235\203\351\252\260\351\223\270\350\247\204\345\210\231.md"` |  |
|  |  | 0 | 1 | -1 | `src/services/socialSocket.ts` |  |
|  |  | 1 | 1 | 0 | `src/ugc/builder/pages/components/HookField.tsx` |  |
|  |  | 1 | 1 | 0 | `src/games/ugc-wrapper/game.ts` |  |
|  |  | 1 | 1 | 0 | `src/assets/audio/registry-slim.json` |  |

---

### Engine (20 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
| 🔴 | ❌ | 43 | 204 | -161 | `src/engine/transport/server.ts` |  |
| 🔴 | ❌ | 10 | 194 | -184 | `src/engine/primitives/actionLogHelpers.ts` |  |
|  | ❌ | 8 | 99 | -91 | `src/engine/hooks/useEventStreamCursor.ts` |  |
|  | ❌ | 17 | 94 | -77 | `src/engine/pipeline.ts` |  |
|  | ❌ | 31 | 69 | -38 | `src/engine/transport/react.tsx` |  |
|  | ❌ | 4 | 68 | -64 | `src/engine/transport/client.ts` |  |
|  | ❌ | 1 | 42 | -41 | `src/engine/transport/storage.ts` |  |
|  | ❌ | 3 | 35 | -32 | `src/engine/transport/latency/optimisticEngine.ts` |  |
|  | ❌ | 3 | 27 | -24 | `src/engine/systems/InteractionSystem.ts` |  |
|  | ❌ | 0 | 16 | -16 | `src/engine/transport/protocol.ts` |  |
|  | ❌ | 5 | 14 | -9 | `src/engine/primitives/damageCalculation.ts` |  |
|  | ❌ | 0 | 7 | -7 | `src/engine/systems/FlowSystem.ts` |  |
|  | ❌ | 2 | 6 | -4 | `src/engine/fx/useFxBus.ts` |  |
|  | ❌ | 0 | 3 | -3 | `src/engine/hooks/index.ts` |  |
|  | ❌ | 1 | 2 | -1 | `src/engine/systems/SimpleChoiceSystem.ts` |  |
|  | ❌ | 7 | 2 | 5 | `src/engine/types.ts` |  |
|  | ❌ | 0 | 1 | -1 | `src/engine/primitives/__tests__/damageCalculation.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/engine/systems/UndoSystem.ts` |  |
|  | ❌ | 0 | 1 | -1 | `src/engine/transport/__tests__/errorI18n.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/engine/adapter.ts` |  |

---

### SmashUp-POD (20 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
|  | ✅ | 143 | 0 | 143 | `src/games/smashup/data/factions/giant-ants_pod.ts` |  |
|  | ✅ | 107 | 0 | 107 | `src/games/smashup/data/factions/innsmouth_pod.ts` |  |
|  | ✅ | 141 | 0 | 141 | `src/games/smashup/data/factions/ghosts_pod.ts` |  |
|  | ✅ | 140 | 0 | 140 | `src/games/smashup/data/factions/miskatonic_pod.ts` |  |
|  | ✅ | 141 | 0 | 141 | `src/games/smashup/data/factions/frankenstein_pod.ts` |  |
|  | ✅ | 149 | 0 | 149 | `src/games/smashup/data/factions/cthulhu_pod.ts` |  |
|  | ✅ | 125 | 0 | 125 | `src/games/smashup/data/factions/bear_cavalry_pod.ts` |  |
|  | ✅ | 139 | 0 | 139 | `src/games/smashup/data/factions/dinosaurs_pod.ts` |  |
|  | ✅ | 136 | 0 | 136 | `src/games/smashup/data/factions/aliens_pod.ts` |  |
|  | ✅ | 140 | 0 | 140 | `src/games/smashup/data/factions/elder_things_pod.ts` |  |
|  | ✅ | 127 | 0 | 127 | `src/games/smashup/data/factions/tricksters_pod.ts` |  |
|  | ✅ | 119 | 0 | 119 | `src/games/smashup/data/factions/robots_pod.ts` |  |
|  | ✅ | 129 | 0 | 129 | `src/games/smashup/data/factions/steampunks_pod.ts` |  |
|  | ✅ | 165 | 0 | 165 | `src/games/smashup/data/factions/ninjas_pod.ts` |  |
|  | ✅ | 142 | 0 | 142 | `src/games/smashup/data/factions/vampires_pod.ts` |  |
|  | ✅ | 138 | 0 | 138 | `src/games/smashup/data/factions/wizards_pod.ts` |  |
|  | ✅ | 141 | 0 | 141 | `src/games/smashup/data/factions/killer_plants_pod.ts` |  |
|  | ✅ | 146 | 0 | 146 | `src/games/smashup/data/factions/werewolves_pod.ts` |  |
|  | ✅ | 138 | 0 | 138 | `src/games/smashup/data/factions/zombies_pod.ts` |  |
|  | ✅ | 135 | 0 | 135 | `src/games/smashup/data/factions/pirates_pod.ts` |  |

---

### SummonerWars (18 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
|  | ❌ | 5 | 48 | -43 | `src/games/summonerwars/Board.tsx` |  |
|  | ❌ | 1 | 31 | -30 | `src/games/summonerwars/ui/useGameEvents.ts` |  |
|  | ❌ | 1 | 22 | -21 | `src/games/summonerwars/ui/useCellInteraction.ts` |  |
|  | ❌ | 4 | 13 | -9 | `src/games/summonerwars/ui/FactionSelectionAdapter.tsx` |  |
|  | ❌ | 4 | 11 | -7 | `src/games/summonerwars/domain/index.ts` |  |
|  | ❌ | 0 | 9 | -9 | `src/games/summonerwars/domain/execute.ts` |  |
|  | ❌ | 0 | 7 | -7 | `src/games/summonerwars/domain/validate.ts` |  |
|  | ❌ | 0 | 5 | -5 | `src/games/summonerwars/domain/reduce.ts` |  |
|  | ❌ | 4 | 5 | -1 | `src/games/summonerwars/ui/BoardGrid.tsx` |  |
|  | ❌ | 0 | 5 | -5 | `src/games/summonerwars/domain/types.ts` |  |
|  | ❌ | 0 | 3 | -3 | `src/games/summonerwars/ui/modeTypes.ts` |  |
|  | ❌ | 1 | 2 | -1 | `src/games/summonerwars/ui/EnergyBar.tsx` |  |
|  | ❌ | 1 | 2 | -1 | `src/games/summonerwars/domain/events.ts` |  |
|  | ❌ | 2 | 2 | 0 | `src/games/summonerwars/__tests__/interaction-flow-e2e.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/summonerwars/game.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/summonerwars/__tests__/abilities-barbaric.test.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/summonerwars/config/factions/barbaric.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/games/summonerwars/ui/StatusBanners.tsx` |  |

---

### i18n (16 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
| 🔴 |  | 423 | 354 | 69 | `public/locales/zh-CN/game-smashup.json` |  |
| 🔴 |  | 34 | 157 | -123 | `public/locales/zh-CN/game-dicethrone.json` |  |
| 🔴 |  | 27 | 151 | -124 | `public/locales/en/game-dicethrone.json` |  |
|  |  | 4 | 13 | -9 | `public/locales/en/game.json` |  |
|  |  | 4 | 13 | -9 | `public/locales/zh-CN/game.json` |  |
|  |  | 1 | 7 | -6 | `public/locales/en/admin.json` |  |
|  |  | 1 | 7 | -6 | `public/locales/en/lobby.json` |  |
|  |  | 1 | 7 | -6 | `public/locales/zh-CN/lobby.json` |  |
|  |  | 1 | 7 | -6 | `public/locales/zh-CN/admin.json` |  |
|  |  | 6 | 6 | 0 | `public/locales/en/game-smashup.json` |  |
|  |  | 1 | 2 | -1 | `public/locales/zh-CN/common.json` |  |
|  |  | 1 | 2 | -1 | `public/locales/zh-CN/social.json` |  |
|  |  | 1 | 2 | -1 | `public/locales/en/social.json` |  |
|  |  | 1 | 2 | -1 | `public/locales/en/common.json` |  |
|  |  | 0 | 1 | -1 | `public/locales/zh-CN/game-summonerwars.json` |  |
|  |  | 0 | 1 | -1 | `public/locales/en/game-summonerwars.json` |  |

---

### Components (11 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
|  |  | 27 | 54 | -27 | `src/components/system/FeedbackModal.tsx` |  |
|  |  | 14 | 25 | -11 | `src/components/social/UserMenu.tsx` |  |
|  |  | 3 | 23 | -20 | `src/components/social/SystemNotificationView.tsx` |  |
|  |  | 11 | 15 | -4 | `src/components/lobby/RoomList.tsx` |  |
|  |  | 5 | 8 | -3 | `src/components/system/AboutModal.tsx` |  |
|  |  | 0 | 1 | -1 | `src/components/lobby/GameDetailsModal.tsx` |  |
|  |  | 1 | 1 | 0 | `src/components/lobby/LeaderboardTab.tsx` |  |
|  |  | 1 | 1 | 0 | `src/components/system/FabMenu.tsx` |  |
|  |  | 1 | 1 | 0 | `src/components/social/MatchHistoryModal.tsx` |  |
|  |  | 0 | 1 | -1 | `src/components/lobby/roomActions.ts` |  |
|  |  | 1 | 1 | 0 | `src/components/social/FriendList.tsx` |  |

---

### Server (6 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
|  | ❌ | 12 | 59 | -47 | `src/server/storage/MongoStorage.ts` |  |
|  | ❌ | 8 | 45 | -37 | `src/server/storage/__tests__/hybridStorage.test.ts` |  |
|  | ❌ | 278 | 20 | 258 | `src/server/storage/HybridStorage.ts` |  |
|  | ❌ | 1 | 11 | -10 | `src/server/claimSeat.ts` |  |
|  | ❌ | 1 | 8 | -7 | `src/server/models/MatchRecord.ts` |  |
|  | ❌ | 1 | 1 | 0 | `src/server/storage/__tests__/mongoStorage.test.ts` |  |

---

### Framework (5 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
| 🔴 | ❌ | 60 | 117 | -57 | `src/components/game/framework/widgets/RematchActions.tsx` |  |
| 🔴 | ❌ | 9 | 109 | -100 | `src/components/game/framework/widgets/GameHUD.tsx` |  |
|  | ❌ | 2 | 22 | -20 | `src/components/game/framework/hooks/useAutoSkipPhase.ts` |  |
|  | ❌ | 3 | 4 | -1 | `src/components/game/framework/widgets/GameDebugPanel.tsx` |  |
|  | ❌ | 1 | 1 | 0 | `src/components/game/framework/CharacterSelectionSkeleton.tsx` |  |

---

### Lib (4 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
|  |  | 0 | 48 | -48 | `src/lib/utils.ts` |  |
|  |  | 38 | 23 | 15 | `src/lib/audio/useGameAudio.ts` |  |
|  |  | 8 | 8 | 0 | `src/lib/i18n/zh-CN-bundled.ts` |  |
|  |  | 1 | 3 | -2 | `src/lib/audio/AudioManager.ts` |  |

---

### Context (3 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
|  |  | 1 | 2 | -1 | `src/contexts/SocialContext.tsx` |  |
|  |  | 1 | 2 | -1 | `src/contexts/ToastContext.tsx` |  |
|  |  | 0 | 1 | -1 | `src/contexts/RematchContext.tsx` |  |

---

### Common (3 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
|  |  | 3 | 30 | -27 | `src/components/common/animations/FlyingEffect.tsx` |  |
|  |  | 2 | 10 | -8 | `src/components/common/media/CardPreview.tsx` |  |
|  |  | 1 | 2 | -1 | `src/components/common/overlays/BreakdownTooltip.tsx` |  |

---

### TicTacToe (2 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
|  | ❌ | 6 | 13 | -7 | `src/games/tictactoe/domain/index.ts` |  |
|  | ❌ | 0 | 2 | -2 | `src/games/tictactoe/domain/types.ts` |  |

---

### Hooks (1 个文件)

| 优先级 | 应该修改 | +行 | -行 | 净变更 | 文件路径 | 审计状态 |
|--------|----------|-----|-----|--------|----------|----------|
|  |  | 3 | 9 | -6 | `src/hooks/match/useMatchStatus.ts` |  |

---

## 审计进度追踪

### 已审计文件（19 个）

#### 引擎层（18 个）
-  src/engine/pipeline.ts
-  src/engine/hooks/useEventStreamCursor.ts
- ✅ src/engine/primitives/actionLogHelpers.ts
- ✅ src/engine/transport/server.ts
- ✅ src/engine/transport/client.ts
- ✅ src/engine/transport/react.tsx
- ✅ src/engine/transport/protocol.ts
- ✅ src/engine/systems/InteractionSystem.ts
-  src/engine/systems/FlowSystem.ts
-  src/engine/systems/SimpleChoiceSystem.ts
-  src/engine/systems/UndoSystem.ts
-  src/engine/adapter.ts
-  src/engine/fx/useFxBus.ts
-  src/engine/types.ts
-  src/engine/hooks/index.ts
-  src/engine/transport/latency/optimisticEngine.ts
-  src/engine/transport/storage.ts
-  src/engine/primitives/damageCalculation.ts

#### 服务端（1 个）
-  src/server/storage/MongoStorage.ts

#### DiceThrone（部分）
-  src/games/dicethrone/Board.tsx（部分审计）
  -  hasDivergentVariants - 已修复
  -  自动响应功能 - 未恢复
  -  响应窗口视角切换 - 未恢复
  -  太极令牌限制 - 未恢复
  -  变体排序 - 未恢复
-  src/games/dicethrone/ui/BoardOverlays.tsx（已发现问题）
  -  结算画面删除 - 未恢复

### 待审计文件（317 个）

按优先级排序：

#### P0 - 立即审计（高优先级 + 不应该修改）

**DiceThrone**（删除行数 > 100 的文件）:-  `src/games/dicethrone/game.ts` (-246 行)
-  `src/games/dicethrone/hooks/useAnimationEffects.ts` (-210 行)
-  `src/games/dicethrone/__tests__/shield-cleanup.test.ts` (-188 行)
-  `src/games/dicethrone/domain/rules.ts` (-172 行)
-  `src/games/dicethrone/Board.tsx` (-133 行)
-  `src/games/dicethrone/__tests__/monk-coverage.test.ts` (-127 行)
-  `src/games/dicethrone/domain/reduceCombat.ts` (-112 行)
-  `src/games/dicethrone/domain/flowHooks.ts` (-104 行)

**其他模块**（删除行数 > 100 的文件）:-  `src/games/smashup/__tests__/newOngoingAbilities.test.ts` (-302 行, SmashUp-Existing)
-  `src/games/smashup/__tests__/factionAbilities.test.ts` (-299 行, SmashUp-Existing)
-  `src/games/smashup/domain/reducer.ts` (-295 行, SmashUp-Existing)
-  `src/games/smashup/domain/index.ts` (-241 行, SmashUp-Existing)
-  `src/engine/transport/server.ts` (-204 行, Engine)
-  `src/engine/primitives/actionLogHelpers.ts` (-194 行, Engine)
-  `src/games/smashup/__tests__/baseFactionOngoing.test.ts` (-177 行, SmashUp-Existing)
-  `src/games/smashup/__tests__/specialInteractionChain.test.ts` (-166 行, SmashUp-Existing)
-  `src/games/smashup/data/factions/pirates.ts` (-132 行, SmashUp-Existing)
-  `src/games/smashup/domain/baseAbilities.ts` (-119 行, SmashUp-Existing)
-  `src/components/game/framework/widgets/RematchActions.tsx` (-117 行, Framework)
-  `src/games/smashup/abilities/ninjas.ts` (-115 行, SmashUp-Existing)
-  `src/components/game/framework/widgets/GameHUD.tsx` (-109 行, Framework)
-  `src/games/smashup/abilities/dinosaurs.ts` (-101 行, SmashUp-Existing)

#### P1 - 后续审计（中优先级）

- 🟡 DiceThrone 其他文件（50-100 行删除）
- 🟡 SummonerWars 所有文件
- 🟡 引擎层未审计文件
- 🟡 框架层所有文件

#### P2 - 最后审计（低优先级）

-  SmashUp 已有派系（需要区分 POD 和非 POD）
-  i18n 文件（需要区分 POD 和非 POD）
-  其他小文件

---

## 使用说明

### 如何使用这个清单

1. **按优先级审计**：从 P0 开始，逐个审计高优先级文件
2. **记录审计结果**：在"审计状态"列标记 ✅（已审计）或 ⚠️（发现问题）
3. **创建问题清单**：为每个发现问题的文件创建详细的问题报告
4. **恢复功能**：根据问题清单逐个恢复被删除的功能

### 审计流程

对于每个文件：

1. **查看变更**
   ```bash
   git diff 6ea1f9f^..6ea1f9f -- <文件路径>
   ```

2. **判断是否需要恢复**
   - 删除的代码是否为功能代码？
   - 是否影响游戏规则或用户体验？
   - 是否为 POD 相关的修改？

3. **记录问题**
   - 创建问题报告（如 `evidence/dicethrone-endgame-ui-deletion.md`）
   - 记录删除的代码
   - 分析影响
   - 制定恢复计划

4. **恢复功能**
   - 使用 `strReplace` 或 `editCode` 恢复代码
   - 运行测试验证
   - 更新审计状态

---

## 下一步

**建议立即开始审计 P0 高优先级文件**：

1. DiceThrone 高删除量文件（> 100 行）
2. 其他模块高删除量文件（> 100 行）
3. 已知问题文件（Board.tsx, BoardOverlays.tsx）

**预计时间**：4-6 小时

**输出**：每个文件的详细审计报告
