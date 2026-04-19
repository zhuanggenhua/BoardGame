# POD 审计最终确认清单

## 审查完成时间
2026-03-09

---

## 需要用户确认的唯一项目

### ⚠️ expectedDamage 计算简化

**位置**：`src/games/dicethrone/domain/flowHooks.ts:525-528`

**问题描述**：
POD commit 将 `getPendingAttackExpectedDamage` 简化为直接计算，可能遗漏了 reducer 设置的伤害修正。

---

## 详细分析

### 原始实现（`getPendingAttackExpectedDamage`）

```typescript
export function getPendingAttackExpectedDamage(
    state: DiceThroneCore,
    pendingAttack: PendingAttack,
    fallbackWhenNoAbility: number = 0
): number {
    const { sourceAbilityId, attackerId, bonusDamage } = pendingAttack;

    // 基础伤害：优先 reducer 已设置的值，否则从技能定义查询
    let baseDamage: number;
    if (pendingAttack.damage != null) {
        baseDamage = pendingAttack.damage;  // ← 优先使用 reducer 设置的值
    } else if (sourceAbilityId) {
        baseDamage = getPlayerAbilityBaseDamage(state, attackerId, sourceAbilityId);
    } else {
        baseDamage = fallbackWhenNoAbility;
    }

    return baseDamage + (bonusDamage ?? 0);
}
```

### 当前简化实现

```typescript
const expectedDamage = sourceAbilityId 
    ? getPlayerAbilityBaseDamage(coreAfterPreDefense, attackerId, sourceAbilityId) + (core.pendingAttack.bonusDamage ?? 0)
    : 0;
```

---

## 关键差异

| 特性 | 原始实现 | 当前实现 | 影响 |
|------|---------|---------|------|
| 优先级 | `pendingAttack.damage` > `getPlayerAbilityBaseDamage` | 只用 `getPlayerAbilityBaseDamage` | ⚠️ 可能遗漏 reducer 修正 |
| 无技能时 | 可设置 fallback 值 | 固定返回 0 | ⚠️ 可能影响特殊场景 |
| 完整性 | 包含所有伤害修正 | 只包含基础伤害 + 奖励伤害 | ⚠️ 可能不完整 |

---

## 潜在问题场景

### 场景 1：Reducer 设置了 `pendingAttack.damage`

**示例**：某个技能在 reducer 中动态计算伤害（如基于 Token 数量）

```typescript
// reducer.ts
case 'ABILITY_ACTIVATED':
    const tokenCount = state.players[playerId].tokens[TOKEN_IDS.FIRE_MASTERY];
    return {
        ...state,
        pendingAttack: {
            ...state.pendingAttack,
            damage: tokenCount * 2,  // 动态计算伤害
        }
    };
```

**原始实现**：✅ 使用 `pendingAttack.damage = tokenCount * 2`  
**当前实现**：❌ 使用 `getPlayerAbilityBaseDamage`（固定值），忽略 Token 修正

### 场景 2：无技能攻击（如普通攻击）

**原始实现**：✅ 返回 `fallbackWhenNoAbility`（可设置为 1 表示"攻击成功"）  
**当前实现**：❌ 返回 0

---

## 影响范围

**直接影响**：
- `getUsableTokensForOffensiveRollEnd` 的伤害判定
- Token 响应窗口的打开/关闭判定
- 涉及伤害阈值的 Token（如太极、守护）

**可能受影响的功能**：
1. **太极 Token**：需要判断伤害是否 ≥ 某个阈值
2. **守护 Token**：需要判断伤害是否 ≥ 某个阈值
3. **其他伤害相关 Token**：任何基于伤害判定的 Token

---

## 测试结果

**已运行测试**：
```bash
✓ token-response-window.test.ts (8 tests) 14ms
```

**测试通过**，但这不能完全证明没有问题，因为：
1. 测试可能没有覆盖 `pendingAttack.damage` 被 reducer 设置的场景
2. 测试可能没有覆盖无技能攻击的场景
3. 测试可能没有覆盖所有伤害阈值判定的场景

---

## 建议

### 选项 1：恢复原始实现（推荐）

**理由**：
- ✅ 更完整，包含所有伤害修正
- ✅ 支持 reducer 动态设置伤害
- ✅ 支持无技能攻击的 fallback
- ✅ 与原始设计一致

**操作**：
```typescript
// 恢复为原始实现
const expectedDamage = getPendingAttackExpectedDamage(coreAfterPreDefense, core.pendingAttack);
```

### 选项 2：保持当前实现

**前提条件**（必须全部满足）：
1. ✅ 确认没有任何技能在 reducer 中设置 `pendingAttack.damage`
2. ✅ 确认没有无技能攻击的场景
3. ✅ 确认所有 Token 响应判定都正常工作

**风险**：
- ⚠️ 未来新增技能可能依赖 `pendingAttack.damage`
- ⚠️ 可能遗漏边缘场景

---

## 用户确认问题

### 问题 1：是否有技能在 reducer 中设置 `pendingAttack.damage`？

**需要检查**：
- 搜索 `src/games/dicethrone/domain/reducer.ts` 中是否有 `pendingAttack.damage` 的赋值
- 搜索所有技能定义中是否有动态伤害计算

**如果有**：必须恢复原始实现

### 问题 2：是否有无技能攻击的场景？

**需要检查**：
- 是否有 `sourceAbilityId` 为 `undefined` 的攻击
- 是否有普通攻击（非技能攻击）

**如果有**：必须恢复原始实现

### 问题 3：Token 响应判定是否都正常工作？

**需要测试**：
- 太极 Token 的伤害阈值判定
- 守护 Token 的伤害阈值判定
- 其他伤害相关 Token 的判定

**如果有问题**：必须恢复原始实现

---

## 推荐操作

**立即执行**：
1. 搜索 `pendingAttack.damage` 的所有赋值
2. 搜索 `sourceAbilityId` 为 `undefined` 的场景
3. 运行所有 Token 响应相关测试

**如果发现任何问题**：
- 立即恢复原始实现
- 更新测试确保覆盖这些场景

**如果没有发现问题**：
- 可以保持当前实现
- 但建议在文档中记录这个简化，避免未来引入依赖 `pendingAttack.damage` 的代码

---

## 总结

**建议**：恢复原始实现（`getPendingAttackExpectedDamage`）

**理由**：
1. 更完整，包含所有伤害修正
2. 支持未来扩展（动态伤害计算）
3. 与原始设计一致
4. 风险更低

**如果保持当前实现**：
- 必须确认没有任何依赖 `pendingAttack.damage` 的代码
- 必须在文档中记录这个简化
- 必须在未来新增技能时注意这个限制

