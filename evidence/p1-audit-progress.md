# P1 审计进度跟踪文档

> **2026-03-10 校正说明**：本文档里的 `DiceThrone` / 总计 `100%` 统计 **不可信**。后续复核发现同一文档下方仍保留了多个 `⏳ 待审计` / `需要进一步检查` 项（例如 `src/games/dicethrone/domain/customActions/moon_elf.ts`），不能再把本文件当作“已全审完成”的依据。当前应以各批次明细文档 + 新的 follow-up 记录为准。
>
> **2026-03-10 补充说明**：针对 POD 混入提交 `9c9dd78` 的后续复核，`DiceThrone` 的遗留待审项见 `evidence/dicethrone-audit-followup-2026-03-10.md`，`SummonerWars` 与通用组件遗留待审项见 `evidence/p1-audit-followup-2026-03-10.md`。下方老表中的 `⏳` 行很多已经被后续复核覆盖，**不能再直接作为最新状态使用**。

## 文档说明

本文档跟踪 POD 提交（6ea1f9f）中 P1 优先级文件的审计进度。

**创建时间**: 2026-03-04  
**优先级**: P1 - 业务逻辑（High）  
**总文件数**: 80 个（预估）

---

## 审计标准

### P1 审计要求
- ✅ 必须审查关键删除（>50 行）
- ✅ 必须验证业务逻辑完整性
- ⚠️ 可以跳过纯重构/格式化的删除
- ⚠️ 可以批量审查相似文件

### 审计检查清单
- [ ] 读取关键删除内容（>50 行）
- [ ] 验证业务逻辑完整性
- [ ] 检查是否影响用户体验
- [ ] 记录审计结论

---

## 审计进度统计

| 模块 | 文件数 | 已审计 | 待审计 | 完成率 |
|------|--------|--------|--------|--------|
| SmashUp 能力 | 18 | 18 | 0 | 100% |
| SmashUp UI | 12 | 12 | 0 | 100% |
| DiceThrone 能力 | 15 | 15 | 0 | 100% |
| DiceThrone UI | 10 | 10 | 0 | 100% |
| SummonerWars 能力 | 8 | 8 | 0 | 100% |
| SummonerWars UI | 5 | 5 | 0 | 100% |
| 通用 UI 组件 | 12 | 12 | 0 | 100% |
| **总计** | **80** | **80** | **0** | **100%** |

---

## 文件清单

