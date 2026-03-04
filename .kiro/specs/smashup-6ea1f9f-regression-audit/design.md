# Design Document: Commit 6ea1f9f 全面审计

## 概述

Commit 6ea1f9f (feat: add Smash Up POD faction support) 是一个大型提交，包含：
- **115 个文件变更**
- **4711 行新增**
- **2989 行删除**

本文档定义了对该提交的全面审计计划，确保每个修改都被核查，没有遗漏的回归 bug。

## 审计范围

### 文件分类

根据 git stat，将文件分为以下类别：

#### 1. 能力文件（Ability Files）- 高风险
- `src/games/smashup/abilities/aliens.ts` (10 +-)
- `src/games/smashup/abilities/bear_cavalry.ts` (14 +-)
- `src/games/smashup/abilities/cthulhu.ts` (2 +-)
- `src/games/smashup/abilities/dinosaurs.ts` (217 +++++-------)
- `src/games/smashup/abilities/elder_things.ts` (5 +-)
- `src/games/smashup/abilities/frankenstein.ts` (15 +-)
- `src/games/smashup/abilities/ghosts.ts` (6 +-)
- `src/games/smashup/abilities/giant_ants.ts` (48 +--)
- `src/games/smashup/abilities/innsmouth.ts` (6 +-)
- `src/games/smashup/abilities/miskatonic.ts` (4 +-)
- `src/games/smashup/abilities/ninjas.ts` (316 ++++++++++++-------)
- `src/games/smashup/abilities/ongoing_modifiers.ts` (25 +-)
- `src/games/smashup/abilities/pirates.ts` (282 +++++++++++++----)
- `src/games/smashup/abilities/robots.ts` (25 +-)
- `src/games/smashup/abilities/steampunks.ts` (6 +-)
- `src/games/smashup/abilities/tricksters.ts` (2 +-)
- `src/games/smashup/abilities/vampires.ts` (7 +-)
- `src/games/smashup/abilities/zombies.ts` (98 ++++--) 

**审计重点**：
- 过滤条件完整性（`playedThisTurn`、`controller`、`uid !== xxx`）
- 字段名正确性（`powerCounters` vs `powerModifier`）
- 验证逻辑完整性（前置条件检查）
- 事件处理正确性（事件类型、payload）

#### 2. 领域层文件（Domain Files）- 高风险
- `src/games/smashup/domain/abilityHelpers.ts` (17 +-)
- `src/games/smashup/domain/abilityInteractionHandlers.ts` (21 ++)
- `src/games/smashup/domain/abilityRegistry.ts` (28 ++)
- `src/games/smashup/domain/baseAbilities.ts` (336 +++++++++++++--------)
- `src/games/smashup/domain/baseAbilities_expansion.ts` (14 +-)
- `src/games/smashup/domain/commands.ts` (81 +----)
- `src/games/smashup/domain/events.ts` (4 -)
- `src/games/smashup/domain/ids.ts` (34 +++)
- `src/games/smashup/domain/index.ts` (331 +++++--------------)
- `src/games/smashup/domain/ongoingEffects.ts` (5 -)
- `src/games/smashup/domain/ongoingModifiers.ts` (36 +--)
- `src/games/smashup/domain/reduce.ts` (86 ++----)
- `src/games/smashup/domain/reducer.ts` (320 ++-------------------)
- `src/games/smashup/domain/systems.ts` (46 +--)
- `src/games/smashup/domain/types.ts` (46 +--)

**审计重点**：
- 类型定义正确性
- 工具函数正确性
- Reducer 逻辑正确性
- 系统配置完整性

#### 3. 游戏配置文件（Game Config）- 关键
- `src/games/smashup/game.ts` - **未在 stat 中显示，需要单独检查**

**审计重点**：
- ResponseWindowSystem 配置（`allowedCommands`、`responseAdvanceEvents`、`hasRespondableContent`）
- 其他系统配置

