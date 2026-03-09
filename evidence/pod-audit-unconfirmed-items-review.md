# POD 审计未确认项目审查报告

## 审查时间
2026-03-09

## 审查范围
POD commit 中所有标记为"需要确认"但未确认的项目

---

## 审查结果总结

| 项目 | 原始状态 | 当前状态 | 结论 |
|------|---------|---------|------|
| 1. 闪避逻辑 | 已删除 | ✅ 已恢复 | 无需处理 |
| 2. 潜行完整逻辑 | 已删除 | ✅ 已恢复 | 无需处理 |
| 3. 燃烧机制 | 错误修改 | ✅ 已修复 | 已完成 |
| 4. 潜行消耗逻辑 | 错误修改 | ✅ 已恢复 | 无需处理 |
| 5. expectedDamage 计算 | 简化 | ⚠️ 需确认 | **需要用户确认** |

---

## 详细审查

### ✅ 项目 1-2：闪避和潜行逻辑（已恢复）

**原始问题**：
- POD commit 删除了 `getCoreForPostDamageAfterEvasion` 函数
- 删除了 defensiveRoll 和 offensiveRoll 的闪避逻辑
- 简化了潜行逻辑，删除了 onHit 效果、Daze 额外攻击、响应窗口检查

**当前状态**：
- ✅ `getCoreForPostDamageAfterEvasion` 函数已恢复（`flowHooks.ts:131-151`）
- ✅ defensiveRoll 闪避逻辑已恢复（`flowHooks.ts:612-622`）
- ✅ offensiveRoll 闪避逻辑已恢复（通过 `getCoreForPostDamageAfterEvasion`）
- ✅ 潜行完整逻辑已恢复（`flowHooks.ts:433-502`）：
  - onHit 效果正确触发
  - Daze 额外攻击检查
  - 响应窗口检查
  - halt 检查

**结论**：✅ 已完全恢复，无需处理

---

### ✅ 项目 3：燃烧机制（已修复）

**原始问题**：
- POD commit 将燃烧从"固定 2 点伤害，持续效果"改为"每层 1 点伤害，自动移除 1 层"

**当前状态**：
- ✅ 已恢复为"固定 2 点伤害，持续效果"（`flowHooks.ts:887-905`）
- ✅ token 定义已更新（`tokens.ts:removable: false`）
- ✅ 所有测试已更新并通过（79 个测试）

**结论**：✅ 已完成修复，详见 `evidence/dicethrone-burn-token-persistence-fix.md`

---

### ✅ 项目 4：潜行消耗逻辑（已恢复）

**原始问题**：
- POD commit 将潜行从"回合末自动弃除"改为"触发时立即消耗"

**当前状态**：
- ✅ 已恢复为"回合末自动弃除"（`flowHooks.ts:435-436`）
- 代码注释明确说明：
  ```typescript
  // 规则：潜行触发时只免伤（跳过防御掷骰），不消耗标记
  // 标记的移除只在"经过一个完整的自己回合后，回合末清除"（见 discard 阶段退出逻辑）
  ```
- ✅ 第 440 行明确：`// 不消耗潜行标记——潜行在回合末自动弃除，触发免伤时不移除`

**结论**：✅ 已恢复原始正确行为，无需处理

---

### ⚠️ 项目 5：expectedDamage 计算简化（需确认）

**原始问题**：
- POD commit 简化了 expectedDamage 计算逻辑

**原始代码**：
```typescript
const expectedDamage = getPendingAttackExpectedDamage(coreAfterPreDefense, core.pendingAttack);
```

**当前代码**（`flowHooks.ts:525-528`）：
```typescript
const expectedDamage = sourceAbilityId 
    ? getPlayerAbilityBaseDamage(coreAfterPreDefense, attackerId, sourceAbilityId) + (core.pendingAttack.bonusDamage ?? 0)
    : 0;
```

**差异分析**：

1. **原始实现**（`getPendingAttackExpectedDamage`）：
   - 从 `pendingAttack` 对象获取完整的预期伤害
   - 可能包含更多的伤害修正（如 Token、buff、装备等）
   - 更全面的伤害计算

2. **当前实现**（简化版）：
   - 只计算基础伤害 + 奖励伤害
   - 不包含其他伤害修正
   - 更简单但可能不完整

**影响范围**：
- 这个 `expectedDamage` 用于 `getUsableTokensForOffensiveRollEnd`
- 影响 Token 响应窗口的判定（如太极、守护等）
- 如果伤害计算不准确，可能导致 Token 响应窗口不正确打开/关闭

**需要确认的问题**：

1. **`getPendingAttackExpectedDamage` 是否包含更多修正？**
   - 需要查看该函数的实现
   - 确认是否有其他伤害修正被遗漏

2. **简化后是否影响 Token 响应判定？**
   - 需要测试 Token 响应窗口是否正常工作
   - 特别是涉及伤害阈值的 Token（如太极、守护）

3. **是否有测试覆盖这个场景？**
   - 需要检查是否有测试验证 Token 响应窗口的伤害判定

**建议**：
1. 查看 `getPendingAttackExpectedDamage` 的实现
2. 对比两种计算方式的差异
3. 运行相关测试验证 Token 响应窗口是否正常
4. 如果有问题，恢复原始实现

---

## 需要用户确认的问题

### 问题：expectedDamage 计算简化是否正确？

**背景**：
- POD commit 将 `getPendingAttackExpectedDamage` 简化为 `getPlayerAbilityBaseDamage + bonusDamage`
- 简化后可能遗漏了其他伤害修正（Token、buff、装备等）
- 影响 Token 响应窗口的判定

**需要确认**：
1. `getPendingAttackExpectedDamage` 是否包含更多伤害修正？
2. 简化后是否影响 Token 响应窗口的正常工作？
3. 是否需要恢复原始实现？

**建议操作**：
1. 查看 `src/games/dicethrone/domain/utils.ts` 中 `getPendingAttackExpectedDamage` 的实现
2. 对比两种计算方式的差异
3. 运行 Token 响应相关测试（如 `token-response-window.test.ts`）
4. 如果测试失败或发现问题，恢复原始实现

---

## 总结

**已完成**：
- ✅ 闪避逻辑已恢复
- ✅ 潜行完整逻辑已恢复
- ✅ 燃烧机制已修复
- ✅ 潜行消耗逻辑已恢复

**需要确认**：
- ⚠️ expectedDamage 计算简化是否正确

**建议**：
1. 立即审查 `getPendingAttackExpectedDamage` 的实现
2. 运行 Token 响应相关测试
3. 如果有问题，恢复原始实现

