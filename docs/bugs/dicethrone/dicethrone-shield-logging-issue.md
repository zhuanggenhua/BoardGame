# DiceThrone 护盾减伤日志缺失问题

## 问题描述

### 用户反馈
- **游戏**: DiceThrone
- **时间**: 2026/2/27 18:42:56
- **问题**: 神圣防御应该防御 9 点伤害（3 头盔 = 3 点 + 下次一定 6 点 = 9 点），但实际受到 2 点伤害
- **日志缺失**: 日志中没有显示"下次一定减伤 6 点"和"神圣防御减伤 3 点"的记录

### 日志记录
```
[18:42:01] 游客6118: 受到 1 点伤害（神圣防御）
[18:42:01] 游客6118: 以【匕首打击】对玩家管理员1造成 8 点伤害
[18:39:58] 管理员1: 确认防御投掷（神圣防御）： [5,3,1]  // 1 头盔 = 1 点防御
[18:39:54] 管理员1: 打出卡牌 下次一定！  // 6 点护盾
```

### 状态快照分析
```json
{
  "players": {
    "0": {  // 管理员1（防御方）
      "damageShields": [],  // 护盾已被消耗
      "resources": {"hp": 51}  // 受到伤害后的 HP
    }
  },
  "lastResolvedAttackDamage": 2  // 实际造成 2 点伤害
}
```

## 根本原因分析

### 1. 护盾消耗在 Reducer 层，不生成事件

**问题代码**: `src/games/dicethrone/domain/reduceCombat.ts` 第 111-123 行

```typescript
export const handleDamageDealt: EventHandler<Extract<DiceThroneEvent, { type: 'DAMAGE_DEALT' }>> = (
    state,
    event
) => {
    // ... 省略前置代码 ...
    
    // 消耗护盾抵消伤害（忽略 preventStatus 护盾）
    if (!bypassShields && !isUltimateDamage && target.damageShields && ...) {
        const damageShields = target.damageShields.filter(shield => !shield.preventStatus);
        if (damageShields.length > 0) {
            const shield = damageShields[0];
            const preventedAmount = shield.reductionPercent != null
                ? Math.ceil(remainingDamage * shield.reductionPercent / 100)
                : Math.min(shield.value, remainingDamage);
            
            remainingDamage -= preventedAmount;  // ✅ 护盾生效了
            newDamageShields = statusShields;    // ✅ 护盾被消耗了
            // ❌ 但没有生成 DAMAGE_PREVENTED 事件！
        }
    }
    
    // ... 省略后续代码 ...
};
```

**问题**:
- 护盾消耗逻辑在 reducer 层直接修改状态
- Reducer 只负责状态变更，不应该生成新事件
- 但护盾消耗又需要记录到日志

### 2. 神圣防御生成护盾，但不记录减伤

**问题代码**: `src/games/dicethrone/domain/customActions/paladin.ts` 第 52-60 行

```typescript
function handleHolyDefenseRoll(...): DiceThroneEvent[] {
    // ... 省略前置代码 ...
    
    // 2. 防止伤害 (Helm + 2*Heart) → 授予临时护盾（攻击结算后清理）
    const preventAmount = (helmCount * 1) + (heartCount * 2);
    if (preventAmount > 0) {
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',  // ✅ 生成护盾授予事件
            payload: { targetId, value: preventAmount, sourceId: sourceAbilityId, preventStatus: false },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 60
        } as DiceThroneEvent);
    }
    
    // ❌ 但护盾消耗时不会生成 DAMAGE_PREVENTED 事件
    
    return events;
}
```

**问题**:
- `DAMAGE_SHIELD_GRANTED` 事件只记录"获得护盾"
- 护盾实际消耗时（在 reducer 层）不生成事件
- 日志系统无法记录"护盾减伤 X 点"

### 3. 架构不一致

**对比其他减伤机制**:

| 机制 | 事件生成位置 | 日志记录 |
|------|------------|---------|
| `PREVENT_DAMAGE` 事件 | Execute 层 | ✅ 正常记录 |
| 护盾消耗 | Reducer 层 | ❌ 不记录 |
| Token 减伤 | Execute 层 | ✅ 正常记录 |

**问题**:
- 护盾消耗走的是不同的路径
- 违反了"所有游戏逻辑在 execute 层生成事件"的原则

## 影响范围

### 受影响的护盾来源

1. **下次一定！** (card-next-time): 6 点固定护盾
2. **神圣防御** (holy-defense): 1×头盔 + 2×心面护盾
3. **守护 Token** (protect): 百分比减伤护盾
4. **其他卡牌/技能生成的护盾**

### 用户体验影响

- ✅ 护盾功能正常（伤害确实被减少）
- ❌ 日志中看不到护盾减伤记录
- ❌ 玩家无法从日志中了解护盾的作用
- ❌ 难以排查"为什么伤害变少了"的问题

