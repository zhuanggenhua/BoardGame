# POD 提交范围审计报告

## 审计原则

**核心原则**: POD 提交（`6ea1f9f` - "feat: add Smash Up POD faction support"）应该只包含 POD 相关的代码，不应该修改任何非 POD 相关的代码。

**审计目标**: 识别所有非 POD 相关的修改，生成回滚清单。

---

## 提交概览

- **Commit**: `6ea1f9f`
- **标题**: feat: add Smash Up POD faction support with full UI and ability system
- **日期**: 2026-02-28
- **文件数**: 336 个文件被修改
- **变更量**: +9026 insertions, -9580 deletions

---

## 文件分类标准

###  POD 相关（应该修改）
- 新增的 POD 派系数据文件（`*_pod.ts`）
- POD 相关的 UI 组件（`SmashUpCardRenderer`, `SmashUpOverlayContext`）
- POD 相关的图集映射（`englishAtlasMap.json`）
- POD 相关的 i18n 条目（仅限新增 POD 派系的翻译）

###  非 POD 相关（不应该修改）
- DiceThrone 的任何文件
- SummonerWars 的任何文件
- TicTacToe 的任何文件
- 引擎层文件（`src/engine/`）
- 框架层文件（`src/components/game/framework/`）
- 通用组件（`src/components/common/`）
- 全局 Context（`src/contexts/`）
- 服务端代码（`src/server/`）
- 已有 SmashUp 派系的能力实现（非 POD）

---

## 审计结果

###  非 POD 相关的修改（需要回滚）

#### 1. DiceThrone 模块（106 个文件）

**严重程度**:  严重 - 完全不应该修改

**文件清单**:
- `src/games/dicethrone/Board.tsx` - 161 行变更（包含 hasDivergentVariants 回滚）
- `src/games/dicethrone/game.ts` - 258 行变更
- `src/games/dicethrone/domain/` - 50+ 个文件
- `src/games/dicethrone/__tests__/` - 30+ 个测试文件
- `src/games/dicethrone/ui/` - 20+ 个 UI 文件
- `src/games/dicethrone/heroes/` - 所有英雄文件

**关键问题**:
1.  **Board.tsx 第 78-106 行**: 删除了 `hasDivergentVariants` 函数中的 effect 类型比较逻辑
   - 这是 `021f955` 提交的 bug 修复，不应该被回滚
   - 导致 7 组分歧型能力被误判为增量型
2.  **Board.tsx 第 226-248 行**: 删除了自动响应功能
3.  **Board.tsx 第 411-422 行**: 删除了太极令牌本回合限制逻辑
4.  **Board.tsx 第 828-850 行**: 删除了响应窗口视角自动切换
5.  **Board.tsx 第 1088-1097 行**: 删除了变体排序逻辑

**回滚建议**:  **完全回滚所有 DiceThrone 文件的修改**

---

#### 2. 引擎层（15+ 个文件）

**严重程度**:  严重 - 影响所有游戏

**文件清单**:
- `src/engine/pipeline.ts` - 111 行变更
- `src/engine/hooks/useEventStreamCursor.ts` - 107 行变更
- `src/engine/primitives/actionLogHelpers.ts` - 204 行变更
- `src/engine/transport/server.ts` - 247 行变更
- `src/engine/transport/client.ts` - 72 行变更
- `src/engine/transport/react.tsx` - 100 行变更
- `src/engine/transport/protocol.ts` - 16 行删除
- `src/engine/systems/InteractionSystem.ts` - 30 行变更
- `src/engine/systems/FlowSystem.ts` - 7 行删除
- 其他引擎文件

**关键问题**:
- 引擎层修改会影响所有游戏（DiceThrone, SmashUp, SummonerWars, TicTacToe）
- POD 派系不应该需要修改引擎层

**回滚建议**:  **完全回滚所有引擎层文件的修改**

---

#### 3. 框架层（10+ 个文件）

**严重程度**:  中等 - 影响所有游戏的 UI

**文件清单**:
- `src/components/game/framework/widgets/GameHUD.tsx` - 118 行变更
- `src/components/game/framework/widgets/RematchActions.tsx` - 177 行变更
- `src/components/game/framework/hooks/useAutoSkipPhase.ts` - 24 行变更
- `src/components/game/framework/CharacterSelectionSkeleton.tsx` - 2 行变更
- `src/components/game/framework/widgets/GameDebugPanel.tsx` - 7 行变更

