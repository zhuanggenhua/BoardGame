# POD 审计所有未确认项目 - 完成报告

## 审查完成时间
2026-03-09

## 审查范围
POD commit 中所有标记为"需要确认"但未确认的项目

---

## 最终结果

✅ **所有未确认项目已完成审查和修复**

| 项目 | 状态 | 操作 |
|------|------|------|
| 1. 闪避逻辑 | ✅ 已恢复 | 无需处理 |
| 2. 潜行完整逻辑 | ✅ 已恢复 | 无需处理 |
| 3. 燃烧机制 | ✅ 已修复 | 已完成 |
| 4. 潜行消耗逻辑 | ✅ 已恢复 | 无需处理 |
| 5. expectedDamage 计算 | ✅ 已修复 | 已完成 |

---

## 详细报告

### ✅ 项目 1-2：闪避和潜行逻辑（已恢复）

**状态**：已在之前的 POD 审计中恢复

**验证**：
- ✅ `getCoreForPostDamageAfterEvasion` 函数存在
- ✅ defensiveRoll 闪避逻辑完整
- ✅ offensiveRoll 闪避逻辑完整
- ✅ 潜行完整逻辑（onHit、Daze、响应窗口）完整

**结论**：无需处理

---

### ✅ 项目 3：燃烧机制（已修复）

**问题**：POD commit 将燃烧从"固定 2 点伤害，持续效果"改为"每层 1 点伤害，自动移除 1 层"

**修复**：
- ✅ 恢复为"固定 2 点伤害，持续效果"
- ✅ 更新 token 定义（`removable: false`）
- ✅ 更新所有测试（79 个测试通过）

**证据文档**：`evidence/dicethrone-burn-token-persistence-fix.md`

**结论**：已完成修复

---

### ✅ 项目 4：潜行消耗逻辑（已恢复）

**问题**：POD commit 将潜行从"回合末自动弃除"改为"触发时立即消耗"

**验证**：
- ✅ 代码注释明确说明："潜行触发时只免伤（跳过防御掷骰），不消耗标记"
- ✅ 代码注释明确说明："标记的移除只在'经过一个完整的自己回合后，回合末清除'"
- ✅ 第 440 行明确："不消耗潜行标记——潜行在回合末自动弃除，触发免伤时不移除"

**结论**：已恢复原始正确行为，无需处理

---

### ✅ 项目 5：expectedDamage 计算（已修复）

**问题**：POD commit 简化了 expectedDamage 计算，遗漏了 reducer 设置的伤害修正

**证据**：
- ✅ `reducer.ts:95` 中设置了 `pendingAttack.damage`（伏击 Token 掷骰加伤）
- ✅ 原始实现优先使用 `pendingAttack.damage`
- ✅ 简化实现直接使用 `getPlayerAbilityBaseDamage`，遗漏修正

**修复**：
```typescript
// 修复前（简化实现，错误）
const expectedDamage = sourceAbilityId 
    ? getPlayerAbilityBaseDamage(coreAfterPreDefense, attackerId, sourceAbilityId) + (core.pendingAttack.bonusDamage ?? 0)
    : 0;

// 修复后（恢复原始实现，正确）
const expectedDamage = getPendingAttackExpectedDamage(coreAfterPreDefense, core.pendingAttack);
```

**测试结果**：
```bash
✓ token-response-window.test.ts (8 tests) 7ms
```

**证据文档**：`evidence/pod-audit-expectedDamage-must-fix.md`

**结论**：已完成修复

---

## POD 审计教训总结

### 教训 1：不要假设当前代码是正确的

**问题**：
- 燃烧机制被标记为"需要确认是否为有意的规则修改"
- 审计时没有验证原始行为，假设"当前代码可能是正确的"
- 结果：bug 被忽略，直到用户反馈才发现

**正确做法**：
- 发现变更 → 查看原始代码 → 对比行为 → 确认哪个是正确的 → 修复或保留

### 教训 2：测试描述与代码不一致时必须调查

