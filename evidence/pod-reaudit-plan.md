# POD 提交重新审计计划

**审计时间**: 2026-03-04  
**审计目标**: 识别所有 POD 无关文件的修改（不只是删除，还包括逻辑变更）  
**审计原则**: POD 提交不应该修改任何非 POD 相关的代码

---

## 文件分类

### ✅ POD 相关（应该保留）- 约 25 个文件

#### 1. POD 派系数据文件（21 个）
- `src/games/smashup/data/factions/*_pod.ts` (21 个文件)

#### 2. POD UI 组件（2 个）
- `src/games/smashup/ui/SmashUpCardRenderer.tsx`
- `src/games/smashup/ui/SmashUpOverlayContext.tsx`

#### 3. POD 图集映射（1 个）
- `src/games/smashup/data/englishAtlasMap.json`

#### 4. POD 相关注册（部分修改）
- `src/games/smashup/domain/ids.ts` - 仅 POD 派系 ID
- `src/games/smashup/ui/factionMeta.ts` - 仅 POD 派系元数据
- `public/locales/*/game-smashup.json` - 仅 POD 派系翻译

---

### ❌ POD 无关（需要审计）- 约 311 个文件

按优先级和模块分类：

## P0: 核心游戏逻辑（高优先级）

### 1. DiceThrone 游戏层（约 106 个文件）

#### Board.tsx（已发现 2 个问题）
- ✅ 已修复：`hasDivergentVariants` effect 类型比较逻辑
- ✅ 已修复：`showAdvancePhaseButton` 逻辑错误
- ⚠️ 需要审计：其他小的逻辑修改

**审计方法**：
```bash
# 查看所有修改（不只是删除）
git diff 6ea1f9f^..6ea1f9f -- src/games/dicethrone/Board.tsx

# 重点关注：
# 1. 条件判断的修改（if/else/&&/||）
# 2. 参数传递的修改
# 3. 默认值的修改
# 4. 函数调用的修改
```

#### 其他 DiceThrone 文件
- `src/games/dicethrone/game.ts` (258 行变更)
- `src/games/dicethrone/domain/*.ts` (50+ 个文件)
- `src/games/dicethrone/heroes/*.ts` (所有英雄文件)
- `src/games/dicethrone/ui/*.tsx` (20+ 个 UI 文件)
- `src/games/dicethrone/__tests__/*.test.ts` (30+ 个测试文件)

### 2. SummonerWars 游戏层（18 个文件）
- `src/games/summonerwars/Board.tsx`
- `src/games/summonerwars/game.ts`
- `src/games/summonerwars/domain/*.ts`
- `src/games/summonerwars/ui/*.tsx`
- `src/games/summonerwars/__tests__/*.test.ts`

### 3. TicTacToe 游戏层（2 个文件）
- `src/games/tictactoe/domain/index.ts`
- `src/games/tictactoe/domain/types.ts`

### 4. SmashUp 非 POD 派系（约 20 个文件）
- `src/games/smashup/abilities/aliens.ts`
- `src/games/smashup/abilities/dinosaurs.ts`
- `src/games/smashup/abilities/ninjas.ts`
- `src/games/smashup/abilities/pirates.ts`
- `src/games/smashup/abilities/robots.ts`
- 其他已有派系的能力文件

---

## P1: 引擎层（高优先级）

### 引擎核心（15+ 个文件）
- `src/engine/pipeline.ts` (111 行变更)
- `src/engine/adapter.ts`
- `src/engine/hooks/useEventStreamCursor.ts` (107 行变更)
- `src/engine/primitives/actionLogHelpers.ts` (204 行变更)
- `src/engine/primitives/damageCalculation.ts`
- `src/engine/transport/server.ts` (247 行变更)
- `src/engine/transport/client.ts` (72 行变更)
- `src/engine/transport/react.tsx` (100 行变更)
- `src/engine/transport/protocol.ts` (16 行删除)
- `src/engine/systems/InteractionSystem.ts` (30 行变更)
- `src/engine/systems/FlowSystem.ts` (7 行删除)
- `src/engine/systems/SimpleChoiceSystem.ts`
- `src/engine/systems/UndoSystem.ts`
- `src/engine/types.ts`

**注意**: 引擎层修改会影响所有游戏

---

## P2: 框架层（中优先级）

### 框架组件（10+ 个文件）
- `src/components/game/framework/widgets/GameHUD.tsx` (118 行变更)
- `src/components/game/framework/widgets/RematchActions.tsx` (177 行变更)
- `src/components/game/framework/hooks/useAutoSkipPhase.ts` (24 行变更)
- `src/components/game/framework/CharacterSelectionSkeleton.tsx`
- `src/components/game/framework/widgets/GameDebugPanel.tsx`

---

## P3: 服务端（高优先级）

### 服务端代码（7 个文件）
- `src/server/storage/HybridStorage.ts` (298 行变更)
- `src/server/storage/MongoStorage.ts` (71 行变更)
- `src/server/models/MatchRecord.ts`
- `src/server/claimSeat.ts`
- `src/server/storage/__tests__/*.test.ts`

---

## P4: 通用组件（中优先级）

