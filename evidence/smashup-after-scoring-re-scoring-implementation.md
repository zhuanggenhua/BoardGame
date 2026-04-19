# 大杀四方 - 计分后重新计分功能实现

## 实现日期
2026-03-04

## 用户需求
"计分后触发的，在计分后哪怕达不到临界值也要算分哦"

## 规则理解

afterScoring 卡牌（如"我们乃最强"）在基地计分后、清除前打出，可以影响该基地的力量分布（如转移指示物）。如果力量变化，需要重新计分该基地，即使基地没有达到临界值。

## 实现方案

### 方案选择
采用**方案 1：记录初始力量，响应窗口关闭后对比**

优点：
- 精确：只在力量真正变化时重新计分
- 高效：不需要监听多种事件类型
- 清晰：逻辑集中在两个地方（记录初始力量 + 对比并重新计分）

### 实现步骤

#### 步骤 1：记录初始力量（在 `scoreOneBase` 中）

**位置**：`src/games/smashup/domain/index.ts` - `scoreOneBase` 函数

**时机**：打开 afterScoring 响应窗口前

**实现**：
```typescript
// 【重新计分规则】记录初始力量（用于响应窗口关闭后对比）
const initialPowers = new Map<PlayerId, number>();
const currentBase = afterScoringCore.bases[baseIndex];
for (const m of currentBase.minions) {
    const prev = initialPowers.get(m.controller) ?? 0;
    initialPowers.set(m.controller, prev + getEffectivePower(afterScoringCore, m, baseIndex));
}
// 加上 ongoing 卡力量贡献
for (const playerId of Object.keys(afterScoringCore.players)) {
    const bonus = getOngoingCardPowerContribution(currentBase, playerId);
    if (bonus > 0) {
        const prev = initialPowers.get(playerId) ?? 0;
        initialPowers.set(playerId, prev + bonus);
    }
}

// 将初始力量存储到 matchState.sys
if (ms) {
    ms = {
        ...ms,
        sys: {
            ...ms.sys,
            afterScoringInitialPowers: {
                baseIndex,
                powers: Object.fromEntries(initialPowers.entries()),
            } as any,
        },
    };
}
```

**关键点**：
- 使用 `getEffectivePower` 获取随从的有效力量（含 ongoing 修正）
- 使用 `getOngoingCardPowerContribution` 获取 ongoing 卡的力量贡献（如 vampire_summon_wolves）
- 存储到 `matchState.sys.afterScoringInitialPowers`（不能存到响应窗口的 continuationContext，因为响应窗口不是交互）

#### 步骤 2：响应窗口关闭后对比并重新计分（在 `onPhaseExit` 中）

**位置**：`src/games/smashup/domain/index.ts` - `onPhaseExit` 函数

**时机**：`from === 'scoreBases'` 且 `state.sys.afterScoringInitialPowers` 存在

**实现**：
```typescript
// 【重新计分规则】检查是否刚关闭了 afterScoring 响应窗口
if (state.sys.afterScoringInitialPowers) {
    const { baseIndex: scoredBaseIndex, powers: initialPowers } = state.sys.afterScoringInitialPowers as any;
    
    // 计算当前力量
    const currentPowers = new Map<PlayerId, number>();
    const currentBase = core.bases[scoredBaseIndex];
    if (currentBase) {
        for (const m of currentBase.minions) {
            const prev = currentPowers.get(m.controller) ?? 0;
            currentPowers.set(m.controller, prev + getEffectivePower(core, m, scoredBaseIndex));
        }
        // 加上 ongoing 卡力量贡献
        for (const playerId of Object.keys(core.players)) {
            const bonus = getOngoingCardPowerContribution(currentBase, playerId);
            if (bonus > 0) {
                const prev = currentPowers.get(playerId) ?? 0;
                currentPowers.set(playerId, prev + bonus);
            }
        }
    }
    
    // 检查是否有力量变化
    let powerChanged = false;
    for (const [playerId, initialPower] of Object.entries(initialPowers)) {
        const currentPower = currentPowers.get(playerId) ?? 0;
        if (currentPower !== initialPower) {
            powerChanged = true;
            break;
        }
    }
    
    // 如果力量变化，重新计分该基地
    if (powerChanged && currentBase) {
        // 重新计算排名（与 scoreOneBase 中的逻辑相同）
        // ...
        
        // 发出新的 BASE_SCORED 事件（重新计分结果）
        const scoreEvt: BaseScoredEvent = {
            type: SU_EVENTS.BASE_SCORED,
            payload: { baseIndex: scoredBaseIndex, baseDefId: currentBase.defId, rankings, minionBreakdowns },
            timestamp: now,
        };
        events.push(scoreEvt);
    }
    
    // 清理状态
    state = {
        ...state,
        sys: {
            ...state.sys,
            afterScoringInitialPowers: undefined,
        },
    };
}
```

