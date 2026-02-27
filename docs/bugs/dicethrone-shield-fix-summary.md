# DiceThrone 护盾系统修复总结

## 修复日期
2026/2/27

## 问题概述

用户反馈：圣骑士使用"下次一定"(6点护盾) + "神圣防御"(3点护盾)防御影子盗贼的"匕首打击"(8点伤害)时，应该完全抵消伤害，但实际受到了2点伤害。

经过分析发现两个严重问题：
1. **护盾消耗逻辑 Bug**：多个护盾叠加时，只消耗第一个护盾，其余护盾被直接丢弃
2. **护盾减伤日志缺失**：护盾消耗时不生成事件，日志中看不到减伤记录

## 根本原因

### 历史背景

护盾消耗逻辑最初是为了修复"护盾双重扣减 bug"而引入的简化设计（commit 177fae6）：

```typescript
// 旧逻辑：只消耗第一个护盾
const shield = damageShields[0];
const preventedAmount = Math.min(shield.value, remainingDamage);
remainingDamage -= preventedAmount;
newDamageShields = statusShields;  // 直接丢弃所有 damageShields
```

这个简化过度了，导致多个护盾无法正确叠加。

### 问题 1: 护盾消耗逻辑 Bug

**现象**：
- 只消耗第一个护盾
- 其余护盾被直接丢弃（即使第一个护盾不足以抵消伤害）
- 第一个护盾的剩余值也被丢弃（即使伤害小于护盾值）

**影响**：
- 所有使用多个护盾的场景都受影响
- 用户案例：6 + 3 vs 8 → 实际受到 2 点伤害（期望 0 点）
- 测试验证：5 个测试用例全部失败

**代码位置**：
- `src/games/dicethrone/domain/reduceCombat.ts` 第 111-123 行

### 问题 2: 护盾减伤日志缺失

**现象**：
- 护盾消耗时不生成 `DAMAGE_PREVENTED` 事件
- 日志中看不到"下次一定减伤 6 点"、"神圣防御减伤 3 点"的记录
- 玩家无法从日志中了解护盾的作用

**根因**：
- 护盾消耗逻辑在 reducer 层直接修改状态
- Reducer 只负责状态变更，不应该生成新事件
- 但护盾消耗又需要记录到日志

**架构不一致**：
| 机制 | 事件生成位置 | 日志记录 |
|------|------------|---------|
| `PREVENT_DAMAGE` 事件 | Execute 层 | ✅ 正常记录 |
| 护盾消耗 | Reducer 层 | ❌ 不记录 |
| Token 减伤 | Execute 层 | ✅ 正常记录 |

## 修复方案

### 修复 1: 护盾消耗逻辑

**新逻辑**：按顺序消耗所有护盾，直到伤害完全抵消或护盾耗尽

```typescript
// 新逻辑：按顺序消耗所有护盾
const newDamageShieldsArray: typeof damageShields = [];
let currentDamage = remainingDamage;

// 按顺序消耗护盾（先进先出）
for (const shield of damageShields) {
    if (currentDamage <= 0) {
        // 伤害已完全抵消，保留剩余护盾
        newDamageShieldsArray.push(shield);
        continue;
    }
    
    // 计算本次护盾抵消的伤害
    const preventedAmount = shield.reductionPercent != null
        ? Math.ceil(currentDamage * shield.reductionPercent / 100)
        : Math.min(shield.value, currentDamage);
    
    currentDamage -= preventedAmount;
    
    // 如果是固定值护盾且未完全消耗，保留剩余值
    if (shield.reductionPercent == null) {
        const remainingShieldValue = shield.value - preventedAmount;
        if (remainingShieldValue > 0) {
            newDamageShieldsArray.push({ ...shield, value: remainingShieldValue });
        }
    }
    // 百分比护盾每次都完全消耗（不保留）
}

remainingDamage = currentDamage;
newDamageShields = [...statusShields, ...newDamageShieldsArray];
```

