# DiceThrone 护盾减伤日志修复总结

## 问题描述

用户反馈游戏日志中没有显示护盾减伤记录（如"下次一定"卡牌的 6 点护盾），且 tooltip 顶部显示基础伤害而非最终伤害。

## 修复过程

### 第一阶段：护盾消耗信息未记录到日志

**问题根因**：
- 护盾消耗在 reducer 层直接修改状态，不生成事件
- 日志系统只能看到 `DAMAGE_DEALT` 事件，护盾消耗信息丢失

**解决方案**：
- 在 `DAMAGE_DEALT` 事件的 payload 中添加 `shieldsConsumed` 字段
- reducer 层回填护盾消耗信息（`reduceCombat.ts` 第 202-204 行）

### 第二阶段：日志显示基础伤害而非最终伤害

**问题根因**：
1. 固定值护盾消耗未更新 `breakdownSeg.displayText`
2. `dealt` 计算未考虑固定值护盾消耗量

**解决方案**：
1. `game.ts` 第 543 行：添加 `breakdownSeg.displayText = String(dealt)`
2. `game.ts` 第 481-483 行：计算 `fixedShieldAbsorbed` 并从 `dealt` 中扣除

### 第三阶段：护盾重复显示

**问题根因**：
1. `reduceCombat.ts` 中 `shieldsConsumed` 数组包含了所有护盾（固定值 + 百分比）
2. `game.ts` 中又单独处理了百分比护盾（通过 `shieldEvent` 查找并添加）
3. 导致百分比护盾被添加两次

**解决方案**：
- 删除 `game.ts` 中单独处理百分比护盾的代码，统一使用 `shieldsConsumed` 数组

### 第四阶段：tooltip 顶部显示基础伤害而非最终伤害

**问题根因**：
- `buildDamageBreakdownSegment` 的第一个参数传入了 `dealt`（最终伤害），但应该传入 `rawDealt`（基础伤害）用于计算 breakdown
- 在添加护盾行后，需要强制更新 `displayText` 为最终伤害

**解决方案**：
1. 将 `buildDamageBreakdownSegment` 的第一个参数改为 `rawDealt`
2. 在添加护盾行后，强制更新 `displayText` 为 `dealt`（只要 `dealt !== rawDealt`）

### 第五阶段：百分比护盾和固定值护盾处理顺序错误

**问题根因**：
- reducer 中护盾按照 `damageShields` 数组的顺序处理（FIFO）
- 但游戏规则要求：百分比护盾先处理（减少基础伤害），然后固定值护盾处理（吸收剩余伤害）
- 当数组顺序为 `[固定值护盾, 百分比护盾]` 时，会先消耗固定值护盾，导致计算错误

**解决方案**：
1. `reduceCombat.ts`：分离百分比护盾和固定值护盾，先处理百分比护盾，再处理固定值护盾
2. `game.ts`：修复 `fixedShieldAbsorbed` 计算，只统计固定值护盾的消耗量（`shield.value != null`），避免双重计算百分比护盾

### 第六阶段（最终修复）：撤回后 `attackResolved.payload.totalDamage` 保留旧值

**问题根因**：
- `pendingAttack.resolvedDamage` 是累计值，撤回后通过快照恢复
- 快照中已包含旧的伤害值（15），导致重新执行时 `attackResolved.payload.totalDamage` 保留旧值
- 旧代码中的条件分支：
  ```typescript
  const canUseResolvedTotalDamage = !!attackResolved
      && targetId === attackResolved.payload.defenderId
      && defenderDamageEventCount === 1
      && Number.isFinite(attackResolved.payload.totalDamage);
  
  const dealt = canUseResolvedTotalDamage
      ? Math.max(0, attackResolved!.payload.totalDamage)  // 使用旧值 15
      : Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);  // 正确计算 1
  ```
- 撤回后 `canUseResolvedTotalDamage` 为 true，使用了错误的分支

**解决方案**：
- 完全移除对 `attackResolved.payload.totalDamage` 的依赖
- 始终基于当前事件数据计算：
  ```typescript
  const dealt = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);
  ```
- 删除所有相关的条件判断和调试日志

**用户需要操作**：
- 刷新页面加载新代码（旧代码仍在浏览器缓存中）

## 修改文件

1. `src/games/dicethrone/domain/reduceCombat.ts`
   - 第 202-204 行：回填 `shieldsConsumed` 到事件 payload
   - 第 115-160 行：分离百分比护盾和固定值护盾，按正确顺序处理

