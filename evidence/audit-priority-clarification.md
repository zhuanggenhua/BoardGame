# 审计优先级分类澄清

## 问题说明

**问题**: P0/P1/P2/P3 之间是否有文件重复？

**答案**: ❌ **有重复！** `audit-scope-complete.md` 中的分类有问题。

---

## 问题根源

`audit-scope-complete.md` 中将 **所有 336 个文件** 都标记为 DONE（已审计），但实际上：

1. **测试文件**（`__tests__/`）被标记为 DONE，但应该属于 **P2**
2. **能力文件**（`abilities/`）被标记为 DONE，但应该属于 **P1**
3. **UI 文件**（`ui/`）被标记为 DONE，但应该属于 **P1**
4. **数据文件**（`data/`）被标记为 DONE，但应该属于 **P2**

---

## 正确的分类

### P0 - 核心逻辑（50 个文件）

**定义**: 影响游戏核心功能、引擎系统、传输层的关键文件

**包含**:
- ✅ 引擎层核心文件（`src/engine/adapter.ts`, `src/engine/pipeline.ts`）
- ✅ 传输层文件（`src/engine/transport/server.ts`, `src/engine/transport/client.ts`）
- ✅ 游戏领域层核心文件（`domain/index.ts`, `game.ts`, `reduce.ts`, `execute.ts`）
- ✅ 服务端核心逻辑（`src/server/storage/`）
- ✅ 框架层核心组件（`src/components/game/framework/`）

**不包含**:
- ❌ 测试文件（`__tests__/`）→ 应该在 P2
- ❌ 能力文件（`abilities/`）→ 应该在 P1
- ❌ UI 文件（`ui/`）→ 应该在 P1
- ❌ 数据文件（`data/`）→ 应该在 P2

---

### P1 - 业务逻辑（80 个文件）

**定义**: 影响游戏业务逻辑、能力系统、UI 交互的重要文件

**包含**:
- ✅ 游戏能力文件（`abilities/*.ts`）
- ✅ 游戏 UI 组件（`ui/*.tsx`）
- ✅ 游戏领域层辅助文件（`domain/utils.ts`, `domain/types.ts`）
- ✅ 通用 UI 组件（`src/components/common/`）

**示例**:
- `src/games/smashup/abilities/aliens.ts`
- `src/games/smashup/abilities/dinosaurs.ts`
- `src/games/smashup/ui/BaseZone.tsx`
- `src/games/dicethrone/ui/AbilityOverlays.tsx`

---

### P2 - 测试与配置（120 个文件）

**定义**: 测试文件、配置文件、国际化文件

**包含**:
- ✅ 测试文件（`__tests__/*.test.ts`）
- ✅ 国际化文件（`public/locales/`）
- ✅ 音频配置（`audio.config.ts`）
- ✅ 数据文件（`data/*.ts`, `data/*.json`）