**特性**：
- ✅ 按顺序消耗所有护盾（先进先出）
- ✅ 固定值护盾未完全消耗时保留剩余值
- ✅ 百分比护盾每次完全消耗（不保留）
- ✅ `preventStatus` 护盾不参与伤害抵消，单独保留

### 修复 2: 护盾减伤日志

**当前状态**：暂未修复，需要架构层面的重构

**临时方案**：在日志构建时推断护盾减伤（通过对比 `amount` 和 `actualDamage`）

**长期方案**：在 execute 层预先计算护盾消耗，生成 `DAMAGE_PREVENTED` 事件

## 测试验证

### 新增测试

创建了 `shield-multiple-consumption.test.ts`，包含 8 个测试用例：

1. ✅ 用户案例：下次一定(6) + 神圣防御(3) vs 8点伤害 → HP 50（无伤害）
2. ✅ 第一个护盾不足：3 + 2 vs 10点伤害 → HP 45（受到 5 点伤害）
3. ✅ 第一个护盾完全抵消：10 + 3 vs 5点伤害 → 剩余护盾 [5, 3]
4. ✅ 三个护盾叠加：2 + 3 + 4 vs 7点伤害 → HP 50，剩余护盾 [2]
5. ✅ 百分比+固定值：50% + 3 vs 10点伤害 → HP 48（受到 2 点伤害）
6. ✅ 多个护盾按顺序消耗
7. ✅ 第一个护盾完全抵消，保留剩余护盾
8. ✅ 所有护盾消耗完仍有剩余伤害

### 更新测试

修复了 `shield-cleanup.test.ts` 中的错误期望：
- 6 点护盾抵消 3 点伤害后，应该剩余 3 点护盾（而不是被完全消耗）

### 回归测试

所有现有测试通过：
- ✅ `shield-cleanup.test.ts`：18 个测试全部通过
- ✅ `shield-double-counting-regression.test.ts`：5 个测试全部通过
- ✅ `shield-multiple-consumption.test.ts`：8 个测试全部通过

## 影响范围

### 受影响的护盾来源

1. **下次一定！** (card-next-time): 6 点固定护盾
2. **神圣防御** (holy-defense): 1×头盔 + 2×心面护盾
3. **守护 Token** (protect): 百分比减伤护盾
4. **其他卡牌/技能生成的护盾**

### 用户体验改进

- ✅ 护盾功能正确（多个护盾正确叠加）
- ✅ 护盾剩余值正确保留
- ❌ 日志中仍看不到护盾减伤记录（待后续修复）

## 相关文件

### 修改的文件

- `src/games/dicethrone/domain/reduceCombat.ts` - 护盾消耗逻辑修复
- `src/games/dicethrone/__tests__/shield-cleanup.test.ts` - 测试期望修正
- `src/games/dicethrone/__tests__/shield-multiple-consumption.test.ts` - 新增测试

### 文档

- `docs/bugs/dicethrone-shield-consumption-bug.md` - 问题详细分析
- `docs/bugs/dicethrone-shield-logging-issue.md` - 日志缺失问题分析
- `docs/bugs/dicethrone-shield-fix-summary.md` - 本文档

## 后续工作

### 短期（已完成）

- ✅ 修复护盾消耗逻辑
- ✅ 添加测试验证
- ✅ 回归测试

### 中期（待完成）

- ⏳ 修复护盾减伤日志缺失问题（临时方案：日志构建时推断）
- ⏳ 添加 E2E 测试验证用户案例

### 长期（待规划）

- ⏳ 重构护盾系统，在 execute 层生成 `DAMAGE_PREVENTED` 事件
- ⏳ 统一所有减伤机制的事件生成位置

## 总结

成功修复了 DiceThrone 护盾系统的严重 bug，使多个护盾能够正确叠加消耗。用户反馈的案例得到验证和修复。所有测试通过，无回归问题。

护盾减伤日志缺失问题需要架构层面的重构，暂时保留，后续单独处理。
