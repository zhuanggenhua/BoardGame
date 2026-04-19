# P2 重大发现：Ultimate 护盾免疫功能丢失

## 问题描述

在 POD commit (6ea1f9f) 中，DiceThrone 的 **Ultimate 技能护盾免疫功能被意外删除**。

## 证据

### POD commit 之前的代码（6ea1f9f~1）

```typescript
// src/games/dicethrone/domain/reduceCombat.ts (handleDamageDealt)

// 终极技能（Ultimate）伤害不可被护盾抵消（规则FAQ：Not This Time 不能防御 Ultimate）
const isUltimateDamage = state.pendingAttack?.isUltimate ?? false;

// 消耗护盾抵消伤害（忽略 preventStatus 护盾）
// bypassShields: HP 重置类效果（如神圣祝福）跳过护盾消耗
// isUltimateDamage: 终极技能伤害跳过护盾
if (!bypassShields && !isUltimateDamage && target.damageShields && target.damageShields.length > 0 && remainingDamage > 0) {
    // ... 护盾计算逻辑
}
```

### POD commit 之后的代码（当前）

```typescript
// src/games/dicethrone/domain/reduceCombat.ts (handleDamageDealt)

// 消耗护盾抵消伤害（忽略 preventStatus 护盾）
// bypassShields: HP 重置类效果（如神圣祝福）跳过护盾消耗
// 优先级：百分比护盾 > 固定值护盾（百分比护盾先消耗）
if (!bypassShields && target.damageShields && target.damageShields.length > 0 && remainingDamage > 0) {
    // ... 护盾计算逻辑
}
```

**关键差异**：
- ❌ 删除了 `const isUltimateDamage = state.pendingAttack?.isUltimate ?? false;`
- ❌ 删除了 `&& !isUltimateDamage` 条件检查
- ❌ 删除了注释 "isUltimateDamage: 终极技能伤害跳过护盾"

## 影响评估

### 功能影响

1. **规则违反**：根据代码注释，"Not This Time 不能防御 Ultimate" 是官方规则 FAQ
2. **游戏平衡**：Ultimate 技能现在可以被护盾抵消，削弱了 Ultimate 技能的威力
3. **玩家体验**：玩家可能发现 Ultimate 技能的行为与规则不符

### 测试覆盖

POD commit 同时删除了 9 个相关测试用例：

```typescript
describe('终极技能（Ultimate）护盾免疫', () => {
    it('Ultimate 伤害不被护盾抵消', () => { ... });
    it('非 Ultimate 伤害仍被护盾正常抵消', () => { ... });
    it('无 pendingAttack 时护盾正常工作（非攻击伤害）', () => { ... });
    // ... 还有 6 个测试
});
```

**删除测试的后果**：
- 没有测试覆盖 Ultimate 护盾免疫功能
- 功能丢失后没有测试失败警告
- 回归风险极高

### 相关系统

`isUltimate` 标志仍然在代码库中使用：

1. **Token 响应系统** (`tokenResponse.ts`):
   ```typescript
   // 终极技能跳过防御方 Token 响应（规则 §4.4：不可被降低/忽略/回避）
   if (isUltimate) {
       console.log('[DT-TokenResponse] 终极技能，跳过防御方响应');
       return null;
   }
   ```

2. **流程控制** (`flowHooks.ts`):
   ```typescript
   if (sneakStacks > 0 && !core.pendingAttack.isUltimate) {
       // 潜行免伤（但 Ultimate 技能无视潜行）
   }
   ```

3. **响应窗口** (`rules.ts`):
   ```typescript
   if (state.pendingAttack?.isUltimate && windowType === 'afterRollConfirmed') {
       // 终极技能激活后，对手不能响应
       return [];
   }
   ```

**结论**：`isUltimate` 功能仍然存在且被多个系统使用，但**护盾系统的 Ultimate 免疫逻辑被意外删除**。

## 根本原因分析

### POD commit 的删除模式

POD commit 删除了大量包含 `pendingAttack` 的代码行，因为 POD 参数被移除。但在删除过程中：

1. **正确删除**：POD 参数相关的代码（如 `powerCounters`、`commandWindowTypeConstraints`）
2. **错误删除**：包含 `pendingAttack` 但与 POD 无关的代码（如 `isUltimateDamage` 检查）