**回滚建议**:  **完全回滚所有框架层文件的修改**

---

#### 4. SummonerWars 模块（18 个文件）

**严重程度**:  严重 - 完全不应该修改

**文件清单**:
- `src/games/summonerwars/Board.tsx` - 53 行变更
- `src/games/summonerwars/game.ts` - 2 行变更
- `src/games/summonerwars/domain/` - 7 个文件
- `src/games/summonerwars/ui/` - 7 个文件
- `src/games/summonerwars/__tests__/` - 2 个测试文件

**回滚建议**:  **完全回滚所有 SummonerWars 文件的修改**

---

#### 5. TicTacToe 模块（2 个文件）

**严重程度**:  严重 - 完全不应该修改

**文件清单**:
- `src/games/tictactoe/domain/index.ts` - 19 行变更
- `src/games/tictactoe/domain/types.ts` - 2 行删除

**回滚建议**:  **完全回滚所有 TicTacToe 文件的修改**

---

#### 6. 通用组件（10+ 个文件）

**严重程度**:  中等

**文件清单**:
- `src/components/common/animations/FlyingEffect.tsx` - 33 行变更
- `src/components/common/media/CardPreview.tsx` - 12 行变更
- `src/components/common/overlays/BreakdownTooltip.tsx` - 3 行变更
- `src/components/lobby/` - 5 个文件
- `src/components/social/` - 5 个文件
- `src/components/system/` - 3 个文件

**回滚建议**:  **需要逐个审查，大部分应该回滚**

---

#### 7. 全局 Context（3 个文件）

**严重程度**:  中等

**文件清单**:
- `src/contexts/RematchContext.tsx` - 1 行删除
- `src/contexts/SocialContext.tsx` - 3 行变更
- `src/contexts/ToastContext.tsx` - 3 行变更

**回滚建议**:  **需要审查，可能应该回滚**

---

#### 8. 服务端代码（7 个文件）

**严重程度**:  严重

**文件清单**:
- `src/server/storage/HybridStorage.ts` - 298 行变更
- `src/server/storage/MongoStorage.ts` - 71 行变更
- `src/server/models/MatchRecord.ts` - 9 行变更
- `src/server/claimSeat.ts` - 12 行变更
- `src/server/storage/__tests__/` - 2 个测试文件

**回滚建议**:  **完全回滚所有服务端文件的修改**

---

#### 9. 全局工具和配置（10+ 个文件）

**严重程度**:  中等

**文件清单**:
- `src/App.tsx` - 17 行变更
- `src/main.tsx` - 6 行删除
- `src/index.css` - 34 行删除
- `src/lib/utils.ts` - 48 行删除
- `src/lib/audio/AudioManager.ts` - 4 行变更
- `src/lib/audio/useGameAudio.ts` - 61 行变更
- `src/lib/i18n/zh-CN-bundled.ts` - 16 行变更
- `src/core/AssetLoader.ts` - 11 行变更
- `src/assets/audio/registry-slim.json` - 2 行变更

**回滚建议**:  **需要逐个审查**

---

#### 10. 已有 SmashUp 派系的能力实现（非 POD）

**严重程度**:  中等到严重

**文件清单**:
- `src/games/smashup/abilities/aliens.ts` - 10 行变更
- `src/games/smashup/abilities/dinosaurs.ts` - 217 行变更
- `src/games/smashup/abilities/ninjas.ts` - 316 行变更
- `src/games/smashup/abilities/pirates.ts` - 282 行变更
- `src/games/smashup/abilities/robots.ts` - 25 行变更
- 其他已有派系的能力文件

**关键问题**:
- 这些是已有派系的能力实现，不应该在 POD 提交中修改
- 可能包含 bug 修复或重构，需要逐个审查

**回滚建议**:  **需要逐个审查，区分 bug 修复和不必要的修改**

---

###  POD 相关的修改（应该保留）

#### 1. POD 派系数据文件（21 个新增文件）

