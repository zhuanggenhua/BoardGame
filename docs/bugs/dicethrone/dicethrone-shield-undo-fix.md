# DiceThrone 护盾日志撤回问题修复说明

## 问题现象

用户反馈：撤回后重新执行攻击，游戏日志中显示基础伤害（15点）而非最终伤害（1点）

## 根本原因

**撤回机制导致的状态污染**：

1. `pendingAttack.resolvedDamage` 是累计值，记录"本次攻击对防御方造成的净掉血"
2. 撤回操作通过快照恢复状态，但快照中已包含旧的 `resolvedDamage` 值（15）
3. 重新执行攻击时，`attackResolved.payload.totalDamage` 从 `pendingAttack.resolvedDamage` 读取，得到旧值 15
4. 旧代码中的条件分支：
   ```typescript
   const canUseResolvedTotalDamage = !!attackResolved
       && targetId === attackResolved.payload.defenderId
       && defenderDamageEventCount === 1
       && Number.isFinite(attackResolved.payload.totalDamage);
   
   const dealt = canUseResolvedTotalDamage
       ? Math.max(0, attackResolved!.payload.totalDamage)  // 使用旧值 15 ❌
       : Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);  // 正确计算 1 ✅
   ```
5. 撤回后 `canUseResolvedTotalDamage` 为 true，使用了错误的分支

## 修复方案

**完全移除对 `attackResolved.payload.totalDamage` 的依赖**：

```typescript
// 旧代码（有 bug）
const canUseResolvedTotalDamage = !!attackResolved && ...;
const dealt = canUseResolvedTotalDamage
    ? Math.max(0, attackResolved!.payload.totalDamage)  // 可能是旧值
    : Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);

// 新代码（已修复）
const dealt = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);
```

**为什么这样修复**：
- `dealtFromSameBatchShield` 和 `fixedShieldAbsorbed` 都是基于当前事件数据计算的
- 不依赖任何累计状态，不受撤回影响
- 始终反映当前批次的真实伤害

## 修改文件

- `src/games/dicethrone/game.ts`（第 489-491 行）
  - 移除 `canUseResolvedTotalDamage` 条件判断
  - 移除所有调试日志
  - 始终使用事件数据计算 `dealt`

## 测试验证

所有 31 个护盾相关测试通过：
- ✅ `shield-logging.test.ts`（3 个测试）
- ✅ `shield-logging-integration.test.ts`（2 个测试）
- ✅ `shield-multiple-consumption.test.ts`（8 个测试）
- ✅ `shield-cleanup.test.ts`（13 个测试）
- ✅ `shield-double-counting-regression.test.ts`（5 个测试）

## 用户操作

**请刷新页面加载新代码**：
1. 按 `Ctrl + F5`（Windows）或 `Cmd + Shift + R`（Mac）强制刷新
2. 或者关闭浏览器标签页后重新打开

**验证步骤**：
1. 刺客使用 CP 攻击月精灵（15点伤害）
2. 月精灵使用"下次一定"（6点护盾）和"打不到我"（50%减免）
3. 查看游戏日志，tooltip 顶部应显示 **1**（最终伤害）
4. 撤回后重新执行，tooltip 顶部仍应显示 **1**

## 技术细节

### 为什么旧代码会有这个 bug？

旧代码试图优化性能，避免重复计算：
- 如果 `attackResolved.payload.totalDamage` 已经是最终伤害，直接使用
- 否则才基于事件数据计算

但这个优化有两个问题：
1. **假设不成立**：`attackResolved.payload.totalDamage` 来自 `pendingAttack.resolvedDamage`，是累计值而非最终伤害
2. **撤回不兼容**：撤回后快照恢复，累计值包含旧数据，导致显示错误

### 为什么新代码不会有这个 bug？

新代码完全基于当前事件数据计算：
1. `rawDealt`：从 `DAMAGE_DEALT` 事件的 `actualDamage` 或 `amount` 字段读取
2. `shieldPercent`：从同批次的 `DAMAGE_SHIELD_GRANTED` 事件读取
3. `shieldsConsumed`：从 `DAMAGE_DEALT` 事件的 `shieldsConsumed` 字段读取（reducer 层回填）
4. 所有数据都是"当前批次"的，不依赖历史累计状态

## 相关文档

- [护盾减伤日志修复总结](./dicethrone-shield-logging-fix-summary.md)
- [护盾消耗 bug 修复](./dicethrone-shield-consumption-bug.md)