**关键点**：
- 对比每个玩家的初始力量和当前力量
- 只要有一个玩家的力量变化，就重新计分
- 重新计分时使用与 `scoreOneBase` 相同的排名计算逻辑
- 发出新的 `BASE_SCORED` 事件（ActionLog 会显示最新的计分结果）
- 清理 `afterScoringInitialPowers` 状态

## 实现细节

### 力量计算
- 随从力量：`getEffectivePower(core, minion, baseIndex)`
- Ongoing 卡力量：`getOngoingCardPowerContribution(base, playerId)`
- 总力量 = 随从力量之和 + Ongoing 卡力量

### 排名计算
- 规则：须有至少 1 个随从或至少 1 点力量才有资格参与计分
- 按力量降序排序
- Property 16: 平局玩家获得该名次最高 VP

### 事件发射
- 重新计分时发出新的 `BASE_SCORED` 事件
- ActionLog 会显示最新的计分结果（覆盖之前的计分结果）

## 测试计划

### 单元测试
1. **基本重新计分测试**：
   - 基地计分后，打出"我们乃最强"转移指示物
   - 验证力量变化后重新计分
   - 验证新的排名和 VP 分配

2. **无力量变化测试**：
   - 基地计分后，打出 afterScoring 卡但不影响该基地力量
   - 验证不重新计分（使用原计分结果）

3. **多玩家力量变化测试**：
   - 多个玩家的力量都变化
   - 验证重新计分后的排名正确

4. **边界条件测试**：
   - 力量变化导致排名变化（第一名变第二名）
   - 力量变化导致平局
   - 力量变化导致某玩家失去计分资格（力量降为 0 且无随从）

### E2E 测试
1. **"我们乃最强"完整流程测试**：
   - 基地达到临界点
   - 打开 beforeScoring 响应窗口（所有玩家 pass）
   - 基地计分（BASE_SCORED）
   - 打开 afterScoring 响应窗口
   - 玩家打出"我们乃最强"转移指示物
   - 响应窗口关闭
   - 重新计分（新的 BASE_SCORED）
   - BASE_CLEARED + BASE_REPLACED
   - 验证 ActionLog 显示最新的计分结果

2. **多基地计分 + afterScoring 测试**：
   - 两个基地同时达到临界点
   - 玩家选择先计分的基地
   - 第一个基地计分后打开 afterScoring 响应窗口
   - 玩家打出 afterScoring 卡
   - 重新计分
   - 继续计分第二个基地

## 待确认的规则细节

### 问题 1：afterScoring 卡牌是否可以影响其他基地？
**答案**：需要查阅官方规则书或 Wiki 确认

**影响**：
- 如果可以，其他基地是否也需要重新计分？
- 当前实现只重新计分当前基地

### 问题 2：重新计分时是否需要重新触发 beforeScoring 能力？
**答案**：应该不需要，beforeScoring 能力只在第一次计分前触发

**当前实现**：不重新触发 beforeScoring 能力

### 问题 3：重新计分时是否需要重新打开 afterScoring 响应窗口？
**答案**：应该不需要，afterScoring 响应窗口只打开一次

**当前实现**：不重新打开 afterScoring 响应窗口

## 下一步工作

1. ✅ 实现记录初始力量逻辑
2. ✅ 实现响应窗口关闭后对比并重新计分逻辑
3. ⏳ 创建单元测试
4. ⏳ 创建 E2E 测试
5. ⏳ 验证 ActionLog 显示正确
6. ⏳ 确认规则细节（查阅官方规则书或 Wiki）

## 总结

已完成 afterScoring 响应窗口的重新计分功能实现：

1. **记录初始力量**：在打开 afterScoring 响应窗口前，记录基地上每个玩家的力量（含随从力量 + ongoing 卡力量）
2. **对比并重新计分**：响应窗口关闭后，对比当前力量与初始力量，如果变化则重新计分该基地
3. **发出新事件**：重新计分后发出新的 BASE_SCORED 事件，ActionLog 显示最新的计分结果

下一步需要创建测试验证功能正确性，并确认规则细节。
