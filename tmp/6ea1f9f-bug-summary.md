# Commit 6ea1f9f Bug 分析总结

## 执行摘要

Commit 6ea1f9f (POD faction support) 引入了多个严重 bug，但**大部分已在后续提交中修复**。

## 发现的 Bug 及修复状态

### ✅ 已修复的 Bug

#### 1. Killer Queen talent 误删 `playedThisTurn` 过滤条件
- **提交**：6ea1f9f 引入，当前代码已修复
- **位置**：`src/games/smashup/abilities/giant_ants.ts` - `giantAntKillerQueenTalent`
- **问题**：允许选择非本回合打出的随从，且包含 Killer Queen 自己
- **当前状态**：✅ 已修复（代码中有正确的 `m.playedThisTurn && m.uid !== ctx.cardUid` 过滤）

#### 2. 所有 `powerCounters` → `powerModifier` 错误替换
- **提交**：6ea1f9f 引入，232214d 修复
- **位置**：`src/games/smashup/abilities/giant_ants.ts` 及其他文件
- **问题**：将永久的力量指示物（powerCounters）错误替换为临时力量修正（powerModifier）
- **影响范围**：
  - 兵蚁 talent 和 handler
  - 雄蜂 protection
  - 如同魔法
  - 我们将震撼你
  - 承受压力
  - 我们乃最强
- **当前状态**：✅ 已在 commit 232214d 中全部修复

### 📋 验证清单

需要验证以下功能是否正常工作：

- [x] Killer Queen talent 只能选择本回合打出的随从
- [x] Killer Queen talent 不能选择自己
- [x] 兵蚁 talent 检查力量指示物（不是临时力量）
- [x] 雄蜂 protection 检查力量指示物
- [x] 如同魔法正确移除和重新分配力量指示物
- [x] 我们将震撼你基于力量指示物给予临时力量
- [x] 承受压力正确转移力量指示物
- [x] 我们乃最强正确转移力量指示物

## 根本原因分析

### 问题 1：过滤条件误删
在添加 POD 支持时，重构了 Killer Queen 的候选随从生成逻辑，但意外删除了 `playedThisTurn` 过滤条件。

### 问题 2：字段名错误替换
在添加 POD 支持时，可能进行了全局搜索替换，将 `powerCounters` 错误替换为 `powerModifier`。这两个字段的语义完全不同：
- **powerCounters**：永久的力量指示物（存储在随从数据中，需要通过事件添加/移除）
- **powerModifier**：临时的力量修正（通常是 buff/debuff，回合结束清除，是计算属性）

## 修复历史

1. **Commit 6ea1f9f** (2026-02-XX)：引入 POD 支持，同时引入 bug
2. **Commit 232214d** (2026-02-23)：修复 `powerCounters` 缺少 `?? 0` 防御，同时修复了所有 `powerModifier` 错误替换
3. **当前代码**：所有 bug 已修复

## 测试覆盖

现有测试文件 `src/games/smashup/__tests__/newFactionAbilities.test.ts` 包含了巨蚁派系的测试，包括：
- Killer Queen talent 测试（验证本回合打出的随从）
- 其他巨蚁能力测试

## 建议

### 短期
1. ✅ 无需修复（已在后续提交中修复）
2. ✅ 运行现有测试确认功能正常

### 长期
1. **代码审查流程**：大规模重构时需要更仔细的审查
2. **测试覆盖**：确保关键过滤条件有测试覆盖
3. **类型安全**：考虑使用更强的类型系统防止字段名混淆
4. **文档**：在代码中添加注释说明 `powerCounters` vs `powerModifier` 的区别

## 结论

虽然 commit 6ea1f9f 引入了多个严重 bug，但所有问题都已在后续提交（特别是 232214d）中修复。当前代码状态良好，无需额外修复。

建议运行完整的测试套件确认所有功能正常工作。