**文件清单**:
- `src/games/smashup/data/factions/aliens_pod.ts`
- `src/games/smashup/data/factions/bear_cavalry_pod.ts`
- `src/games/smashup/data/factions/cthulhu_pod.ts`
- `src/games/smashup/data/factions/dinosaurs_pod.ts`
- `src/games/smashup/data/factions/elder_things_pod.ts`
- `src/games/smashup/data/factions/frankenstein_pod.ts`
- `src/games/smashup/data/factions/ghosts_pod.ts`
- `src/games/smashup/data/factions/giant-ants_pod.ts`
- `src/games/smashup/data/factions/innsmouth_pod.ts`
- `src/games/smashup/data/factions/killer_plants_pod.ts`
- `src/games/smashup/data/factions/miskatonic_pod.ts`
- `src/games/smashup/data/factions/ninjas_pod.ts`
- `src/games/smashup/data/factions/pirates_pod.ts`
- `src/games/smashup/data/factions/robots_pod.ts`
- `src/games/smashup/data/factions/steampunks_pod.ts`
- `src/games/smashup/data/factions/tricksters_pod.ts`
- `src/games/smashup/data/factions/vampires_pod.ts`
- `src/games/smashup/data/factions/werewolves_pod.ts`
- `src/games/smashup/data/factions/wizards_pod.ts`
- `src/games/smashup/data/factions/zombies_pod.ts`

**保留理由**:  这些是 POD 派系的核心数据

---

#### 2. POD 相关的 UI 组件（2 个新增文件）

**文件清单**:
- `src/games/smashup/ui/SmashUpCardRenderer.tsx`
- `src/games/smashup/ui/SmashUpOverlayContext.tsx`

**保留理由**:  POD 派系需要的 UI 组件

---

#### 3. POD 相关的图集映射（1 个新增文件）

**文件清单**:
- `src/games/smashup/data/englishAtlasMap.json`

**保留理由**:  POD 派系的英文图集映射

---

#### 4. POD 相关的 i18n 条目

**文件清单**:
- `public/locales/zh-CN/game-smashup.json` - 仅保留 POD 派系的翻译
- `public/locales/en/game-smashup.json` - 仅保留 POD 派系的翻译

**保留理由**:  POD 派系需要的翻译

**注意**: 需要审查这些文件，只保留 POD 相关的新增条目，回滚其他修改

---

#### 5. POD 派系注册（部分修改）

**文件清单**:
- `src/games/smashup/domain/ids.ts` - 仅保留 POD 派系 ID 的新增
- `src/games/smashup/ui/factionMeta.ts` - 仅保留 POD 派系元数据的新增

**保留理由**:  注册 POD 派系所必需

**注意**: 需要审查这些文件，只保留 POD 相关的新增，回滚其他修改

---

## 回滚策略

### 方案 A: 完全回滚 + 重新提交（推荐）

**步骤**:
1. 完全回滚 `6ea1f9f` 提交
2. 创建新分支 `feat/smashup-pod-clean`
3. 只提交 POD 相关的文件（21 个派系文件 + 2 个 UI 组件 + 1 个图集 + i18n）
4. 重新测试
5. 重新合并

**优点**:
- 干净、清晰
- 不会遗漏任何非 POD 修改
- 易于审查

**缺点**:
- 需要重新提交

---

### 方案 B: 选择性回滚（复杂）

**步骤**:
1. 保留 POD 相关的文件
2. 回滚所有非 POD 文件的修改
3. 逐个审查边界文件（如 `ids.ts`, `factionMeta.ts`）

**优点**:
- 保留提交历史

**缺点**:
- 复杂、容易遗漏
- 需要大量手动工作

---

## 已恢复的修改（不需要再次回滚）

根据之前的审计和修复工作，以下修改已经被恢复，不需要在本次回滚中处理：

###  已恢复的 DiceThrone 功能
1.  **hasDivergentVariants effect 类型比较** - 已在当前对话中恢复
2.  **自动响应功能** - 标记为需要恢复，但尚未执行
3.  **太极令牌本回合限制** - 标记为需要恢复，但尚未执行
4.  **响应窗口视角自动切换** - 标记为需要恢复，但尚未执行
5.  **变体排序逻辑** - 标记为需要恢复，但尚未执行

**注意**: 除了 hasDivergentVariants 已恢复外，其他功能仍需要恢复。

---

## 总结

### 统计

- **总文件数**: 336 个
- **POD 相关**: ~25 个（应该保留）
- **非 POD 相关**: ~311 个（应该回滚）
- **回滚比例**: 92.5%

