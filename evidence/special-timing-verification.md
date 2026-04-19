# Special Timing 实现验证

## 用户问题

> 确认现在再计分前能不能打出

## 验证结果

✅ **可以打出**。承受压力（`specialTiming: 'beforeScoring'`）可以在 Me First! 窗口中打出，在基地计分前执行。

## 实现验证

### 1. 类型定义 ✅

```typescript
// src/games/smashup/domain/types.ts
export type SpecialTiming = 'beforeScoring' | 'afterScoring';

export interface ActionCardDef extends CardDef {
    specialTiming?: SpecialTiming;
}
```

### 2. 卡牌定义 ✅

```typescript
// src/games/smashup/data/factions/giant-ants.ts
{
    id: 'giant_ant_under_pressure',
    type: 'action',
    subtype: 'special',
    specialTiming: 'beforeScoring', // ✅ 计分前执行
    specialNeedsBase: true,
}

// src/games/smashup/data/factions/innsmouth.ts
{
    id: 'innsmouth_return_to_the_sea',
    type: 'action',
    subtype: 'special',
    specialTiming: 'afterScoring', // ✅ 计分后执行
    specialNeedsBase: true,
}
```

### 3. 验证逻辑 ✅

**Me First! 窗口中（可以打出）**：

```typescript
// src/games/smashup/domain/commands.ts (lines 200-265)
if (sys.responseWindow?.current?.type === 'me_first') {
    // ✅ 允许打出 special 卡
    if (rDef.subtype !== 'special') {
        return { valid: false, error: 'Me First! 响应只能打出特殊行动卡' };
    }
    
    // ✅ 检查基地是否达到 breakpoint
    const eligibleIndices = getScoringEligibleBaseIndices(core);
    if (!eligibleIndices.includes(targetBaseIndex)) {
        return { valid: false, error: '只能选择达到临界点的基地' };
    }
    
    return { valid: true }; // ✅ 验证通过
}
```

**正常出牌阶段（不能打出）**：

```typescript
// src/games/smashup/domain/commands.ts (lines 281-283)
if (def.subtype === 'special') {
    return { valid: false, error: '特殊行动卡只能在基地计分前的 Me First! 窗口中打出' };
}
```

### 4. 执行逻辑 ✅

```typescript
// src/games/smashup/domain/reducer.ts (lines 247-271)
if (isSpecial) {
    const specialTiming = def.specialTiming ?? 'beforeScoring';
    
    if (specialTiming === 'beforeScoring') {
        // ✅ 立即执行（在计分前）
        const executor = resolveSpecial(card.defId) ?? resolveOnPlay(card.defId);
        if (executor) {
            const result = executor(ctx);
            events.push(...result.events);
            if (result.matchState) {
                updatedState = result.matchState;
            }
        }
    } else if (specialTiming === 'afterScoring') {
        // ✅ 生成 ARMED 事件，延迟到计分后执行
        events.push({
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
            payload: {
                sourceDefId: card.defId,
                playerId: command.playerId,
                baseIndex: command.payload.targetBaseIndex ?? 0,
                cardUid: card.uid,
            },
            timestamp: now,
        });
    }
}
```

### 5. afterScoring 触发 ✅

```typescript
// src/games/smashup/domain/index.ts (scoreOneBase 函数)
// 触发 ARMED 的 afterScoring special 技能
const armedSpecials = (updatedCore.pendingAfterScoringSpecials ?? []).filter(
    s => s.baseIndex === baseIndex
);

for (const armed of armedSpecials) {
    const executor = resolveSpecial(armed.sourceDefId);
    if (executor) {
        const result = executor(ctx);
        events.push(...result.events);
        // ...
    }
}
```

## 工作流程

### beforeScoring（承受压力）

1. 基地达到 breakpoint → 打开 Me First! 窗口
2. 玩家打出承受压力 → 验证通过（`specialTiming: 'beforeScoring'`）
3. 立即执行 → 创建交互选择源随从和目标随从
4. 玩家选择 → **转移力量指示物**（从计分基地上的随从转移到其他基地上的随从）
5. 重新计算排名 → 可能阻止基地计分（因为力量减少）

### afterScoring（重返深海）

1. 基地达到 breakpoint → 打开 Me First! 窗口
2. 玩家打出重返深海 → 验证通过（`specialTiming: 'afterScoring'`）
3. 生成 ARMED 事件 → 延迟执行
4. 基地计分 → 发出 BASE_SCORED 事件
5. 触发 ARMED 效果 → 从弃牌堆选择同名随从返回手牌

## 测试状态

### 现有测试覆盖

1. ✅ `newFactionAbilities.test.ts` - 测试承受压力在 Me First! 窗口中的功能
2. ✅ `expansionOngoing.test.ts` - 测试重返深海的注册

### 测试失败原因（已知）

- 测试用例中基地力量不足，无法触发 Me First! 窗口
- 需要修改测试用例，确保基地达到 breakpoint（20 力量）

### 修复方案

**方案 1：增加随从力量**
```typescript
bases: [
    {
        defId: 'base_plateau_of_leng', // breakpoint = 20
        minions: [
            makeMinion('m1', 'giant_ant_worker', '0', 5, { powerCounters: 5 }),
            makeMinion('m2', 'giant_ant_worker', '0', 5, { powerCounters: 5 }),
            makeMinion('m3', 'giant_ant_worker', '0', 5, { powerCounters: 5 }),
            makeMinion('m4', 'giant_ant_worker', '0', 5, { powerCounters: 5 }),
        ],
    },
],
```

**方案 2：使用低 breakpoint 基地**
```typescript
bases: [
    {
        defId: 'base_the_homeworld', // breakpoint = 10
        minions: [
            makeMinion('m1', 'giant_ant_worker', '0', 3, { powerCounters: 3 }),
            makeMinion('m2', 'giant_ant_worker', '0', 3, { powerCounters: 3 }),
            makeMinion('m3', 'giant_ant_worker', '0', 4, { powerCounters: 4 }),
        ],
    },
],
```

## 结论

✅ **实现正确**：承受压力（`specialTiming: 'beforeScoring'`）可以在 Me First! 窗口中打出，在基地计分前执行。

✅ **架构正确**：
- beforeScoring 效果可以阻止计分（在排名计算前执行）
- afterScoring 效果只在基地真正计分后触发（在 BASE_SCORED 后执行）
- ARMED 事件正确传递 cardUid 用于后续执行

⚠️ **测试需要修复**：测试用例中基地力量不足，需要修改测试数据确保基地达到 breakpoint。

## 下一步

根据用户要求，不需要创建新测试文件，应该在现有测试文件中补充测试用例：

1. 在 `newFactionAbilities.test.ts` 中补充承受压力的测试（修复基地力量）
2. 在 `expansionOngoing.test.ts` 中补充重返深海的测试（修复基地力量）
3. 只需要 1-2 个典型用例，不需要穷举所有场景
