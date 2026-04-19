# DiceThrone 护盾消耗逻辑 Bug

## 严重问题：只消耗第一个护盾

### 问题代码

`src/games/dicethrone/domain/reduceCombat.ts` 第 111-123 行：

```typescript
// 消耗护盾抵消伤害（忽略 preventStatus 护盾）
if (!bypassShields && !isUltimateDamage && target.damageShields && target.damageShields.length > 0 && remainingDamage > 0) {
    const statusShields = target.damageShields.filter(shield => shield.preventStatus);
    const damageShields = target.damageShields.filter(shield => !shield.preventStatus);
    if (damageShields.length > 0) {
        const shield = damageShields[0];  // ❌ 只取第一个护盾
        const preventedAmount = shield.reductionPercent != null
            ? Math.ceil(remainingDamage * shield.reductionPercent / 100)
            : Math.min(shield.value, remainingDamage);

        remainingDamage -= preventedAmount;
        newDamageShields = statusShields;  // ❌ 直接丢弃所有 damageShields，只保留 statusShields
    }
}
```

### 问题分析

#### 1. 只消耗第一个护盾

**当前逻辑**:
```typescript
const shield = damageShields[0];  // 只取第一个
const preventedAmount = Math.min(shield.value, remainingDamage);
remainingDamage -= preventedAmount;
newDamageShields = statusShields;  // 丢弃所有 damageShields
```

**问题**:
- 如果第一个护盾值 < 伤害，应该继续消耗第二个护盾
- 但当前代码直接丢弃了所有 damageShields
- 导致多个护盾叠加时，只有第一个生效

#### 2. 用户案例验证

**场景**: 管理员1（圣骑士）防御游客6118（影子盗贼）的匕首打击

**护盾来源**:
1. 下次一定！卡牌: 6 点护盾（先打出）
2. 神圣防御技能: 3 点护盾（防御骰结算后生成）

**护盾数组顺序**（先进先出）:
```typescript
damageShields = [
    { value: 6, sourceId: 'card-next-time', preventStatus: false },      // 第一个
    { value: 3, sourceId: 'holy-defense', preventStatus: false }          // 第二个
]
```

**攻击伤害**: 8 点

**当前错误逻辑**:
```
1. 取第一个护盾: value = 6
2. preventedAmount = min(6, 8) = 6
3. remainingDamage = 8 - 6 = 2
4. newDamageShields = []  // ❌ 丢弃所有护盾，包括未使用的第二个护盾
5. 实际伤害 = 2 点
```

**正确逻辑应该是**:
```
1. 取第一个护盾: value = 6
2. preventedAmount = min(6, 8) = 6
3. remainingDamage = 8 - 6 = 2
4. 第一个护盾完全消耗，继续处理第二个护盾
5. 取第二个护盾: value = 3
6. preventedAmount = min(3, 2) = 2
7. remainingDamage = 2 - 2 = 0
8. 第二个护盾剩余 1 点，保留到数组中
9. newDamageShields = [{ value: 1, sourceId: 'holy-defense', preventStatus: false }]
10. 实际伤害 = 0 点
```

**结论**: 用户反馈"应该防御 9 点但受到 2 点伤害"是正确的，这是一个真实的 bug！

### 3. 正确的护盾消耗逻辑

```typescript
// 消耗护盾抵消伤害（忽略 preventStatus 护盾）
if (!bypassShields && !isUltimateDamage && target.damageShields && target.damageShields.length > 0 && remainingDamage > 0) {
    const statusShields = target.damageShields.filter(shield => shield.preventStatus);
    const damageShields = target.damageShields.filter(shield => !shield.preventStatus);
    
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
}
```

### 4. 影响范围

#### 受影响的场景

1. **多个护盾叠加**: 任何情况下有 2+ 个护盾时，只有第一个生效
2. **护盾值 < 伤害**: 第一个护盾无法完全抵消伤害时，剩余伤害不会被第二个护盾抵消
3. **护盾值 > 伤害**: 第一个护盾完全抵消伤害后，剩余护盾值被错误丢弃

#### 常见组合

- 下次一定 (6) + 神圣防御 (1-6) ❌
- 下次一定 (6) + 守护 Token (百分比) ❌
- 神圣防御 (1-6) + 守护 Token (百分比) ❌
- 多个卡牌护盾叠加 ❌

### 5. 测试用例

#### 现有测试的问题

查看 `src/games/dicethrone/__tests__/shield-cleanup.test.ts`:

```typescript
it('多个护盾时只消耗第一个（先进先出）', () => {
    const core = createCoreState();
    
    // 防御方有多个护盾
    core.players['1'].damageShields = [
        { value: 3, sourceId: 'holy-defense', preventStatus: false },
        { value: 1, sourceId: 'protect-token', preventStatus: false },
        { value: 1, sourceId: 'barbarian-thick-skin', preventStatus: true },
    ];
    
    // 5 点伤害
    const damageEvent: DamageDealtEvent = {
        type: 'DAMAGE_DEALT',
        payload: { targetId: '1', amount: 5, actualDamage: 5, sourceAbilityId: 'test' },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: 1,
    };
    
    const newCore = reduce(core, damageEvent);
    
    // ❌ 测试期望：只消耗第一个护盾（3点），剩余伤害 2 点
    // ❌ 但实际应该：消耗第一个（3点）+ 第二个（1点），剩余伤害 1 点
    expect(newCore.players['1'].resources.hp).toBe(48); // 50 - 2 = 48
    
    // ❌ 测试期望：保留第二个和第三个护盾
    // ❌ 但实际代码：丢弃所有 damageShields，只保留 statusShields
    expect(newCore.players['1'].damageShields).toEqual([
        { value: 1, sourceId: 'protect-token', preventStatus: false },
        { value: 1, sourceId: 'barbarian-thick-skin', preventStatus: true },
    ]);
});
```