## 实际计算验证

### 用户案例分析

**攻击方**: 游客6118（影子盗贼）使用匕首打击
**防御方**: 管理员1（圣骑士）

**防御骰**: [5, 3, 1] = 1 心面 + 1 头盔 + 1 剑面
- 神圣防御效果: 1×头盔 = 1 点防御，1×心面 = 2 点防御，1×剑面 = 1 点反伤
- 总防御: 3 点护盾

**卡牌**: 下次一定！
- 效果: 6 点护盾

**总护盾**: 3 + 6 = 9 点

**攻击伤害**: 8 点（匕首打击）

**计算**:
1. 原始伤害: 8 点
2. 护盾消耗顺序（先进先出）:
   - 下次一定 6 点: 8 - 6 = 2 点剩余
   - 神圣防御 3 点: 2 - 3 = -1 点（完全抵消，剩余 1 点护盾未用）
3. 实际伤害: 0 点

**但日志显示**: 受到 2 点伤害

### 问题定位

**可能的原因**:
1. ❌ 护盾消耗顺序错误（应该先消耗最早的护盾）
2. ❌ 护盾值计算错误
3. ❌ 护盾被提前清理
4. ✅ **最可能**: 护盾消耗逻辑有 bug，导致实际减伤量与预期不符

**需要进一步验证**:
- 检查 `handleDamageDealt` 中护盾消耗的具体逻辑
- 确认护盾数组的顺序和消耗规则
- 验证 `remainingDamage` 的计算是否正确

## 解决方案

### 方案 1: 在 Reducer 层生成事件（不推荐）

**做法**: 修改 `handleDamageDealt`，在护盾消耗时生成 `DAMAGE_PREVENTED` 事件

**问题**:
- 违反"reducer 不生成事件"的架构原则
- 会导致事件循环（reducer 生成事件 → reducer 处理事件）
- 难以维护

### 方案 2: 在 Execute 层预先计算护盾消耗（推荐）

**做法**:
1. 在 execute 层生成 `DAMAGE_DEALT` 事件前，先查询目标的护盾
2. 计算护盾消耗量，生成 `DAMAGE_PREVENTED` 事件
3. `DAMAGE_DEALT` 事件的 `amount` 已经是减去护盾后的值

**优点**:
- 符合架构原则（execute 层生成所有事件）
- 日志系统可以正常记录
- 易于维护

**缺点**:
- 需要重构伤害计算逻辑
- 影响范围较大

### 方案 3: 在日志构建时推断护盾减伤（临时方案）

**做法**: 在 `game.ts` 的日志构建逻辑中，通过对比 `amount` 和 `actualDamage` 的差值，推断护盾减伤量并补充日志条目

**优点**:
- 改动最小
- 不影响核心逻辑

**缺点**:
- 治标不治本
- 无法区分护盾减伤和其他减伤机制
- 日志可能不准确

## 推荐方案

**短期**: 方案 3（临时修复日志显示）
**长期**: 方案 2（重构护盾系统）

### 实施步骤

#### 短期修复（方案 3）

1. 修改 `src/games/dicethrone/game.ts` 的 `DAMAGE_DEALT` 日志构建逻辑
2. 检测 `amount` 和 `actualDamage` 的差值
3. 如果差值 > 0，生成"护盾减伤 X 点"的日志条目
4. 添加测试验证

#### 长期重构（方案 2）

1. 创建 `calculateDamageWithShields` 辅助函数
2. 在 execute 层调用此函数，生成 `DAMAGE_PREVENTED` 事件
3. 修改 reducer 层，移除护盾消耗逻辑（只处理 `DAMAGE_PREVENTED` 事件）
4. 更新所有伤害相关的测试
5. 验证所有护盾来源的功能

## 相关文件

- `src/games/dicethrone/domain/reduceCombat.ts` - 护盾消耗逻辑
- `src/games/dicethrone/domain/customActions/paladin.ts` - 神圣防御实现
- `src/games/dicethrone/domain/commonCards.ts` - 下次一定卡牌定义
- `src/games/dicethrone/game.ts` - 日志构建逻辑
- `docs/ai-rules/engine-systems.md` - 引擎架构文档

## 测试用例

### 需要补充的测试

1. **护盾消耗顺序测试**: 验证多个护盾按先进先出顺序消耗
2. **护盾日志记录测试**: 验证日志中正确显示护盾减伤
3. **神圣防御 + 下次一定组合测试**: 验证两种护盾叠加的效果
4. **护盾溢出测试**: 验证护盾值大于伤害时的处理
5. **百分比护盾测试**: 验证守护 Token 的百分比减伤

## 参考

- 用户反馈: 2026/2/27 18:42:56
- 相关 Issue: 护盾双重扣减 bug（已修复）
- 架构文档: `docs/ai-rules/engine-systems.md`
