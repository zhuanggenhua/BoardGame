# 撤回与累计状态污染：通用架构问题分析

## 问题概述

DiceThrone 护盾日志撤回 bug 暴露了一个**通用的架构缺陷**：当日志格式化逻辑依赖累计状态（cumulative state）时，撤回操作会导致状态污染。

## 问题根源

### 累计状态模式

**什么是累计状态**：
- 在多个事件处理过程中，逐步累加的状态值
- 例如：`pendingAttack.resolvedDamage = (resolvedDamage ?? 0) + netHpLoss`

**为什么需要累计状态**：
- DiceThrone 的攻击可能产生多次 `DAMAGE_DEALT` 事件（基础伤害 + 弹反伤害 + Token 响应伤害）
- 需要累计"本次攻击对防御方造成的净掉血"，用于触发 onHit 效果

**累计状态的生命周期**：
```
攻击开始 → pendingAttack.resolvedDamage = 0
  ↓
DAMAGE_DEALT (基础伤害 10) → resolvedDamage += 10 → resolvedDamage = 10
  ↓
DAMAGE_DEALT (弹反伤害 5) → resolvedDamage += 5 → resolvedDamage = 15
  ↓
ATTACK_RESOLVED → totalDamage = resolvedDamage (15)
  ↓
攻击结束 → pendingAttack = null
```

### 撤回机制

**撤回如何工作**：
1. 用户点击撤回按钮
2. 引擎从快照栈中恢复之前的状态
3. 快照中包含 `pendingAttack.resolvedDamage` 的旧值

**问题场景**：
```
初始状态：resolvedDamage = 0
  ↓
执行攻击 → DAMAGE_DEALT (15点) → resolvedDamage = 15
  ↓
用户撤回 → 恢复快照 → resolvedDamage = 15 (旧值！)
  ↓
重新执行攻击 → DAMAGE_DEALT (1点，护盾减免后) → resolvedDamage = 15 + 1 = 16 ❌
```

**为什么会保留旧值**：
- 撤回恢复的是"攻击开始前"的快照
- 但此时 `pendingAttack` 已经创建，`resolvedDamage` 已经有值（15）
- 重新执行时，累加逻辑导致 `resolvedDamage = 15 + 1 = 16`

## DiceThrone 的具体表现

### Bug 链路

1. **Reducer 层**（`reduceCombat.ts`）：
   ```typescript
   pendingAttack = {
       ...pendingAttack,
       resolvedDamage: (pendingAttack.resolvedDamage ?? 0) + netHpLoss,  // 累加
   };
   ```

2. **事件生成层**（`flowHooks.ts`）：
   ```typescript
   const totalDamage = core.pendingAttack.resolvedDamage ?? 0;  // 读取累计值
   events.push({
       type: 'ATTACK_RESOLVED',
       payload: { totalDamage, ... }
   });
   ```

3. **日志格式化层**（`game.ts`，旧代码）：
   ```typescript
   const canUseResolvedTotalDamage = !!attackResolved && ...;
   const dealt = canUseResolvedTotalDamage
       ? Math.max(0, attackResolved!.payload.totalDamage)  // 使用累计值（可能是旧值）
       : Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);
   ```

### 修复方案

**完全移除对累计状态的依赖**：
```typescript
// 旧代码（有 bug）
const dealt = canUseResolvedTotalDamage
    ? Math.max(0, attackResolved!.payload.totalDamage)  // 依赖累计状态
    : Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);

// 新代码（已修复）
const dealt = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);  // 只依赖当前事件
```

**为什么这样修复有效**：
- `dealtFromSameBatchShield` 和 `fixedShieldAbsorbed` 都是基于当前批次的事件数据计算
- 不依赖任何累计状态，不受撤回影响
- 始终反映当前批次的真实伤害

## 通用性分析

### 这是框架层问题吗？

**是，也不是**：

1. **框架层没有问题**：
   - 引擎的撤回机制本身是正确的（恢复快照）
   - 累计状态模式本身也是合理的（用于跨事件追踪）

2. **问题在于使用方式**：
   - **日志格式化层不应该依赖累计状态**
   - 日志应该只依赖"当前批次的事件数据"，不依赖"跨批次的累计状态"

### 其他游戏是否受影响？