**示例**:
- `src/games/smashup/__tests__/factionAbilities.test.ts`
- `src/games/dicethrone/__tests__/monk-coverage.test.ts`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/data/factions/aliens_pod.ts`

---

### P3 - 页面与服务（80 个文件）

**定义**: 页面组件、服务层、工具函数

**包含**:
- ✅ 页面组件（`src/pages/`）
- ✅ 服务层（`src/services/`）
- ✅ Context 层（`src/contexts/`）
- ✅ 工具函数（`src/lib/`, `src/hooks/`）

**示例**:
- `src/pages/admin/Matches.tsx`
- `src/services/matchSocket.ts`
- `src/contexts/SocialContext.tsx`
- `src/lib/utils.ts`

---

## 重复文件清单

### SmashUp 测试文件（44 个）

这些文件在 `audit-scope-complete.md` 中被标记为 DONE，但应该属于 **P2**：

- `src/games/smashup/__tests__/alienAuditFixes.test.ts`
- `src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts`
- `src/games/smashup/__tests__/baseAbilityIntegration.test.ts`
- `src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts`
- `src/games/smashup/__tests__/baseFactionOngoing.test.ts`
- `src/games/smashup/__tests__/baseProtection.test.ts`
- `src/games/smashup/__tests__/baseScoreCheck.test.ts`
- `src/games/smashup/__tests__/baseScoredNormalFlow.test.ts`
- `src/games/smashup/__tests__/baseScoredOptimistic.test.ts`
- `src/games/smashup/__tests__/baseScoredRaceCondition.test.ts`
- `src/games/smashup/__tests__/baseScoring.test.ts`
- `src/games/smashup/__tests__/bigGulpDroneIntercept.test.ts`
- `src/games/smashup/__tests__/choice-audit-fixes.test.ts`
- `src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts`
- `src/games/smashup/__tests__/duplicateInteractionRespond.test.ts`
- `src/games/smashup/__tests__/elderThingAbilities.test.ts`
- `src/games/smashup/__tests__/expansionAbilities.test.ts`
- `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
- `src/games/smashup/__tests__/expansionOngoing.test.ts`
- `src/games/smashup/__tests__/factionAbilities.test.ts` ⚠️ **P0 文档中提到需要恢复**
- `src/games/smashup/__tests__/ghostsAbilities.test.ts`
- `src/games/smashup/__tests__/helpers.ts`
- `src/games/smashup/__tests__/interactionChainE2E.test.ts`
- `src/games/smashup/__tests__/madnessAbilities.test.ts`
- `src/games/smashup/__tests__/madnessPromptAbilities.test.ts`
- `src/games/smashup/__tests__/meFirst.test.ts`
- `src/games/smashup/__tests__/newBaseAbilities.test.ts`
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
- `src/games/smashup/__tests__/newOngoingAbilities.test.ts` ⚠️ **P0 文档中提到需要恢复**
- `src/games/smashup/__tests__/ongoingE2E.test.ts`
- `src/games/smashup/__tests__/ongoingEffects.test.ts`
- `src/games/smashup/__tests__/promptE2E.test.ts`
- `src/games/smashup/__tests__/promptResponseChain.test.ts`
- `src/games/smashup/__tests__/properties/coreProperties.test.ts`
- `src/games/smashup/__tests__/query6Abilities.test.ts`
- `src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts`
- `src/games/smashup/__tests__/sleep-spores-e2e.test.ts`
- `src/games/smashup/__tests__/specialInteractionChain.test.ts`
- `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts`
- `src/games/smashup/__tests__/ui-interaction-manual.test.ts`
- `src/games/smashup/__tests__/vampireBuffetE2E.test.ts`
- `src/games/smashup/__tests__/zombieInteractionChain.test.ts`
- `src/games/smashup/__tests__/zombieWizardAbilities.test.ts`

### SmashUp 能力文件（18 个）

这些文件在 `audit-scope-complete.md` 中被标记为 DONE，但应该属于 **P1**：

- `src/games/smashup/abilities/aliens.ts`
- `src/games/smashup/abilities/bear_cavalry.ts`
- `src/games/smashup/abilities/cthulhu.ts`
- `src/games/smashup/abilities/dinosaurs.ts`
- `src/games/smashup/abilities/elder_things.ts`
- `src/games/smashup/abilities/frankenstein.ts`
- `src/games/smashup/abilities/ghosts.ts`
- `src/games/smashup/abilities/giant_ants.ts`
- `src/games/smashup/abilities/innsmouth.ts`
- `src/games/smashup/abilities/miskatonic.ts`
- `src/games/smashup/abilities/ninjas.ts`
- `src/games/smashup/abilities/ongoing_modifiers.ts`
- `src/games/smashup/abilities/pirates.ts`
- `src/games/smashup/abilities/robots.ts`
- `src/games/smashup/abilities/steampunks.ts`
- `src/games/smashup/abilities/tricksters.ts`
- `src/games/smashup/abilities/vampires.ts`
- `src/games/smashup/abilities/zombies.ts`

### SmashUp UI 文件（12 个）

这些文件在 `audit-scope-complete.md` 中被标记为 DONE，但应该属于 **P1**：

- `src/games/smashup/ui/BaseZone.tsx`
- `src/games/smashup/ui/CardMagnifyOverlay.tsx`
- `src/games/smashup/ui/DeckDiscardZone.tsx`
- `src/games/smashup/ui/FactionSelection.tsx`
- `src/games/smashup/ui/HandArea.tsx`
- `src/games/smashup/ui/PromptOverlay.tsx`
- `src/games/smashup/ui/RevealOverlay.tsx`
- `src/games/smashup/ui/SmashUpCardRenderer.tsx`
- `src/games/smashup/ui/SmashUpOverlayContext.tsx`
- `src/games/smashup/ui/cardAtlas.ts`
- `src/games/smashup/ui/cardPreviewHelper.ts`
- `src/games/smashup/ui/factionMeta.ts`

### SmashUp 数据文件（28 个）

这些文件在 `audit-scope-complete.md` 中被标记为 DONE，但应该属于 **P2**：

- `src/games/smashup/data/cards.ts`
- `src/games/smashup/data/englishAtlasMap.json`
- `src/games/smashup/data/factions/aliens_pod.ts`
- `src/games/smashup/data/factions/bear_cavalry_pod.ts`
- （其他 24 个 POD 数据文件）

### DiceThrone 测试文件（30 个）

这些文件在 `audit-scope-complete.md` 中被标记为 DONE，但应该属于 **P2**：