**问题**: 这个测试本身就是错误的！它验证了错误的行为。

#### 正确的测试用例

```typescript
describe('护盾消耗逻辑（修复后）', () => {
    it('多个护盾按顺序消耗，直到伤害完全抵消', () => {
        const core = createCoreState();
        
        // 防御方有多个护盾
        core.players['1'].damageShields = [
            { value: 6, sourceId: 'card-next-time', preventStatus: false },      // 第一个
            { value: 3, sourceId: 'holy-defense', preventStatus: false },        // 第二个
        ];
        
        // 8 点伤害
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 8, actualDamage: 8, sourceAbilityId: 'dagger-strike' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        // ✅ 第一个护盾消耗 6 点，第二个护盾消耗 2 点，剩余伤害 0 点
        expect(newCore.players['1'].resources.hp).toBe(50); // 无伤害
        
        // ✅ 第二个护盾剩余 1 点
        expect(newCore.players['1'].damageShields).toEqual([
            { value: 1, sourceId: 'holy-defense', preventStatus: false },
        ]);
    });
    
    it('第一个护盾完全抵消伤害，保留剩余护盾', () => {
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 10, sourceId: 'card-next-time', preventStatus: false },
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];
        
        // 5 点伤害
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 5, actualDamage: 5, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        // ✅ 第一个护盾消耗 5 点，剩余 5 点；第二个护盾未使用
        expect(newCore.players['1'].resources.hp).toBe(50);
        expect(newCore.players['1'].damageShields).toEqual([
            { value: 5, sourceId: 'card-next-time', preventStatus: false },
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ]);
    });
    
    it('所有护盾消耗完仍有剩余伤害', () => {
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
            { value: 2, sourceId: 'protect-token', preventStatus: false },
        ];
        
        // 10 点伤害
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 10, actualDamage: 10, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        // ✅ 护盾消耗 3 + 2 = 5 点，剩余伤害 5 点
        expect(newCore.players['1'].resources.hp).toBe(45); // 50 - 5 = 45
        expect(newCore.players['1'].damageShields).toEqual([]);
    });
    
    it('百分比护盾 + 固定值护盾组合', () => {
        const core = createCoreState();
        
        core.players['1'].damageShields = [
            { value: 50, sourceId: 'protect-token', preventStatus: false, reductionPercent: 50 }, // 50% 减伤
            { value: 3, sourceId: 'holy-defense', preventStatus: false },
        ];
        
        // 10 点伤害
        const damageEvent: DamageDealtEvent = {
            type: 'DAMAGE_DEALT',
            payload: { targetId: '1', amount: 10, actualDamage: 10, sourceAbilityId: 'test' },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: 1,
        };
        
        const newCore = reduce(core, damageEvent);
        
        // ✅ 第一个护盾减伤 50% = 5 点，剩余 5 点
        // ✅ 第二个护盾消耗 3 点，剩余 2 点伤害
        expect(newCore.players['1'].resources.hp).toBe(48); // 50 - 2 = 48
        expect(newCore.players['1'].damageShields).toEqual([]); // 百分比护盾消耗后不保留
    });
});
```

## 修复方案

### 1. 修改 `reduceCombat.ts`

```typescript
// 消耗护盾抵消伤害（忽略 preventStatus 护盾）
if (!bypassShields && !isUltimateDamage && target.damageShields && target.damageShields.length > 0 && remainingDamage > 0) {
    const statusShields = target.damageShields.filter(shield => shield.preventStatus);
    const damageShields = target.damageShields.filter(shield => !shield.preventStatus);
    
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
}
```

### 2. 更新测试用例

- 修改 `shield-cleanup.test.ts` 中的错误测试
- 添加上述新测试用例
- 验证所有护盾相关功能

### 3. 回归测试

- 运行所有 DiceThrone 测试
- 手动测试多个护盾叠加场景
- 验证用户反馈的案例

## 优先级

**严重性**: 🔴 高（影响核心战斗机制）
**影响范围**: 所有使用护盾的场景
**修复难度**: 中等（需要重构护盾消耗逻辑 + 更新测试）

## 相关问题

- [护盾日志缺失问题](./dicethrone-shield-logging-issue.md)
- 护盾双重扣减 bug（已修复）

## 总结

这是一个严重的游戏逻辑 bug，导致多个护盾叠加时只有第一个生效。用户反馈的"应该防御 9 点但受到 2 点伤害"是正确的，需要立即修复。

修复后需要同时解决日志记录问题，确保玩家能看到护盾的实际作用。
