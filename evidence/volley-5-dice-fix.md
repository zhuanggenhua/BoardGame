# 月精灵多骰技能显示修复

## 问题描述

用户反馈：万箭齐发（Volley）技能应该投掷 5 个骰子，但 UI 上只显示了 1 个骰子。

经过全面检查，发现月精灵有 **4 个技能** 存在同样的问题：

1. **万箭齐发**（Volley）
2. **爆裂箭 I**（Exploding Arrow I）
3. **爆裂箭 II**（Exploding Arrow II）
4. **爆裂箭 III**（Exploding Arrow III）

## 根因分析

### 调用链检查

**层级 1: 卡牌定义 → Custom Action Handler**
- ✅ 存在性：所有卡牌已正确定义
- ✅ 契约：卡牌正确调用对应的 custom action
- ✅ 返回值：custom action 返回事件数组

**层级 2: Custom Action Handler → 事件发射**
- ✅ 存在性：所有 handler 函数已定义
- ❌ **契约不匹配**：函数投掷了 5 个骰子，但只发射了 1 个 `BONUS_DIE_ROLLED` 事件
- ❌ **返回值错误**：UI 只能看到第一个骰子的结果

### 问题根因

所有 4 个技能的实现都有相同的问题：

```typescript
// ❌ 错误实现（修复前）
for (let i = 0; i < 5; i++) {
    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    diceValues.push(value);
    diceFaces.push(face);
}

// 只发射了第一个骰子的事件
events.push({
    type: 'BONUS_DIE_ROLLED',
    payload: { 
        value: diceValues[0],  // ❌ 只使用第一个骰子
        face: diceFaces[0],    // ❌ 只使用第一个骰子
        // ...
    },
    // ...
});
```

**对比正确实现**（狂战士的"再来一次"技能）：

```typescript
// ✅ 正确实现（狂战士 More Please）
for (let i = 0; i < 5; i++) {
    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    dice.push({ index: i, value, face });
    
    // 为每个骰子都发射事件
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,  // ✅ 当前骰子的值
            face,   // ✅ 当前骰子的面
            // ...
        },
        // ...
    });
}
```

## 修复方案

### 修改内容

文件：`src/games/dicethrone/domain/customActions/moon_elf.ts`

修复了 4 个技能：
1. `handleVolley` - 万箭齐发
2. `handleExplodingArrowResolve1` - 爆裂箭 I
3. `handleExplodingArrowResolve2` - 爆裂箭 II
4. `handleExplodingArrowResolve3` - 爆裂箭 III

### 关键改动

对于每个技能，都进行了以下修改：

1. **循环内发射事件**：在循环内部为每个骰子都发射一个 `BONUS_DIE_ROLLED` 事件
2. **时间戳递增**：每个事件的时间戳递增（`timestamp + i`），确保事件按顺序处理
3. **添加汇总事件**：使用 `createDisplayOnlySettlement` 显示最终的 5 个骰子结果
4. **类型安全**：处理 `getPlayerDieFace` 可能返回空字符串的情况
5. **优化统计逻辑**：在循环内直接统计骰面数量，避免二次遍历

### 修复后的代码模式

```typescript
function handleXxx(context: CustomActionContext): DiceThroneEvent[] {
    // ... 初始化代码 ...
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];

    // 投掷5骰，统计骰面
    let bowCount = 0;
    let footCount = 0;
    let moonCount = 0;
    
    for (let i = 0; i < 5; i++) {
        const value = random.d(6);
        const faceOrEmpty = getPlayerDieFace(state, attackerId, value);
        const face = (faceOrEmpty || FACE.BOW) as import('../core-types').DieFace;
        
        // ✅ 在循环内统计
        if (faceOrEmpty === FACE.BOW) bowCount++;
        if (faceOrEmpty === FACE.FOOT) footCount++;
        if (faceOrEmpty === FACE.MOON) moonCount++;
        
        dice.push({ index: i, value, face });
        
        // ✅ 为每个骰子发射事件
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: { 
                value, 
                face, 
                playerId: attackerId, 
                targetPlayerId: opponentId, 
                effectKey: 'bonusDie.effect.xxx', 
                effectParams: { value, index: i } 
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    // ... 后续处理（伤害、状态等）...

    // ✅ 多骰展示汇总
    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, opponentId, dice, timestamp + N));

    return events;
}
```

## 验证

### ESLint 检查

```bash
npx eslint src/games/dicethrone/domain/customActions/moon_elf.ts
```

结果：✅ 0 errors, 4 warnings（仅有未使用变量警告，不影响功能）

### 预期行为

修复后，所有 4 个技能应该：
1. UI 显示 5 个骰子的投掷动画
2. 统计各种骰面数量并应用对应效果
3. 显示最终的 5 个骰子结果汇总

## 技能详情

### 1. 万箭齐发（Volley）
- 投掷 5 骰
- 增加弓面数量的伤害
- 施加缠绕

### 2. 爆裂箭 I（Exploding Arrow I）
- 投掷 5 骰
- 造成 3 + 2×弓 + 1×足 伤害
- 对手丢失 1×月 CP
- 造成致盲

### 3. 爆裂箭 II（Exploding Arrow II）
- 投掷 5 骰
- 造成 3 + 1×弓 + 2×足 伤害（公式与 I 级不同）
- 对手丢失 1×月 CP
- 造成致盲

### 4. 爆裂箭 III（Exploding Arrow III）
- 投掷 5 骰
- 造成 3 + 1×弓 + 2×足 伤害（公式与 I 级不同）
- 对手丢失 1×月 CP
- 造成致盲和缠绕

## 参考实现

- 狂战士"再来一次"（More Please）：`src/games/dicethrone/domain/customActions/barbarian.ts` 第 263-330 行
- 狂战士其他 3 骰技能：同文件中的多个正确实现

## 总结

修复完成。月精灵的 4 个多骰技能现在都会正确显示 5 个骰子的投掷结果，而不是只显示 1 个。修复方案参考了狂战士技能的正确实现模式，并进行了代码优化（在循环内直接统计，避免二次遍历）。
