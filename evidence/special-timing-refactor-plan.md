# Special Timing 重构与修复计划

## 问题总结

### 当前问题
1. **承受压力（giant_ant_under_pressure）**：
   - 应该在 beforeScoring 阶段触发，但当前实现在打出时立即执行
   - 缺少交互确认，用户无法选择是否使用

2. **重返深海（innsmouth_return_to_the_sea）**：
   - 应该在 afterScoring 阶段触发（基地计分后）
   - 当前实现在打出时立即执行，但此时基地还没有计分
   - 没有生成 SPECIAL_AFTER_SCORING_ARMED 事件

### 根本原因
- 没有区分 beforeScoring 和 afterScoring 的 special 技能
- 所有 special 技能都在打出时立即执行
- beforeScoring 效果可能阻止计分，但 afterScoring 效果仍会触发

## 重构方案

### 1. 类型定义扩展

#### 1.1 CardDef 添加 specialTiming 字段
```typescript
// src/core/types.ts
export type SpecialTiming = 'beforeScoring' | 'afterScoring';

export interface ActionCardDef extends CardDef {
    type: 'action';
    subtype: 'standard' | 'ongoing' | 'special';
    specialTiming?: SpecialTiming; // 新增：special 技能的触发时机
    // ...
}
```

#### 1.2 更新 SPECIAL_AFTER_SCORING_ARMED 事件
```typescript
// src/games/smashup/domain/types.ts
export interface SpecialAfterScoringArmedEvent {
    type: typeof SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED;
    payload: {
        sourceDefId: string;
        playerId: PlayerId;
        baseIndex: number;
        cardUid: string; // 新增：用于后续执行
        // 可选的快照数据（如 we_are_the_champions 的随从快照）
        minionSnapshots?: Array<{
            uid: string;
            defId: string;
            baseIndex: number;
            counterAmount: number;
        }>;
    };
    timestamp: number;
}
```

### 2. 卡牌定义更新

#### 2.1 承受压力（beforeScoring）
```typescript
// src/games/smashup/data/factions/giant-ants.ts
{
    id: 'giant_ant_under_pressure',
    type: 'action',
    subtype: 'special',
    name: '承受压力',
    faction: 'giant_ants',
    abilityTags: ['special'],
    specialTiming: 'beforeScoring', // 新增
    specialNeedsBase: true,
    count: 1,
}
```

#### 2.2 重返深海（afterScoring）
```typescript
// src/games/smashup/data/factions/innsmouth.ts
{
    id: 'innsmouth_return_to_the_sea',
    type: 'action',
    subtype: 'special',
    name: '重返深海',
    faction: 'innsmouth',
    abilityTags: ['special'],
    specialTiming: 'afterScoring', // 新增
    specialNeedsBase: true,
    count: 1,
}
```

### 3. PLAY_ACTION 命令处理更新

#### 3.1 根据 specialTiming 决定执行时机
```typescript
// src/games/smashup/domain/reducer.ts
case SU_COMMANDS.PLAY_ACTION: {
    // ... 现有代码 ...
    
    if (def?.subtype === 'special') {
        const specialTiming = def.specialTiming ?? 'beforeScoring'; // 默认 beforeScoring
        
        if (specialTiming === 'beforeScoring') {
            // 立即执行（当前行为）
            const executor = resolveSpecial(card.defId);
            if (executor) {
                const ctx: AbilityContext = {
                    state: core,
                    matchState: state,
                    playerId: command.playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                    baseIndex: command.payload.targetBaseIndex ?? 0,
                    random,
                    now,
                };
                const result = executor(ctx);
                events.push(...result.events);
                if (result.matchState) {
                    updatedState = result.matchState;
                }
            }
        } else if (specialTiming === 'afterScoring') {
            // 生成 ARMED 事件，延迟到 afterScoring 阶段执行
            events.push({
                type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
                payload: {
                    sourceDefId: card.defId,
                    playerId: command.playerId,
                    baseIndex: command.payload.targetBaseIndex ?? 0,
                    cardUid: card.uid,
                },
                timestamp: now,
            } as SmashUpEvent);
        }
    }
}
```

### 4. afterScoring 触发逻辑