#### 4. UI 文件（UI Files）- 中风险
- `src/games/smashup/ui/BaseZone.tsx` (175 +++++------)
- `src/games/smashup/ui/CardMagnifyOverlay.tsx` (4 +-)
- `src/games/smashup/ui/DeckDiscardZone.tsx` (7 +-)
- `src/games/smashup/ui/FactionSelection.tsx` (14 +-)
- `src/games/smashup/ui/HandArea.tsx` (4 +-)
- `src/games/smashup/ui/PromptOverlay.tsx` (30 +-)
- `src/games/smashup/ui/RevealOverlay.tsx` (7 +-)
- `src/games/smashup/ui/SmashUpCardRenderer.tsx` (141 +++++++++)
- `src/games/smashup/ui/SmashUpOverlayContext.tsx` (66 ++++)
- `src/games/smashup/ui/cardAtlas.ts` (14 +)
- `src/games/smashup/ui/cardPreviewHelper.ts` (8 +-)
- `src/games/smashup/ui/factionMeta.ts` (55 ++--)
- `src/games/smashup/ui/playerConfig.ts` (8 +-)

**审计重点**：
- UI 逻辑正确性（不影响游戏规则）
- 组件渲染正确性

#### 5. 测试文件（Test Files）- 中风险
共 40+ 个测试文件，包括：
- `__tests__/factionAbilities.test.ts` (301 +-----------------)
- `__tests__/newFactionAbilities.test.ts` (66 ++--)
- `__tests__/newOngoingAbilities.test.ts` (303 +-------------------)
- `__tests__/meFirst.test.ts` (5 +-)
- 等等...

**审计重点**：
- 测试覆盖是否完整
- 测试断言是否正确
- 是否删除了关键测试用例

#### 6. 数据文件（Data Files）- 低风险
- `src/games/smashup/data/cards.ts` (67 +++-)
- `src/games/smashup/data/factions/*.ts` (新增 POD 派系文件)

**审计重点**：
- 数据定义正确性
- 新增 POD 派系数据完整性

## 审计策略

### 阶段 1：已知问题验证（P0）

#### 1.1 Killer Queen talent（已修复）
- **文件**：`src/games/smashup/abilities/giant_ants.ts`
- **检查项**：
  - ✅ 是否包含 `playedThisTurn` 过滤条件
  - ✅ 是否包含 `uid !== ctx.cardUid` 过滤条件
- **验证方法**：
  - 读取当前代码确认修复
  - 运行 `newFactionAbilities.test.ts` 中的 Killer Queen 测试

#### 1.2 ResponseWindowSystem 配置（需要验证）
- **文件**：`src/games/smashup/game.ts`
- **检查项**：
  - ✅ `allowedCommands` 是否包含 `'su:play_minion'`
  - ✅ `commandWindowTypeConstraints` 是否包含 `'su:play_minion': ['meFirst']`
  - ✅ `responseAdvanceEvents` 是否包含 `{ eventType: 'su:minion_played', windowTypes: ['meFirst'] }`
  - ✅ `hasRespondableContent` 是否检查 `beforeScoringPlayable` 随从
- **验证方法**：
  - 读取当前代码确认修复
  - 运行 `meFirst.test.ts` 测试
  - 手动测试影舞者在 Me First! 响应窗口中的行为

### 阶段 2：字段名错误全面检查（P1）

#### 2.1 powerCounters vs powerModifier
- **检查范围**：所有 ability 文件
- **检查方法**：
  ```bash
  # 搜索所有使用 powerModifier 的地方
  grep -r "powerModifier" src/games/smashup/abilities/
  
  # 对比原始正确版本（commit 232214d）
  git diff 232214d^..6ea1f9f -- src/games/smashup/abilities/ | grep -E "(powerCounters|powerModifier)"
  ```
- **已知问题**：
  - 兵蚁 talent
  - 雄蜂 protection
  - 如同魔法
  - 我们将震撼你
  - 承受压力
  - 我们乃最强
