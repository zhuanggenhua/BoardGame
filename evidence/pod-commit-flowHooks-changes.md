# POD 提交 flowHooks.ts 变更分析

## 执行时间
2026-03-03

---

## 关键发现

### 1. 删除了 `getCoreForPostDamageAfterEvasion` 函数

**位置**: `src/games/dicethrone/domain/flowHooks.ts` 第 88-113 行

**功能**: 闪避后的 postDamage 状态修正

**删除的代码**:
```typescript
function getCoreForPostDamageAfterEvasion(core: DiceThroneCore): DiceThroneCore {
    const pending = core.pendingAttack;
    if (!pending) return core;

    // 只在完全闪避（resolvedDamage 为 0 且 damageResolved 为 true）时修正
    // 非闪避场景（如正常减伤后 resolvedDamage > 0）不需要修正
    if ((pending.resolvedDamage ?? 0) > 0) return core;

    const baseDamage = getPendingAttackExpectedDamage(core, pending, 1);
    return {
        ...core,
        pendingAttack: {
            ...pending,
            resolvedDamage: baseDamage,
        },
    };
}
```

**影响**: 
- 闪避后的 onHit 效果无法正确触发
- 测试失败：monk-coverage.test.ts, monk-vs-shadow-thief-shield.test.ts

---

### 2. 删除了 defensiveRoll 阶段的闪避逻辑

**位置**: `src/games/dicethrone/domain/flowHooks.ts` defensiveRoll 退出逻辑

**删除的代码**:
```typescript
// 闪避修正：完全闪避时 resolvedDamage 为 0，但攻击仍视为命中
// 将 resolvedDamage 设为基础伤害让 onHit 效果正确触发
const coreForPostDamage = getCoreForPostDamageAfterEvasion(core);
const isFullyEvaded = coreForPostDamage !== core;
const postDamageEvents = resolvePostDamageEffects(coreForPostDamage, random, timestamp);
// 闪避免伤：过滤掉 DAMAGE_DEALT 事件（伤害已被闪避免除，非伤害效果仍生效）
const filteredPostDamageEvents = isFullyEvaded
    ? postDamageEvents.filter(e => e.type !== 'DAMAGE_DEALT')
    : postDamageEvents;
events.push(...filteredPostDamageEvents);
```

**替换为**:
```typescript
const postDamageEvents = resolvePostDamageEffects(core, random, timestamp);
events.push(...postDamageEvents);
```

**影响**:
- 闪避后的伤害计算不正确
- onHit 效果无法触发
- 测试失败：monk-coverage.test.ts, monk-vs-shadow-thief-shield.test.ts

---

### 3. 删除了 offensiveRoll 阶段的闪避逻辑

**位置**: `src/games/dicethrone/domain/flowHooks.ts` offensiveRoll 退出逻辑

**删除的代码**: 与 defensiveRoll 相同的闪避逻辑

**影响**: 同上

---

### 4. 简化了潜行（sneak）逻辑

**位置**: `src/games/dicethrone/domain/flowHooks.ts` offensiveRoll 退出逻辑

**删除的代码**:
```typescript
// 潜行免伤但攻击成功：onHit 条件需要 damageDealt >= 1 才触发
// 将 resolvedDamage 设为基础伤害值，让 onHit 正确判定为"命中"
const sneakBaseDamage = getPendingAttackExpectedDamage(
    coreAfterPreDefenseSneak, core.pendingAttack, 1
);
const coreForPostDamage = {
    ...coreAfterPreDefenseSneak,
    pendingAttack: {
        ...coreAfterPreDefenseSneak.pendingAttack!,
        resolvedDamage: sneakBaseDamage,
    },
};
const postDamageEventsSneak = resolvePostDamageEffects(coreForPostDamage, random, timestamp);
// 潜行免伤：过滤掉所有 DAMAGE_DEALT 事件（包括 rollDie 的 bonusDamage 独立伤害）
events.push(...postDamageEventsSneak.filter(e => e.type !== 'DAMAGE_DEALT'));

// === 与非潜行路径对齐的 halt 检查 ===
const hasBonusDiceRerollSneak = postDamageEventsSneak.some(e => e.type === 'BONUS_DICE_REROLL_REQUESTED');
const hasPostDamageChoiceSneak = postDamageEventsSneak.some(e => e.type === 'CHOICE_REQUESTED');
const hasTokenResponseSneak = postDamageEventsSneak.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
if (hasBonusDiceRerollSneak || hasPostDamageChoiceSneak || hasTokenResponseSneak) {
    return { events, halt: true };
}

// 检查晕眩（daze）额外攻击
const { dazeEvents: dazeEventsSneak, triggered: dazeTriggeredSneak } = checkDazeExtraAttack(
    core, events, command.type, timestamp
);
if (dazeTriggeredSneak) {
    events.push(...dazeEventsSneak);
    return { events, overrideNextPhase: 'offensiveRoll' };
}

// 攻击结算后响应窗口（如 card-dizzy：造成 ≥8 伤害后打出）
const afterAttackWindowSneak = checkAfterAttackResponseWindow(core, events, command.type, timestamp, from as TurnPhase);
if (afterAttackWindowSneak) {
    events.push(afterAttackWindowSneak);
    return { events, halt: true };
}
```

**替换为**:
```typescript
const coreForPostDamage = preDefenseEventsSneak.length > 0
    ? applyEvents(core, [...events] as DiceThroneEvent[], reduce)
    : core;
const postDamageEventsSneak = resolvePostDamageEffects(coreForPostDamage, random, timestamp);
events.push(...postDamageEventsSneak);
return { events, overrideNextPhase: 'main2' };
```