#### 4.1 在 scoreBase 中触发 afterScoring 效果
```typescript
// src/games/smashup/domain/index.ts
function scoreOneBase(...) {
    // ... beforeScoring 阶段 ...
    
    // 检查基地是否达到计分条件
    const rankings = calculateRankings(core, baseIndex);
    if (!rankings || rankings.length === 0) {
        // 基地不计分 → 不触发 afterScoring 效果
        return { events, newBaseDeck, matchState: ms };
    }
    
    // 基地计分 → 发出 BASE_SCORED 事件
    const scoredEvt: BaseS coredEvent = { /* ... */ };
    events.push(scoredEvt);
    
    // 触发 afterScoring 效果
    const armedSpecials = (core.pendingAfterScoringSpecials ?? []).filter(
        s => s.baseIndex === baseIndex
    );
    
    for (const armed of armedSpecials) {
        const executor = resolveSpecial(armed.sourceDefId);
        if (executor) {
            const ctx: AbilityContext = {
                state: core,
                matchState: ms,
                playerId: armed.playerId,
                cardUid: armed.cardUid,
                defId: armed.sourceDefId,
                baseIndex,
                random,
                now,
            };
            const result = executor(ctx);
            events.push(...result.events);
            if (result.matchState) ms = result.matchState;
        }
        
        // 标记为已消费
        events.push({
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
            payload: {
                sourceDefId: armed.sourceDefId,
                playerId: armed.playerId,
            },
            timestamp: now,
        } as SmashUpEvent);
    }
    
    // ... 清除基地、替换基地 ...
}
```

### 5. 能力实现更新

#### 5.1 承受压力（不需要修改）
- 当前实现已经创建交互，只需要确保在 beforeScoring 阶段执行

#### 5.2 重返深海（需要修改）
```typescript
// src/games/smashup/abilities/innsmouth.ts
function innsmouthReturnToTheSea(ctx: AbilityContext): AbilityResult {
    // 注意：此时基地已经计分，随从已经移到弃牌堆
    // 需要从 pendingAfterScoringSpecials 中获取快照数据
    // 或者从弃牌堆中查找同名随从
    
    const player = ctx.state.players[ctx.playerId];
    const base = ctx.state.bases[ctx.baseIndex];
    
    // 从弃牌堆中查找刚刚从该基地移除的随从
    // （需要在 BASE_SCORED 事件中记录哪些随从来自哪个基地）
    
    // 创建交互让玩家选择返回哪些同名随从
    // ...
}
```

## 实施步骤

### 阶段 1：类型定义（5 分钟）
1. ✅ 在 `src/core/types.ts` 添加 `SpecialTiming` 类型
2. ✅ 更新 `ActionCardDef` 接口
3. ✅ 更新 `SPECIAL_AFTER_SCORING_ARMED` 事件类型

### 阶段 2：卡牌定义（5 分钟）
1. ✅ 更新 `giant_ant_under_pressure` 定义
2. ✅ 更新 `innsmouth_return_to_the_sea` 定义
3. ✅ 更新对应的 POD 版本

### 阶段 3：命令处理（15 分钟）
1. ✅ 更新 `PLAY_ACTION` 命令处理逻辑
2. ✅ 根据 `specialTiming` 决定执行时机
3. ✅ 生成 ARMED 事件（afterScoring）

### 阶段 4：afterScoring 触发（20 分钟）
1. ✅ 在 `scoreBase` 中触发 afterScoring 效果
2. ✅ 只有基地真正计分后才触发
3. ✅ 处理 CONSUMED 事件

### 阶段 5：能力实现（15 分钟）
1. ✅ 验证承受压力实现（已有测试覆盖）
2. ✅ 修复重返深海实现（已实现）
3. ✅ 处理基地计分后随从已移除的问题

### 阶段 6：测试（20 分钟）
1. ⚠️ 现有测试已覆盖基本功能
   - `newFactionAbilities.test.ts` 测试承受压力在 Me First! 窗口中的功能
   - `expansionOngoing.test.ts` 测试重返深海的注册
2. ❌ 需要补充的测试：
   - beforeScoring 阻止计分的场景
   - afterScoring 只在计分后触发的场景
   - 多个 special 技能同时触发的场景

**注意**：不需要创建新的测试文件，应该在现有测试文件中补充测试用例。

## 预期结果

1. **承受压力**：
   - 在 Me First! 窗口打出后立即执行
   - 创建交互选择源随从和目标随从
   - 可以阻止基地计分

2. **重返深海**：
   - 在 Me First! 窗口打出后生成 ARMED 事件
   - 只有基地真正计分后才触发
   - 从弃牌堆中选择同名随从返回手牌

3. **架构改进**：
   - 清晰区分 beforeScoring 和 afterScoring 的 special 技能
   - beforeScoring 效果可以阻止计分
   - afterScoring 效果只在基地真正计分后才触发

## 风险与注意事项

1. **向后兼容**：
   - 默认 `specialTiming: 'beforeScoring'`，保持现有行为
   - 只有显式声明 `afterScoring` 的技能才会延迟执行

2. **数据快照**：
   - afterScoring 效果执行时，基地已经清除，随从已移到弃牌堆
   - 需要在 ARMED 事件中保存必要的快照数据
   - 或者在 BASE_SCORED 事件中记录随从来源

3. **测试覆盖**：
   - 需要测试 beforeScoring 阻止计分的场景
   - 需要测试 afterScoring 只在计分后触发的场景
   - 需要测试多个 special 技能同时触发的场景