- `src/games/dicethrone/__tests__/actionLogFormat.test.ts`
- `src/games/dicethrone/__tests__/audio.config.test.ts`
- `src/games/dicethrone/__tests__/barbarian-abilities.test.ts`
- （其他 27 个测试文件）

### DiceThrone 能力文件（15 个）

这些文件在 `audit-scope-complete.md` 中被标记为 DONE，但应该属于 **P1**：

- `src/games/dicethrone/domain/customActions/barbarian.ts`
- `src/games/dicethrone/domain/customActions/monk.ts`
- `src/games/dicethrone/domain/customActions/moon_elf.ts`
- （其他 12 个能力文件）

### DiceThrone UI 文件（10 个）

这些文件在 `audit-scope-complete.md` 中被标记为 DONE，但应该属于 **P1**：

- `src/games/dicethrone/ui/AbilityOverlays.tsx`
- `src/games/dicethrone/ui/BoardOverlays.tsx`
- `src/games/dicethrone/ui/DiceThroneHeroSelection.tsx`
- （其他 7 个 UI 文件）

---

## 实际审计状态

### P0 - 核心逻辑（真实状态）

| 模块 | 文件数 | 已审计 | 待审计 | 完成率 |
|------|--------|--------|--------|--------|
| 引擎层 | 20 | 18 | 2 | 90% |
| 服务端 | 6 | 6 | 0 | 100% |
| 框架层 | 5 | 5 | 0 | 100% |
| SmashUp 核心 | 10 | 8 | 2 | 80% |
| DiceThrone 核心 | 8 | 7 | 1 | 87.5% |
| SummonerWars 核心 | 1 | 1 | 0 | 100% |
| **总计** | **50** | **45** | **5** | **90%** |

### P1 - 业务逻辑（真实状态）

| 模块 | 文件数 | 已审计 | 待审计 | 完成率 |
|------|--------|--------|--------|--------|
| SmashUp 能力 | 18 | 0 | 18 | 0% |
| SmashUp UI | 12 | 0 | 12 | 0% |
| DiceThrone 能力 | 15 | 0 | 15 | 0% |
| DiceThrone UI | 10 | 0 | 10 | 0% |
| SummonerWars 能力 | 8 | 0 | 8 | 0% |
| SummonerWars UI | 5 | 0 | 5 | 0% |
| 通用 UI 组件 | 12 | 0 | 12 | 0% |
| **总计** | **80** | **0** | **80** | **0%** |

### P2 - 测试与配置（真实状态）

| 模块 | 文件数 | 已审计 | 待审计 | 完成率 |
|------|--------|--------|--------|--------|
| SmashUp 测试 | 44 | 0 | 44 | 0% |
| DiceThrone 测试 | 30 | 0 | 30 | 0% |
| SummonerWars 测试 | 2 | 0 | 2 | 0% |
| 国际化文件 | 16 | 0 | 16 | 0% |
| 数据文件 | 28 | 0 | 28 | 0% |
| **总计** | **120** | **0** | **120** | **0%** |

### P3 - 页面与服务（真实状态）

| 模块 | 文件数 | 已审计 | 待审计 | 完成率 |
|------|--------|--------|--------|--------|
| 页面组件 | 7 | 0 | 7 | 0% |
| 服务层 | 4 | 0 | 4 | 0% |
| Context 层 | 3 | 0 | 3 | 0% |
| Lib 工具 | 4 | 0 | 4 | 0% |
| 其他 | 14 | 0 | 14 | 0% |
| **总计** | **32** | **0** | **32** | **0%** |

---

## 修正建议

### 1. 更新 `audit-scope-complete.md`

将文件按 P0/P1/P2/P3 正确分类，不要把所有文件都标记为 DONE。

### 2. 更新 P0 审计文档

`p0-audit-progress.md` 中提到的测试文件（`newOngoingAbilities.test.ts`, `factionAbilities.test.ts`）应该移到 P2 审计文档中。

### 3. 明确审计范围

- **P0**: 只审计核心逻辑文件（50 个）
- **P1**: 审计业务逻辑文件（80 个）
- **P2**: 审计测试与配置文件（120 个）
- **P3**: 审计页面与服务文件（32 个）

---

## 总结

**问题**: P0/P1/P2/P3 之间有重复吗？

**答案**: ❌ **有重复！** 

- `audit-scope-complete.md` 中将 **所有 336 个文件** 都标记为 DONE
- 但实际上只有 **50 个 P0 核心逻辑文件** 完成了严格审计（其中 45 个已完成）
- 其他 **286 个文件**（测试、UI、能力、数据等）需要按 P1/P2/P3 标准重新审计

**修正方案**: 

1. 更新 `audit-scope-complete.md`，将文件按 P0/P1/P2/P3 正确分类
2. 更新 P0 审计文档，移除测试文件
3. 明确各优先级的审计范围和标准
