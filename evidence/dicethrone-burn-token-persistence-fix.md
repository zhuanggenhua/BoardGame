# DiceThrone 燃烧 Token 持续性修复

## 问题描述

用户反馈：DiceThrone 的燃烧（Burn）token 应该是一直持续的，但当前实现每回合会自动移除 1 层。

## 根本原因

在 POD commit 中，燃烧机制被错误修改：

**原始正确行为**（已恢复）：
- 每回合固定造成 2 点伤害
- 持续效果，不自动移除
- 需要通过净化等手段移除

**错误行为**（已修复）：
- 每层造成 1 点伤害
- 每回合自动移除 1 层

## 修复内容

### 1. 恢复 flowHooks.ts 中的燃烧逻辑

**文件**：`src/games/dicethrone/domain/flowHooks.ts`

```typescript
// 1. 燃烧 (burn) — 持续效果，不可叠加，每回合固定造成 2 点不可防御伤害，不自动移除
const burnStacks = player.statusEffects[STATUS_IDS.BURN] ?? 0;
if (burnStacks > 0) {
    const damageCalc = createDamageCalculation({
        source: { playerId: 'system', abilityId: 'upkeep-burn' },
        target: { playerId: activeId },
        baseDamage: 2, // 固定 2 点伤害
        state: core,
        timestamp,
    });
    const damageEvents = damageCalc.toEvents();
    events.push(...damageEvents);
    // 持续效果：燃烧不自动移除，需要通过净化等手段移除
}
```

### 2. 更新 token 定义

**文件**：`src/games/dicethrone/heroes/pyromancer/tokens.ts`

```typescript
{
    id: STATUS_IDS.BURN,
    name: statusText(STATUS_IDS.BURN, 'name'),
    colorTheme: 'from-orange-600 to-red-500',
    description: statusText(STATUS_IDS.BURN, 'description') as unknown as string[],
    sfxKey: 'magic.general.simple_magic_sound_fx_pack_vol.fire.flame_chain_a',
    stackLimit: 3,
    category: 'debuff',
    passiveTrigger: {
        timing: 'onTurnStart',
        removable: false, // 持续效果，不自动移除
        actions: [{ type: 'damage', target: 'self', value: 2 }],
    },
    frameId: 'pyro-status-4',
    atlasId: DICETHRONE_STATUS_ATLAS_IDS.PYROMANCER,
}
```

### 3. 更新测试用例

更新了以下测试文件，确保测试验证正确的行为：

1. **token-execution.test.ts**
   - `1 层燃烧：upkeep 造成固定 2 点伤害，状态持续不移除`
   - `3 层燃烧：upkeep 造成固定 2 点伤害，状态持续不移除`
   - `1 层燃烧 + 1 层中毒：总共造成 3 点伤害（燃烧 2 + 中毒 1）`

2. **shared-state-consistency.test.ts**
   - `1层燃烧：造成固定2点伤害，状态持续不移除`
   - `3层燃烧：造成固定2点伤害，状态持续不移除`
   - 燃烧+中毒组合测试

3. **token-fix-coverage.test.ts**
   - 火焰精通冷却与燃烧组合测试

## 测试结果

所有相关测试全部通过：

```bash
✓ token-execution.test.ts (48 tests) 88ms
✓ shared-state-consistency.test.ts (12 tests) 115ms
✓ token-fix-coverage.test.ts (19 tests) 39ms
```

## 验证

燃烧状态现在的行为：
- ✅ 每回合固定造成 2 点伤害（不管有多少层）
- ✅ 持续效果，不自动移除
- ✅ 需要通过净化等手段移除
- ✅ 与中毒组合时，总伤害 = 燃烧 2 + 中毒层数

## 相关文档

- `evidence/pod-commit-flowHooks-changes.md` - 记录了 POD commit 中的错误修改
- `evidence/p2-token-tests-status.md` - Token 测试状态分析
- `evidence/p2-restoration-plan.md` - P2 恢复计划

## 总结

成功恢复了燃烧状态的原始正确行为。燃烧现在是持续效果，每回合固定造成 2 点伤害，不会自动移除，需要通过净化等手段移除。所有相关测试已更新并通过。


## POD 审计遗漏分析

### 审计时的记录

在 `evidence/pod-commit-flowHooks-changes.md` 中，燃烧机制被标记为**中优先级（需要确认）**：

> **4. 燃烧机制变更**
> - 需要确认是否为有意的规则修改
> - 如果是 bug，需要恢复

在 `evidence/p2-token-tests-status.md` 中记录了当前行为：

> **1. 燃烧（BURN）**：
> - 行为：每层造成 1 点伤害，然后移除 1 层
> - **注意**：描述可能有误。根据当前代码，燃烧每层造成 1 点伤害，然后移除 1 层
> - 需要验证：POD commit 之前的行为是否不同

### 为什么被忽略

1. **没有验证原始行为**：审计时发现了变更，但没有查看 POD commit 之前的代码确认原始行为
2. **错误假设**：假设"当前代码可能是正确的"，而不是"原始代码可能是正确的"
3. **优先级判断错误**：将燃烧机制归类为"低优先级"，认为"功能正常工作"
4. **测试描述不一致**：测试描述说"固定 2 点伤害，持续不移除"，但当前代码是"每层 1 点伤害，移除 1 层"，审计时没有深入调查这个不一致

### 教训

- ❌ **不要假设当前代码是正确的**：发现变更时，应该先验证原始行为，而不是假设新代码是正确的
- ❌ **测试描述与代码不一致时必须调查**：测试描述是功能的规格说明，与代码不一致说明有问题
- ❌ **"需要确认"不能无限期搁置**：标记为"需要确认"的问题必须在审计完成前确认，不能留到后续
- ✅ **正确做法**：发现变更 → 查看原始代码 → 对比行为 → 确认哪个是正确的 → 修复或保留

---

## 相关文档更新建议

建议更新以下文档，记录这次教训：

1. **`evidence/pod-reaudit-conclusion.md`**：
   - 在"审计发现"部分补充"燃烧机制被错误修改但未被发现"
   - 在"教训"部分补充审计方法论的改进建议

2. **`docs/ai-rules/testing-audit.md`**：
   - 补充"测试描述与代码不一致时的处理流程"
   - 补充"代码变更审计的标准流程"

3. **`AGENTS.md`**：
   - 在"POD 审计教训"部分补充这次发现