### 通用组件（10+ 个文件）
- `src/components/common/animations/FlyingEffect.tsx`
- `src/components/common/media/CardPreview.tsx`
- `src/components/common/overlays/BreakdownTooltip.tsx`
- `src/components/lobby/*.tsx` (5 个文件)
- `src/components/social/*.tsx` (5 个文件)
- `src/components/system/*.tsx` (3 个文件)

---

## P5: 全局工具和配置（中优先级）

### 全局文件（10+ 个文件）
- `src/App.tsx` (17 行变更)
- `src/main.tsx` (6 行删除)
- `src/index.css` (34 行删除)
- `src/lib/utils.ts` (48 行删除)
- `src/lib/audio/AudioManager.ts`
- `src/lib/audio/useGameAudio.ts` (61 行变更)
- `src/lib/i18n/zh-CN-bundled.ts`
- `src/core/AssetLoader.ts`
- `src/contexts/*.tsx` (3 个文件)

---

## P6: 国际化文件（低优先级）

### i18n 文件（16 个文件）
- `public/locales/en/*.json` (8 个文件)
- `public/locales/zh-CN/*.json` (8 个文件)

**注意**: 需要区分 POD 相关和非 POD 相关的翻译

---

## P7: 测试文件（低优先级）

### 测试文件（约 80 个文件）
- DiceThrone 测试（30+ 个）
- SmashUp 测试（40+ 个）
- SummonerWars 测试（2 个）
- 引擎层测试（5+ 个）
- 服务端测试（2 个）

---

## 审计方法

### 1. 逐文件对比（关键）

```bash
# 查看文件的所有修改（不只是删除）
git diff 6ea1f9f^..6ea1f9f -- <file>

# 重点关注：
# 1. 条件判断的修改（if/else/&&/||）
# 2. 参数传递的修改
# 3. 默认值的修改
# 4. 函数调用的修改
# 5. 类型定义的修改
```

### 2. 历史追溯（必须）

```bash
# 查看文件的提交历史
git log --oneline -20 -- <file>

# 查看最近的修改
git show <commit>:<file>

# 判断：
# - 是否是最近的 bug 修复（< 1 周）
# - 是否是重要功能
# - 是否有测试覆盖
```

### 3. 使用情况检查（必须）

```bash
# 搜索函数/变量的使用情况
rg "functionName" --type ts --type tsx

# 判断：
# - 是否有代码使用
# - 是否是核心功能
# - 删除/修改是否会影响其他代码
```

### 4. 测试验证（推荐）

```bash
# 运行相关测试
npm run test -- <test-file>

# 判断：
# - 测试是否通过
# - 是否有测试覆盖
# - 修改是否破坏功能
```

---

## 审计输出格式

对每个文件，输出以下信息：

```markdown
### 文件: <file-path>

**变更类型**: 删除 / 修改 / 新增  
**变更行数**: +X -Y  
**POD 相关性**: ✅ POD 相关 / ❌ POD 无关

#### 变更内容
1. 变更 1 描述
2. 变更 2 描述

#### 历史追溯
- 最近提交: <commit> - <message>
- 是否是 bug 修复: 是 / 否
- 是否是重要功能: 是 / 否

#### 使用情况
- 是否有代码使用: 是 / 否
- 影响范围: 局部 / 全局

#### 判断
- ✅ 应该保留 - 理由
- ❌ 应该回滚 - 理由
- ⚠️ 需要进一步调查 - 理由

#### 测试验证
- 测试是否通过: 是 / 否
- 测试覆盖: 有 / 无
```

---

## 执行计划

### Phase 1: DiceThrone Board.tsx 完整审计（1 小时）
- 目标: 找出所有小的逻辑修改
- 方法: 逐行对比 `git diff`
- 输出: 完整的变更清单

### Phase 2: DiceThrone 其他文件审计（2 小时）
- 目标: 审计 game.ts、domain/、heroes/、ui/
- 方法: 按优先级逐个审计
- 输出: 每个文件的审计报告

### Phase 3: 引擎层审计（2 小时）
- 目标: 审计所有引擎层文件
- 方法: 重点关注逻辑修改
- 输出: 引擎层审计报告

### Phase 4: 其他模块审计（3 小时）
- 目标: 审计框架层、服务端、通用组件
- 方法: 按优先级逐个审计
- 输出: 完整的审计报告

### Phase 5: 总结和修复（1 小时）
- 目标: 汇总所有发现的问题
- 方法: 生成修复清单
- 输出: 最终审计报告和修复计划

---

## 预期成果

1. **完整的变更清单**: 所有 POD 无关文件的所有修改
2. **问题分类**: 应该保留 / 应该回滚 / 需要调查
3. **修复计划**: 优先级排序的修复清单
4. **测试验证**: 每个修复的测试验证

---

## 开始执行

**当前状态**: 计划已创建，等待执行  
**下一步**: Phase 1 - DiceThrone Board.tsx 完整审计

---

## 已发现的问题（持续更新）

### 1. DiceThrone Board.tsx
- ✅ 已修复：`hasDivergentVariants` effect 类型比较逻辑
- ✅ 已修复：`showAdvancePhaseButton` 逻辑错误
- ⏳ 待审计：其他小的逻辑修改

### 2. 其他文件
- ⏳ 待审计