**影响**:
- 潜行后的 onHit 效果无法触发
- Daze 额外攻击无法触发
- 攻击结算后响应窗口无法打开
- 测试失败：token-execution.test.ts（Daze 额外攻击）

---

### 5. 修改了燃烧（burn）伤害计算

**位置**: `src/games/dicethrone/domain/flowHooks.ts` upkeep 阶段进入逻辑

**删除的代码**:
```typescript
// 1. 燃烧 (burn) — 持续效果，不可叠加，每回合固定造成 2 点不可防御伤害，不自动移除
const burnStacks = player.statusEffects[STATUS_IDS.BURN] ?? 0;
if (burnStacks > 0) {
    const damageCalc = createDamageCalculation({
        source: { playerId: 'system', abilityId: 'upkeep-burn' },
        target: { playerId: activeId },
        baseDamage: 2,
        state: core,
        timestamp,
    });
    const damageEvents = damageCalc.toEvents();
    events.push(...damageEvents);
    // 持续效果：燃烧不自动移除，需要通过净化等手段移除
}
```

**替换为**:
```typescript
// 1. 燃烧 (burn) — 每层造成 1 点伤害，然后移除 1 层
const burnStacks = player.statusEffects[STATUS_IDS.BURN] ?? 0;
if (burnStacks > 0) {
    const damageCalc = createDamageCalculation({
        source: { playerId: 'system', abilityId: 'upkeep-burn' },
        target: { playerId: activeId },
        baseDamage: burnStacks,
        state: core,
        timestamp,
    });
    const damageEvents = damageCalc.toEvents();
    events.push(...damageEvents);
    // 移除 1 层燃烧
    events.push({
        type: 'STATUS_REMOVED',
        payload: { targetId: activeId, statusId: STATUS_IDS.BURN, stacks: 1 },
        sourceCommandType: command.type,
        timestamp,
    } as DiceThroneEvent);
}
```

**影响**:
- 燃烧机制从"固定 2 点伤害"改为"每层 1 点伤害"
- 燃烧从"持续效果"改为"自动递减"
- 这可能是有意的规则修改，不是 bug

---

### 6. 修改了潜行（sneak）消耗逻辑

**位置**: `src/games/dicethrone/domain/flowHooks.ts` offensiveRoll 退出逻辑

**删除的代码**:
```typescript
// 不消耗潜行标记——潜行在回合末自动弃除，触发免伤时不移除
```

**替换为**:
```typescript
// 消耗潜行标记
events.push({
    type: 'TOKEN_CONSUMED',
    payload: {
        playerId: core.pendingAttack.defenderId,
        tokenId: TOKEN_IDS.SNEAK,
        amount: 1,
        newTotal: sneakStacks - 1,
    },
    sourceCommandType: command.type,
    timestamp,
} as TokenConsumedEvent);
```

**影响**:
- 潜行从"回合末自动弃除"改为"触发时立即消耗"
- 这可能是有意的规则修改，不是 bug

---

### 7. 简化了 expectedDamage 计算

**位置**: `src/games/dicethrone/domain/flowHooks.ts` offensiveRoll 退出逻辑

**删除的代码**:
```typescript
const expectedDamage = getPendingAttackExpectedDamage(coreAfterPreDefense, core.pendingAttack);
```

**替换为**:
```typescript
const expectedDamage = sourceAbilityId 
    ? getPlayerAbilityBaseDamage(coreAfterPreDefense, attackerId, sourceAbilityId) + (core.pendingAttack.bonusDamage ?? 0)
    : 0;
```

**影响**:
- 简化了伤害计算逻辑
- 可能影响 Token 使用判定

---

## 修复优先级

### 高优先级（必须修复）

1. **恢复 `getCoreForPostDamageAfterEvasion` 函数**
   - 影响：闪避后 onHit 效果
   - 测试失败：3 个

2. **恢复 defensiveRoll 和 offensiveRoll 的闪避逻辑**
   - 影响：闪避伤害计算
   - 测试失败：3 个

3. **恢复潜行的完整逻辑**
   - 影响：Daze 额外攻击、响应窗口
   - 测试失败：4 个

### 中优先级（需要确认）

4. **燃烧机制变更**
   - 需要确认是否为有意的规则修改
   - 如果是 bug，需要恢复

5. **潜行消耗逻辑变更**
   - 需要确认是否为有意的规则修改
   - 如果是 bug，需要恢复

### 低优先级（可选）

6. **expectedDamage 计算简化**
   - 需要确认是否影响功能
   - 如果有问题，再修复

---

## 修复计划

### Step 1: 恢复闪避逻辑（1 小时）

1. 恢复 `getCoreForPostDamageAfterEvasion` 函数
2. 恢复 defensiveRoll 的闪避逻辑
3. 恢复 offensiveRoll 的闪避逻辑（damageResolved 分支）
4. 运行测试验证

**预期修复**: 3 个测试失败（monk-coverage.test.ts, monk-vs-shadow-thief-shield.test.ts）

### Step 2: 恢复潜行完整逻辑（1 小时）

1. 恢复潜行的 onHit 效果逻辑
2. 恢复 Daze 额外攻击检查
3. 恢复响应窗口检查
4. 恢复 halt 检查
5. 运行测试验证

**预期修复**: 4 个测试失败（token-execution.test.ts）

### Step 3: 确认规则变更（30 分钟）

1. 检查燃烧机制是否为有意修改
2. 检查潜行消耗逻辑是否为有意修改
3. 如果是 bug，恢复原逻辑

---

## 总结

**关键问题**: POD 提交删除了闪避和潜行的完整逻辑，导致 7 个测试失败

**修复时间**: 2-3 小时

**修复后测试通过率**: 预计 99.4%（977/983）