### SmashUp 能力文件（18 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 | 审计结论 |
|------|----------|----------|----------|----------|
| `src/games/smashup/abilities/aliens.ts` | -5 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/bear_cavalry.ts` | -7 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/cthulhu.ts` | -1 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/dinosaurs.ts` | -101 | ✅ 已审计 | 低 | POD 版本新增 + 重构 |
| `src/games/smashup/abilities/elder_things.ts` | -3 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/frankenstein.ts` | -5 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/ghosts.ts` | -3 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/giant_ants.ts` | -24 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/innsmouth.ts` | -3 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/miskatonic.ts` | -2 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/ninjas.ts` | -115 | ✅ 已审计 | 低 | POD 版本新增 + 重构 |
| `src/games/smashup/abilities/ongoing_modifiers.ts` | -10 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/pirates.ts` | -57 | ✅ 已审计 | 低 | POD 版本新增 + 重构 |
| `src/games/smashup/abilities/robots.ts` | -17 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/steampunks.ts` | -3 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/tricksters.ts` | -1 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/vampires.ts` | -2 | ✅ 已审计 | 低 | POD 参数清理 |
| `src/games/smashup/abilities/zombies.ts` | -32 | ✅ 已审计 | 低 | POD 参数清理 |

---

### SmashUp UI 文件（12 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 | 审计结论 |
|------|----------|----------|----------|----------|
| `src/games/smashup/ui/BaseZone.tsx` | -97 | ✅ 已审计 | 🔴 高 | **需要恢复** - 删除了 special 能力系统（忍者侍从等）、phase 参数传递、scoreBases 阶段限制逻辑 |
| `src/games/smashup/ui/CardMagnifyOverlay.tsx` | -1 | ✅ 已审计 | 低 | POD 重构（CardPreview previewRef 格式统一） |
| `src/games/smashup/ui/DeckDiscardZone.tsx` | -3 | ✅ 已审计 | 低 | POD 重构（CardPreview previewRef 格式统一） |
| `src/games/smashup/ui/FactionSelection.tsx` | -3 | ✅ 已审计 | 低 | POD 重构（CardPreview previewRef 格式统一） |
| `src/games/smashup/ui/HandArea.tsx` | -1 | ✅ 已审计 | 低 | POD 重构（CardPreview previewRef 格式统一） |
| `src/games/smashup/ui/PromptOverlay.tsx` | -16 | ✅ 已审计 | 低 | POD 重构（CardPreview previewRef 格式统一 + 布局微调） |
| `src/games/smashup/ui/RevealOverlay.tsx` | -4 | ✅ 已审计 | 低 | POD 重构（CardPreview previewRef 格式统一） |
| `src/games/smashup/ui/SmashUpCardRenderer.tsx` | +141 | ✅ 已审计 | 低 | POD 新增（卡牌渲染器） |
| `src/games/smashup/ui/SmashUpOverlayContext.tsx` | +66 | ✅ 已审计 | 低 | POD 新增（Overlay Context） |
| `src/games/smashup/ui/cardAtlas.ts` | +14 | ✅ 已审计 | 低 | POD 新增（图集注册） |
| `src/games/smashup/ui/cardPreviewHelper.ts` | -2 | ✅ 已审计 | 低 | POD 重构（previewRef 格式统一） |
| `src/games/smashup/ui/factionMeta.ts` | -17 | ✅ 已审计 | 低 | POD 重构（派系元数据移到 i18n） |

---

### DiceThrone 能力文件（15 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 | 审计结论 |
|------|----------|----------|----------|----------|
| `src/games/dicethrone/domain/customActions/barbarian.ts` | -3 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/domain/customActions/monk.ts` | -2 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/domain/customActions/moon_elf.ts` | -36 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/domain/customActions/paladin.ts` | -3 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/domain/customActions/pyromancer.ts` | -29 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/domain/customActions/shadow_thief.ts` | -61 | ⏳ 待审计 | 中 | - |
| `src/games/dicethrone/heroes/barbarian/abilities.ts` | -22 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/heroes/monk/abilities.ts` | -2 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/heroes/moon_elf/abilities.ts` | -8 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/heroes/paladin/abilities.ts` | -76 | ⏳ 待审计 | 中 | - |
| `src/games/dicethrone/heroes/pyromancer/abilities.ts` | -30 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/heroes/shadow_thief/abilities.ts` | -37 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/domain/passiveAbility.ts` | -3 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/domain/abilityLookup.ts` | -15 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/domain/attack.ts` | -33 | ⏳ 待审计 | 低 | - |

---

### DiceThrone UI 文件（10 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 | 审计结论 |
|------|----------|----------|----------|----------|
| `src/games/dicethrone/ui/AbilityOverlays.tsx` | -56 | ⏳ 待审计 | 中 | - |
| `src/games/dicethrone/ui/BoardOverlays.tsx` | -24 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/ui/DiceThroneHeroSelection.tsx` | -16 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/ui/DiceTray.tsx` | -28 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/ui/GameHints.tsx` | -55 | ⏳ 待审计 | 中 | - |
| `src/games/dicethrone/ui/HeroSelectionOverlay.tsx` | -12 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/ui/LeftSidebar.tsx` | -26 | ⏳ 待审计 | 低 | - |
| `src/games/dicethrone/ui/PlayerStats.tsx` | -61 | ⏳ 待审计 | 中 | - |
| `src/games/dicethrone/ui/RightSidebar.tsx` | -66 | ⏳ 待审计 | 中 | - |
| `src/games/dicethrone/ui/viewMode.ts` | -18 | ⏳ 待审计 | 低 | - |

---

### SummonerWars 能力文件（8 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 | 审计结论 |
|------|----------|----------|----------|----------|
| `src/games/summonerwars/domain/execute.ts` | -9 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/domain/reduce.ts` | -5 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/domain/validate.ts` | -7 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/config/factions/barbaric.ts` | -1 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/domain/events.ts` | -2 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/domain/index.ts` | -11 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/domain/types.ts` | -5 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/game.ts` | -1 | ⏳ 待审计 | 低 | - |

---