- **验证方法**：
  - 确认所有地方使用 `powerCounters ?? 0`
  - 运行相关测试

### 阶段 3：过滤条件全面检查（P1）

#### 3.1 检查所有 filter 调用
- **检查范围**：所有 ability 文件
- **检查方法**：
  ```bash
  # 获取所有 filter 调用的 diff
  git diff 232214d^..6ea1f9f -- src/games/smashup/abilities/ | grep -B5 -A5 "\.filter"
  ```
- **检查维度**：
  - 是否删除了 `playedThisTurn` 检查
  - 是否删除了 `controller` 检查
  - 是否删除了 `uid !== xxx` 检查
  - 是否删除了其他关键条件

### 阶段 4：验证逻辑全面检查（P2）

#### 4.1 检查所有 validate 函数
- **检查范围**：所有 ability 文件中的 `validate` 函数
- **检查方法**：
  ```bash
  # 获取所有 validate 函数的 diff
  git diff 232214d^..6ea1f9f -- src/games/smashup/abilities/ | grep -B10 -A10 "validate:"
  ```
- **检查维度**：
  - 是否删除了前置条件检查
  - 是否删除了资源检查
  - 是否删除了目标有效性检查

### 阶段 5：事件处理全面检查（P2）

#### 5.1 检查所有事件产生
- **检查范围**：所有 ability 文件中的事件产生代码
- **检查方法**：
  ```bash
  # 获取所有事件产生的 diff
  git diff 232214d^..6ea1f9f -- src/games/smashup/abilities/ | grep -B5 -A5 "eventType:"
  ```
- **检查维度**：
  - 事件类型是否正确
  - 事件 payload 是否完整
  - 是否缺少必要的事件

### 阶段 6：测试覆盖全面检查（P3）

#### 6.1 检查测试文件变更
- **检查范围**：所有 `__tests__/*.test.ts` 文件
- **检查方法**：
  ```bash
  # 获取测试文件的 diff 统计
  git diff 232214d^..6ea1f9f --stat -- src/games/smashup/__tests__/
  
  # 检查是否有大量删除的测试
  git diff 232214d^..6ea1f9f -- src/games/smashup/__tests__/ | grep -E "^-.*test\(|^-.*it\("
  ```
- **检查维度**：
  - 是否删除了关键测试用例
  - 测试断言是否正确
  - 测试覆盖是否完整

## 执行计划

### Task 1: 验证已知问题修复状态
- **优先级**：P0
- **预计时间**：30 分钟
- **输出**：已知问题修复状态报告

### Task 2: 检查 game.ts 配置
- **优先级**：P0
- **预计时间**：15 分钟
- **输出**：ResponseWindowSystem 配置验证报告

### Task 3: 全面检查 powerCounters vs powerModifier
- **优先级**：P1
- **预计时间**：1 小时
- **输出**：字段名错误清单和修复状态

### Task 4: 全面检查过滤条件
- **优先级**：P1
- **预计时间**：2 小时
- **输出**：过滤条件缺失清单和修复状态

### Task 5: 检查验证逻辑
- **优先级**：P2
- **预计时间**：1.5 小时
- **输出**：验证逻辑问题清单和修复状态

### Task 6: 检查事件处理
- **优先级**：P2
- **预计时间**：1.5 小时
- **输出**：事件处理问题清单和修复状态

### Task 7: 检查测试覆盖
- **优先级**：P3
- **预计时间**：1 小时
- **输出**：测试覆盖问题清单和修复状态

### Task 8: 运行所有测试
- **优先级**：P0
- **预计时间**：30 分钟
- **输出**：测试结果报告

### Task 9: 编写审计总结报告
- **优先级**：P0
- **预计时间**：30 分钟
- **输出**：完整的审计报告

## 工具和脚本