**教训**：
- 大规模自动化删除容易误删无关代码
- 删除测试用例会掩盖功能丢失
- 需要更细粒度的代码审查

## 修复方案

### 方案 1：恢复 Ultimate 护盾免疫逻辑（推荐）

**步骤**：

1. **恢复代码逻辑**：
   ```typescript
   // src/games/dicethrone/domain/reduceCombat.ts (handleDamageDealt)
   
   // 终极技能（Ultimate）伤害不可被护盾抵消（规则FAQ：Not This Time 不能防御 Ultimate）
   const isUltimateDamage = state.pendingAttack?.isUltimate ?? false;
   
   // 消耗护盾抵消伤害（忽略 preventStatus 护盾）
   // bypassShields: HP 重置类效果（如神圣祝福）跳过护盾消耗
   // isUltimateDamage: 终极技能伤害跳过护盾
   // 优先级：百分比护盾 > 固定值护盾（百分比护盾先消耗）
   if (!bypassShields && !isUltimateDamage && target.damageShields && target.damageShields.length > 0 && remainingDamage > 0) {
       // ... 护盾计算逻辑
   }
   ```

2. **恢复测试用例**：
   ```bash
   git show 6ea1f9f:src/games/dicethrone/__tests__/shield-cleanup.test.ts > tmp/shield-cleanup-original.ts
   # 提取 Ultimate 护盾免疫测试部分
   # 适配当前代码结构
   # 添加到 shield-cleanup.test.ts
   ```

3. **运行测试验证**：
   ```bash
   npm run test -- shield-cleanup.test.ts
   ```

**优势**：
- 恢复官方规则行为
- 恢复测试覆盖
- 防止未来回归

**风险**：
- 如果规则已变更（不太可能），需要重新评估

### 方案 2：确认规则变更（不推荐）

如果官方规则确实变更（Ultimate 技能可以被护盾抵消），则：

1. **更新文档**：说明规则变更
2. **删除相关注释**：移除 "Not This Time 不能防御 Ultimate" 注释
3. **更新其他系统**：Token 响应、潜行等系统也需要调整

**可能性评估**：极低。代码注释明确提到 "规则FAQ"，且其他系统仍然保留 Ultimate 特殊处理。

## 优先级

⭐⭐⭐⭐⭐ **最高优先级**

**理由**：
1. **规则违反**：当前实现违反官方规则
2. **功能丢失**：核心战斗机制被意外删除
3. **测试缺失**：没有测试覆盖，回归风险极高
4. **影响范围**：影响所有使用 Ultimate 技能的英雄

## 下一步行动

### 立即执行（今天）

1. **[ ] 恢复 Ultimate 护盾免疫逻辑**
   - 修改 `src/games/dicethrone/domain/reduceCombat.ts`
   - 添加 `isUltimateDamage` 检查

2. **[ ] 恢复 Ultimate 护盾免疫测试**
   - 从 POD commit 提取测试用例
   - 适配当前代码结构
   - 添加到 `shield-cleanup.test.ts`

3. **[ ] 运行测试验证**
   - 确保所有测试通过
   - 确保 Ultimate 技能行为正确

### 后续执行（本周）

4. **[ ] 验证其他 Ultimate 相关功能**
   - Token 响应系统
   - 潜行免伤
   - 响应窗口

5. **[ ] 更新文档**
   - 记录 Ultimate 护盾免疫规则
   - 更新测试文档

## 相关文档

- `docs/ai-rules/testing-audit.md` - 测试审计规范
- `docs/ai-rules/engine-systems.md` - 引擎系统文档
- `evidence/p2-manual-verification-summary.md` - P2 验证总结
- `evidence/p2-restoration-plan.md` - P2 恢复计划

## 教训

1. **大规模删除需要细粒度审查**：不能仅凭关键词（如 `pendingAttack`）批量删除
2. **测试是功能的守护者**：删除测试会掩盖功能丢失
3. **代码注释是重要线索**：注释中的 "规则FAQ" 提示这是官方规则
4. **相关系统一致性检查**：如果一个系统保留 `isUltimate` 特殊处理，其他系统也应该保留