### 核心问题

**POD 提交包含了大量非 POD 相关的修改，严重违反了单一职责原则。**

1.  **106 个 DiceThrone 文件** - 完全不应该修改
2.  **15+ 个引擎层文件** - 影响所有游戏
3.  **18 个 SummonerWars 文件** - 完全不应该修改
4.  **2 个 TicTacToe 文件** - 完全不应该修改
5.  **7 个服务端文件** - 完全不应该修改

### 建议

**强烈建议采用方案 A（完全回滚 + 重新提交）**，原因：
1. 非 POD 修改占 92.5%，选择性回滚工作量巨大
2. 完全回滚可以确保不遗漏任何问题
3. 重新提交可以保证代码质量和审查质量
4. 避免引入更多 bug

---

## 下一步

1. **确认回滚方案**：选择方案 A 或方案 B
2. **执行回滚**：根据选择的方案执行回滚
3. **重新提交 POD 代码**（如果选择方案 A）
4. **测试验证**：确保回滚后所有功能正常
5. **更新文档**：记录本次审计的教训


---

## 审计失败分析

### 为什么之前的审计没有发现 hasDivergentVariants 问题？

#### 问题回顾

在之前的审计中（`tmp/phase2-dicethrone-board.md`），确实发现了 `hasDivergentVariants` 函数中 effect 类型比较逻辑被删除，但被错误地归类为"合理清理"：

```markdown
### 5. 代码简化和清理（约 40 行）

**删除内容**:
- hasDivergentVariants 函数中的 console.log 语句（约 10 行）
- hasDivergentVariants 函数中的 effect 类型集合比较逻辑（约 15 行）   这里！

**影响分析**:
-  **合理清理**: 移除了调试日志和冗余逻辑   错误判断！
-  **需要验证**: hasDivergentVariants 的简化是否影响变体判断逻辑

**是否需要恢复**:  **需要测试验证**   但没有执行验证！
```

#### 审计失败的根本原因

1. **错误的分类**
   - 将 effect 类型比较逻辑归类为 **"代码简化和清理"**
   - 实际上这是 **"功能逻辑删除"**，应该归类为严重问题

2. **错误的判断**
   - 认为是 **"合理清理"** 和 **"冗余逻辑"**
   - 实际上这是 **bug 修复逻辑**，不是冗余

3. **没有执行验证**
   - 标记为 **"需要测试验证"**
   - 但实际上 **没有运行测试**
   - 也 **没有查看提交历史**

4. **缺少历史追溯**
   - 没有查看这段代码是什么时候加的
   - 没有查看 `021f955` 提交的信息
   - 如果查看了，就会发现这是 4 天前的 bug 修复

#### 正确的审计流程应该是

```bash
# 1. 查看 hasDivergentVariants 的历史
git log -p --all -- src/games/dicethrone/Board.tsx | grep -A 20 "hasDivergentVariants"

# 会发现：
# - 2026-02-24 (021f955): 添加了 effect 类型比较逻辑
# - 提交信息: "修复7组分歧型能力被误判为增量型"
# - 2026-02-28 (6ea1f9f): 删除了这个逻辑

# 2. 查看 021f955 的完整信息
git show 021f955

# 会看到：
# - 这是一个 bug 修复
# - 修复了 7 组能力的问题
# - 只过了 4 天就被回滚了

# 3. 结论
# 这不是"冗余逻辑"，这是"最近的 bug 修复被错误回滚"
# 应该立即恢复，不需要"测试验证"
```

#### 教训

1. **不要凭"看起来"判断**
   - "看起来像调试代码"  真的是调试代码
   - "看起来像冗余逻辑"  真的是冗余逻辑

2. **必须追溯历史**
   - 每个删除都要查 `git log`
   - 特别是最近的修改（< 1 周）

3. **"需要验证"必须执行**
   - 不能只标记不执行
   - 要么立即验证，要么不标记

4. **POD 提交不应该修改非 POD 代码**
   - 这是最根本的原则
   - 如果遵守这个原则，就不会有这个问题

---

## 已完成的审计工作（Phase 1-8）

根据 `tmp/ALL-PHASES-STATUS.md`，之前的审计已经完成了以下工作：

###  Phase 1: 关键问题修复（100%）
- 修复太极标记问题
- 修复其他关键 bug