**问题**：
- 测试描述说"固定 2 点伤害，持续不移除"
- 当前代码是"每层 1 点伤害，移除 1 层"
- 审计时没有深入调查这个不一致

**正确做法**：
- 测试描述是功能的规格说明
- 与代码不一致说明有问题
- 必须深入调查，不能搁置

### 教训 3："需要确认"不能无限期搁置

**问题**：
- 标记为"需要确认"的问题没有在审计完成前确认
- 留到后续处理，结果被遗忘

**正确做法**：
- "需要确认"的问题必须在审计完成前确认
- 不能留到后续
- 必须有明确的结论（修复/保留/文档记录）

### 教训 4：测试通过不代表没有问题

**问题**：
- `token-response-window.test.ts` 测试通过
- 但 expectedDamage 计算简化仍然有问题
- 测试没有覆盖 `pendingAttack.damage` 被 reducer 设置的场景

**正确做法**：
- 代码审查比测试更重要
- 测试通过只能证明测试覆盖的场景没问题
- 必须通过代码审查确认所有场景都正确

### 教训 5：简化代码前必须确认没有遗漏

**问题**：
- POD commit 简化了 expectedDamage 计算
- 没有确认是否遗漏了 `pendingAttack.damage` 的修正
- 结果：遗漏了伏击 Token 掷骰加伤

**正确做法**：
- 简化代码前必须确认没有遗漏
- 查看原始实现的所有分支
- 确认简化后的实现覆盖所有场景

---

## 建议的审计流程改进

### 改进 1：发现变更时的标准流程

1. **记录变更**：记录原始代码和当前代码
2. **查看原始行为**：查看 POD commit 之前的代码
3. **对比行为**：对比原始行为和当前行为
4. **确认正确性**：确认哪个是正确的（查看规则文档、测试描述、Wiki）
5. **做出决策**：修复或保留，不能搁置为"需要确认"
6. **记录理由**：记录为什么修复或保留

### 改进 2：测试描述与代码不一致时的处理流程

1. **立即标记**：标记为高优先级问题
2. **查看原始代码**：查看 POD commit 之前的代码
3. **查看规则文档**：查看游戏规则文档或 Wiki
4. **确认正确行为**：确认测试描述还是当前代码是正确的
5. **修复**：修复代码或更新测试描述
6. **不能搁置**：不能标记为"需要确认"后搁置

### 改进 3："需要确认"的处理流程

1. **立即确认**：标记为"需要确认"后，必须在当天确认
2. **查找证据**：查看原始代码、规则文档、Wiki、测试描述
3. **做出决策**：修复或保留，不能无限期搁置
4. **记录理由**：记录为什么修复或保留
5. **更新文档**：更新审计文档，移除"需要确认"标记

---

## 相关文档

- `evidence/pod-commit-flowHooks-changes.md` - POD commit 变更分析
- `evidence/p2-restoration-plan.md` - P2 恢复计划
- `evidence/p2-token-tests-status.md` - Token 测试状态
- `evidence/dicethrone-burn-token-persistence-fix.md` - 燃烧机制修复
- `evidence/pod-audit-expectedDamage-must-fix.md` - expectedDamage 修复
- `evidence/pod-audit-unconfirmed-items-review.md` - 未确认项目审查
- `evidence/pod-audit-final-confirmation-needed.md` - 最终确认清单

---

## 总结

✅ **所有 POD 审计未确认项目已完成审查和修复**

**修复内容**：
1. ✅ 燃烧机制：恢复为"固定 2 点伤害，持续效果"
2. ✅ expectedDamage 计算：恢复原始实现，包含 reducer 修正

**无需处理**：
1. ✅ 闪避逻辑：已在之前恢复
2. ✅ 潜行完整逻辑：已在之前恢复
3. ✅ 潜行消耗逻辑：已在之前恢复

**测试结果**：
- ✅ 所有相关测试通过
- ✅ 燃烧机制测试：79 个测试通过
- ✅ Token 响应测试：8 个测试通过

**审计状态**：✅ 完成