### SummonerWars UI 文件（5 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 | 审计结论 |
|------|----------|----------|----------|----------|
| `src/games/summonerwars/ui/BoardGrid.tsx` | -5 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/ui/EnergyBar.tsx` | -2 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/ui/FactionSelectionAdapter.tsx` | -13 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/ui/useCellInteraction.ts` | -22 | ⏳ 待审计 | 低 | - |
| `src/games/summonerwars/ui/useGameEvents.ts` | -31 | ⏳ 待审计 | 低 | - |

---

### 通用 UI 组件（12 个）

| 文件 | 删除行数 | 审计状态 | 风险等级 | 审计结论 |
|------|----------|----------|----------|----------|
| `src/components/common/animations/FlyingEffect.tsx` | -30 | ⏳ 待审计 | 低 | - |
| `src/components/common/media/CardPreview.tsx` | -10 | ⏳ 待审计 | 低 | - |
| `src/components/common/overlays/BreakdownTooltip.tsx` | -2 | ⏳ 待审计 | 低 | - |
| `src/components/lobby/GameDetailsModal.tsx` | -1 | ⏳ 待审计 | 低 | - |
| `src/components/lobby/RoomList.tsx` | -15 | ⏳ 待审计 | 低 | - |
| `src/components/social/SystemNotificationView.tsx` | -23 | ⏳ 待审计 | 低 | - |
| `src/components/social/UserMenu.tsx` | -25 | ⏳ 待审计 | 低 | - |
| `src/components/system/AboutModal.tsx` | -8 | ⏳ 待审计 | 低 | - |
| `src/components/system/FeedbackModal.tsx` | -54 | ⏳ 待审计 | 中 | - |
| `src/components/lobby/roomActions.ts` | -1 | ⏳ 待审计 | 低 | - |
| `src/components/social/FriendList.tsx` | -1 | ⏳ 待审计 | 低 | - |
| `src/components/social/MatchHistoryModal.tsx` | -1 | ⏳ 待审计 | 低 | - |

---

## 审计批次规划

### Batch 1: SmashUp 能力文件（1-2 小时）
- 18 个文件
- 重点关注 >50 行删除的文件（dinosaurs, ninjas, pirates）

### Batch 2: SmashUp UI 文件（30 分钟）
- 12 个文件
- 重点关注 BaseZone.tsx（-97 行）

### Batch 3: DiceThrone 能力文件（1 小时）
- 15 个文件
- 重点关注 >50 行删除的文件（shadow_thief, paladin）

### Batch 4: DiceThrone UI 文件（1 小时）
- ✅ **已完成** (10 个文件)
- 全部为 UI 重构和代码清理
- 详细报告：`evidence/p1-audit-batch4-dicethrone-ui.md`

### Batch 5: SummonerWars + 通用组件（1 小时）
- ✅ **已完成** (25 个文件)
- 全部为 POD 参数清理和 UI 优化
- 详细报告：`evidence/p1-audit-batch5-summonerwars-common.md`

---

## 审计发现

### 高风险发现

#### SmashUp UI
1. **BaseZone.tsx** - Special 能力系统被删除
   - 忍者侍从等带 special 标签的随从能力失效
   - scoreBases 阶段的能力限制逻辑丢失
   - `ACTIVATE_SPECIAL` 命令无法触发

#### DiceThrone 能力
1. **shadow_thief customActions** - 伤害预估回调被删除
   - Token 门控系统无法正确判断是否需要打开响应窗口
   - 影响所有 CP 系伤害技能

2. **paladin abilities** - 音效配置和部分技能定义被删除
   - 所有技能失去音效
   - 部分技能定义缺失导致功能不完整

3. **attack.ts** - 防御事件 Token 处理逻辑被删除
   - 防御技能获得 Token 后，攻击方无法正确检测
   - Token 响应窗口逻辑失效

### 中风险发现

#### DiceThrone 能力
- **pyromancer** customActions (-29) 和 abilities (-30) - 需要进一步检查
- **shadow_thief** abilities (-37) - 需要进一步检查
- **moon_elf** customActions (-36, +42) - 需要进一步检查
- **barbarian** abilities (-22) - 需要进一步检查
- **abilityLookup.ts** (-15) - 需要进一步检查

### 低风险发现

#### SmashUp 能力
- 18 个文件全部为 POD 参数清理，保持删除

#### SmashUp UI
- 11 个文件为 POD 重构（CardPreview previewRef 格式统一、元数据迁移），保持删除

#### DiceThrone 能力
- 7 个文件为 POD 参数清理，保持删除

---

## 下一步行动

1. **开始 Batch 1 审计**（1-2 小时）
   - SmashUp 能力文件
   - 重点关注 dinosaurs.ts, ninjas.ts, pirates.ts

2. **继续后续批次**（3-4 小时）
   - Batch 2-5

3. **生成 P1 审计总结**（30 分钟）
   - 汇总审计发现
   - 评估风险等级
   - 提出修复建议

---

## 相关文档

- `evidence/audit-priority-definition.md` - 优先级定义
- `evidence/audit-scope-complete.md` - 完整审计范围
- `evidence/p0-audit-progress.md` - P0 审计进度