###  Phase 2: UX 功能恢复（100%）
- 恢复 7 个 UX 功能
- 修复 DiceThrone 游戏层代码
- **包含**：自动响应、响应窗口视角切换、太极令牌限制、变体排序等
- **遗漏**：hasDivergentVariants effect 类型比较逻辑（被误判为"合理清理"）

###  Phase 3: 引擎层审计（100%）
- 审计 18 个引擎层文件
- 恢复 ~667 行关键代码
- 恢复增量同步系统、乐观引擎回滚支持等

###  Phase 4: GameHUD 审计（100%）
- 审计 GameHUD 组件
- 恢复相关功能

###  Phase 5: SummonerWars 审计（100%）
- 审计 SummonerWars 游戏层
- 修复相关问题

###  Phase 6: 其他模块审计（100%）
- 审计 FlyingEffect 等模块
- 修复相关问题

###  Phase 7: 测试修复（99.6%）
- 修复了 5 个问题
- 剩余 9 个问题待修复
- 问题与引擎层恢复无关

###  Phase 8: 综合审计（100%）
- 综合审计报告已完成
- 所有工作已总结

### 统计

- **审计文件数**: 19 个（18 引擎层 + 1 存储层）
- **恢复行数**: ~667 行
- **恢复功能**: 5 个关键功能
- **测试通过率**: 99.6%
- **遗漏问题**: 1 个（hasDivergentVariants）

---

## 本次审计的改进

### 新的审计原则

**核心原则**: POD 提交不应该修改任何非 POD 相关的代码

**审计方法**:
1. **列出所有被修改的文件**
2. **分类**：POD 相关 vs 非 POD 相关
3. **对于非 POD 相关的修改**：
   - **默认应该回滚**（除非有充分理由）
   - 不是"判断是否需要恢复"，而是"判断是否有理由保留"
4. **对于 POD 相关的修改**：
   - 审查代码质量
   - 确保测试覆盖

### 与之前审计的区别

| 维度 | 之前的审计 | 本次审计 |
|------|-----------|---------|
| **原则** | 逐个审查被删除的代码，判断是否需要恢复 | POD 提交不应该修改非 POD 代码，默认回滚 |
| **分类** | 按功能分类（UX、引擎、框架等） | 按 POD 相关性分类（POD vs 非 POD） |
| **判断** | 看起来像冗余  合理清理 | 非 POD 修改  应该回滚 |
| **验证** | 标记"需要验证"但不执行 | 必须追溯历史并执行验证 |
| **结果** | 恢复了大部分功能，但遗漏了 hasDivergentVariants | 识别出所有非 POD 修改，包括 hasDivergentVariants |

---

## 需要补充的工作

基于本次审计，以下工作需要补充：

### 1. 恢复 hasDivergentVariants effect 类型比较逻辑（高优先级）

**状态**:  已在当前对话中恢复

**文件**: `src/games/dicethrone/Board.tsx`

**修复内容**: 恢复 effect 类型集合比较逻辑（约 15 行）

### 2. 审查其他"合理清理"的判断（中优先级）

**需要重新审查的项目**:
- `variantToBaseMap` 移除 - 是否真的不影响技能槽位匹配？
- `canHighlightAbility` 简化 - 是否影响对手视角的技能高亮？
- 其他被标记为"合理清理"的删除

### 3. 完全回滚非 POD 修改（推荐）

**建议**: 采用方案 A（完全回滚 + 重新提交）

**原因**:
- 非 POD 修改占 92.5%
- 已经发现 1 个遗漏（hasDivergentVariants）
- 可能还有其他遗漏

---

## 最终建议

### 短期（立即执行）

1.  **恢复 hasDivergentVariants** - 已完成
2.  **测试验证** - 确认修复有效
3.  **提交修复** - 提交到代码库

### 中期（本周内）

1. **重新审查"合理清理"** - 检查是否有其他遗漏
2. **补充测试** - 为 hasDivergentVariants 添加测试
3. **更新文档** - 记录本次教训

### 长期（下次类似情况）

1. **采用新的审计原则** - POD 提交不应该修改非 POD 代码
2. **强制历史追溯** - 每个删除都要查 git log
3. **强制执行验证** - "需要验证"必须立即执行
4. **完全回滚策略** - 对于范围过大的提交，优先考虑完全回滚