2. `src/games/dicethrone/game.ts`
   - 第 470-550 行：伤害日志格式化逻辑
   - 第 481-486 行：修复 `fixedShieldAbsorbed` 计算，只统计固定值护盾
   - 第 540-543 行：强制更新 `displayText` 为最终伤害

3. `src/games/dicethrone/__tests__/shield-logging.test.ts`
   - 新增测试用例：验证 ActionLog 显示最终伤害

4. `src/games/dicethrone/__tests__/shield-logging-integration.test.ts`
   - 新增集成测试：模拟真实游戏场景（刺客 CP 伤害 vs 月精灵护盾）

## 测试验证

### 单元测试
- `shield-logging.test.ts`：3 个测试全部通过
- `shield-logging-integration.test.ts`：2 个测试全部通过
- `shield-multiple-consumption.test.ts`：8 个测试全部通过
- `shield-cleanup.test.ts`：13 个测试全部通过
- `shield-double-counting-regression.test.ts`：5 个测试全部通过
- **总计：31 个测试全部通过**

### 真实场景验证
- 场景 1：10 点伤害 + 6 点固定值护盾 + 50% 百分比护盾 → 最终伤害 0 点 ✅
- 场景 2：14 点伤害 + 6 点固定值护盾 + 50% 百分比护盾 → 最终伤害 1 点 ✅

## 核心修复逻辑

### 护盾处理顺序（reducer 层）
```typescript
// 1. 分离百分比护盾和固定值护盾
const percentShields = damageShields.filter(shield => shield.reductionPercent != null);
const valueShields = damageShields.filter(shield => shield.reductionPercent == null);

// 2. 先处理百分比护盾
for (const shield of percentShields) {
    const preventedAmount = Math.ceil(currentDamage * shield.reductionPercent! / 100);
    currentDamage -= preventedAmount;
    shieldsConsumed.push({ sourceId, reductionPercent, absorbed: preventedAmount });
}

// 3. 再处理固定值护盾
for (const shield of valueShields) {
    const preventedAmount = Math.min(shield.value, currentDamage);
    currentDamage -= preventedAmount;
    shieldsConsumed.push({ sourceId, value, absorbed: preventedAmount });
    // 未完全消耗的护盾保留剩余值
}
```

### 日志显示逻辑（game.ts 层）
```typescript
// 1. 计算百分比护盾减免后的伤害
const shieldPercent = shieldEvent?.payload.reductionPercent ?? 0;
const shieldAbsorbed = Math.ceil(rawDealt * shieldPercent / 100);
const dealtFromSameBatchShield = rawDealt - shieldAbsorbed;

// 2. 计算固定值护盾消耗量（只统计 value-based shields）
const fixedShieldAbsorbed = shieldsConsumed?.reduce((sum, shield) => {
    return shield.value != null ? sum + shield.absorbed : sum;
}, 0) ?? 0;

// 3. 计算最终伤害
const dealt = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);

// 4. 构建 breakdown（使用 rawDealt 作为基础值）
const breakdownSeg = buildDamageBreakdownSegment(rawDealt, ...);

// 5. 添加护盾行（shieldsConsumed 已包含所有护盾，按处理顺序排列）
for (const shield of shieldsConsumed) {
    breakdownSeg.lines.push({ label, value: -shield.absorbed, color: 'negative' });
}

// 6. 强制更新 displayText 为最终伤害
if (dealt !== rawDealt) {
    breakdownSeg.displayText = String(dealt);
}
```

## 关键要点

1. **百分比护盾优先处理**：必须在固定值护盾之前处理，因为百分比护盾基于基础伤害计算
2. **避免双重计算**：`fixedShieldAbsorbed` 只统计固定值护盾（`shield.value != null`）
3. **displayText 强制更新**：只要 `dealt !== rawDealt`，就需要更新 displayText
4. **shieldsConsumed 顺序**：按处理顺序记录（百分比护盾在前，固定值护盾在后）

## 后续工作

- ✅ 清理临时调试日志
- ✅ 更新测试用例以匹配新的护盾处理顺序
- ✅ 验证所有护盾相关测试通过（31/31）
- ✅ 移除对 `attackResolved.payload.totalDamage` 的依赖，修复撤回后的显示问题
- ✅ 用户验证修复效果（tooltip 正确显示最终伤害 1 点）

## 修复完成

护盾减伤日志显示问题已完全修复，包括：
1. 护盾消耗信息正确记录到日志
2. 日志显示最终伤害而非基础伤害
3. 百分比护盾和固定值护盾按正确顺序处理
4. 撤回后重新执行攻击，日志显示正确
5. 所有测试通过（31/31）