**检查结果**：
- SmashUp：没有使用累计状态模式 ✅
- SummonerWars：没有使用累计状态模式 ✅
- TicTacToe：没有使用累计状态模式 ✅

**为什么只有 DiceThrone 有这个问题**：
- DiceThrone 的攻击机制复杂（基础伤害 + 弹反 + Token 响应）
- 需要累计"本次攻击的总伤害"用于触发 onHit 效果
- 其他游戏的攻击机制更简单，不需要累计状态

### 修复是否通用？

**修复原则是通用的**：
- ✅ **日志格式化层只依赖当前事件数据**
- ✅ **不依赖累计状态或跨批次状态**
- ✅ **所有计算都基于"当前批次"的事件**

**但实现是游戏特化的**：
- DiceThrone 的修复代码在 `src/games/dicethrone/game.ts`
- 其他游戏如果有类似模式，需要类似的修复
- 但目前其他游戏没有这个问题

## 架构建议

### 累计状态的正确使用

**✅ 正确用法**：
- 用于引擎层逻辑判断（如 onHit 效果触发条件）
- 用于 reducer 层状态更新
- 用于 flowHooks 层流程控制

**❌ 错误用法**：
- 用于日志格式化（应该只依赖当前事件）
- 用于 UI 展示（应该只依赖当前状态）
- 用于跨批次的数据聚合（应该用事件流）

### 撤回兼容性检查清单

当使用累计状态时，必须检查：

1. **累计状态的消费点**：
   - 是否只在引擎层使用？✅
   - 是否在日志格式化层使用？❌（需要修复）
   - 是否在 UI 层使用？❌（需要修复）

2. **撤回后的行为**：
   - 累计状态是否会被快照恢复？
   - 重新执行时是否会重复累加？
   - 消费点是否能正确处理旧值？

3. **替代方案**：
   - 能否只依赖当前事件数据？（优先）
   - 能否用事件流替代累计状态？
   - 能否在事件中携带完整信息？

### 框架层改进建议

**可选的框架层改进**（未实施）：

1. **累计状态标记**：
   ```typescript
   interface CumulativeState {
       __cumulative: true;  // 标记为累计状态
       value: number;
   }
   ```

2. **撤回时自动重置累计状态**：
   ```typescript
   function restoreSnapshot(snapshot: GameState) {
       // 自动重置所有标记为 __cumulative 的字段
       return resetCumulativeFields(snapshot);
   }
   ```

3. **静态分析工具**：
   - 检测日志格式化层是否依赖累计状态
   - 在编译期报错

**为什么没有实施**：
- 当前只有 DiceThrone 有这个问题
- 修复成本低（只改一处代码）
- 框架层改进成本高（需要修改引擎核心）
- 遵循 YAGNI 原则（不做过度设计）

## 总结

### Bug 性质

- **游戏层问题**：护盾处理顺序错误（DiceThrone 特有）
- **架构层问题**：日志格式化依赖累计状态（通用模式，但只有 DiceThrone 触发）

### 修复通用性

- **修复原则通用**：日志只依赖当前事件数据
- **修复实现特化**：在 DiceThrone 的 `game.ts` 中修复
- **其他游戏无影响**：没有使用累计状态模式

### 架构启示

1. **累计状态只用于引擎层**，不用于展示层
2. **日志格式化只依赖当前事件**，不依赖跨批次状态
3. **撤回兼容性需要显式检查**，不能假设"状态恢复就没问题"
4. **遵循 YAGNI 原则**，不做过度的框架层抽象

### 预防措施

**新增游戏时的检查清单**：
- [ ] 是否使用累计状态？
- [ ] 累计状态是否只在引擎层使用？
- [ ] 日志格式化是否只依赖当前事件？
- [ ] 撤回后是否会重复累加？

**代码审查要点**：
- 搜索 `?? 0) +` 模式（累计状态）
- 检查 `game.ts` 中是否读取 `payload.total*` 字段
- 确认所有展示层代码只依赖当前事件

## 相关文档

- [护盾日志撤回问题修复](./dicethrone/dicethrone-shield-undo-fix.md)
- [护盾减伤日志修复总结](./dicethrone/dicethrone-shield-logging-fix-summary.md)
- [撤回自动推进问题](../../.spec/knowledge/standards/undo-auto-advance.md)