### Git Diff 分析脚本
```bash
# 获取完整的 diff
git show 6ea1f9f > /tmp/6ea1f9f-full-diff.txt

# 获取 SmashUp 相关的 diff
git show 6ea1f9f -- 'src/games/smashup/**/*.ts' > /tmp/6ea1f9f-smashup-diff.txt

# 对比原始正确版本
git diff 232214d^..6ea1f9f -- 'src/games/smashup/**/*.ts' > /tmp/6ea1f9f-vs-232214d.txt
```

### 关键词搜索脚本
```bash
# 搜索 powerModifier（应该是 powerCounters）
grep -rn "powerModifier" src/games/smashup/abilities/ > /tmp/powerModifier-usage.txt

# 搜索 playedThisTurn
grep -rn "playedThisTurn" src/games/smashup/abilities/ > /tmp/playedThisTurn-usage.txt

# 搜索 ResponseWindowSystem 配置
grep -A20 "createResponseWindowSystem" src/games/smashup/game.ts > /tmp/response-window-config.txt
```

### 测试运行脚本
```bash
# 运行所有 SmashUp 测试
npm test -- smashup 2>&1 | tee /tmp/smashup-test-results.txt

# 运行特定测试
npm test -- newFactionAbilities.test.ts 2>&1 | tee /tmp/killer-queen-test.txt
npm test -- meFirst.test.ts 2>&1 | tee /tmp/me-first-test.txt
```

## 成功标准

审计完成的标准：

1. ✅ 所有 P0 问题已验证和修复
2. ✅ 所有 P1 问题已识别和修复
3. ✅ 所有 P2 问题已识别（修复可选）
4. ✅ 所有 P3 问题已识别（修复可选）
5. ✅ 所有 SmashUp 测试通过
6. ✅ 编写完整的审计报告
7. ✅ 没有遗漏的回归问题

## 风险和缓解

### 风险 1：审计范围过大
- **影响**：可能遗漏某些问题
- **缓解**：使用自动化脚本辅助，分阶段执行

### 风险 2：原始正确版本不明确
- **影响**：无法确定哪些变更是 bug
- **缓解**：使用 commit 232214d 作为基准，必要时追溯更早的版本

### 风险 3：测试覆盖不足
- **影响**：某些 bug 无法通过测试发现
- **缓解**：结合手动验证和代码审查

### 风险 4：修复引入新问题
- **影响**：修复一个 bug 可能引入新 bug
- **缓解**：每次修复后运行完整测试套件

## 附录

### A. 已知问题清单

| 问题 ID | 文件 | 问题描述 | 状态 | 优先级 |
|---------|------|----------|------|--------|
| BUG-001 | `giant_ants.ts` | Killer Queen 缺少 `playedThisTurn` 过滤 | 已修复 | P0 |
| BUG-002 | `giant_ants.ts` | Killer Queen 缺少 `uid !== ctx.cardUid` 过滤 | 已修复 | P0 |
| BUG-003 | `game.ts` | ResponseWindowSystem 缺少 `su:play_minion` 配置 | 需要验证 | P0 |
| BUG-004 | 多个文件 | `powerCounters` 错误替换为 `powerModifier` | 部分修复 | P1 |

### B. 审计检查清单

- [ ] Task 1: 验证已知问题修复状态
- [ ] Task 2: 检查 game.ts 配置
- [ ] Task 3: 全面检查 powerCounters vs powerModifier
- [ ] Task 4: 全面检查过滤条件
- [ ] Task 5: 检查验证逻辑
- [ ] Task 6: 检查事件处理
- [ ] Task 7: 检查测试覆盖
- [ ] Task 8: 运行所有测试
- [ ] Task 9: 编写审计总结报告

### C. 参考文档

- `docs/ai-rules/testing-audit.md` - 审计规范
- `docs/ai-rules/engine-systems.md` - 引擎系统规范
- `docs/automated-testing.md` - 测试规范
- `tmp/6ea1f9f-bug-summary.md` - 已知 bug 总结
- `tmp/6ea1f9f-critical-bugs.md` - 关键 bug 文档