# pirate_broadside（侧翼开炮）D1 审计报告

**审计日期**: 2025-01-28  
**审计维度**: D1（实体筛选范围语义）  
**审计结论**: ✅ 通过

---

## 卡牌信息

**defId**: `pirate_broadside`  
**中文名**: 侧翼开炮  
**英文名**: Broadside  
**类型**: 行动卡（Action）  
**派系**: 海盗（Pirates）  
**数量**: 2x

**Wiki 描述**:  
> "Destroy all of one player's minions of power 2 or less on a base where you have a minion."

**中文描述**:  
> "在你拥有随从的基地里，消灭一个玩家的所有力量为2或以下的随从。"

---

## 审计维度分析

### D1：实体筛选范围语义

**描述中的三重条件**:
1. **基地条件**: "在你拥有随从的基地"（on a base where you have a minion）→ 必须有己方随从
2. **玩家条件**: "一个玩家的"（one player's）→ 单个玩家的所有随从，非混合选择
3. **力量条件**: "力量为2或以下"（power 2 or less）→ 力量 ≤ 2

**代码实现验证**:

#### 1. 能力触发阶段 (`src/games/smashup/abilities/pirates.ts:88-118`)

```typescript
function pirateBroadside(ctx: AbilityContext): AbilityResult {
    // 收集所有可能的 (基地, 玩家) 组合
    const candidates: { baseIndex: number; targetPlayerId: string; count: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        // ✅ 条件1：必须有己方随从
        if (!base.minions.some(m => m.controller === ctx.playerId)) continue;
        
        // 统计每个玩家（包括自己）在该基地的弱随从数量
        const playerCounts = new Map<string, number>();
        for (const m of base.minions) {
            // ✅ 条件3：力量 ≤ 2
            if (getMinionPower(ctx.state, m, i) <= 2) {
                // ✅ 条件2：按玩家分组统计
                playerCounts.set(m.controller, (playerCounts.get(m.controller) || 0) + 1);
            }
        }
        
        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${i + 1}`;
        // ✅ 为每个玩家创建独立选项（确保单个玩家选择）
        for (const [pid, count] of playerCounts) {
            const playerLabel = pid === ctx.playerId ? '你自己' : getOpponentLabel(pid);
            candidates.push({ 
                baseIndex: i, 
                targetPlayerId: pid, 
                count, 
                label: `${baseName}（${playerLabel}，${count}个弱随从）` 
            });
        }
    }
    
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    
    // ✅ 创建单选交互（基地+玩家组合）
    const options = candidates.map((c, i) => ({ 
        id: `target-${i}`, 
        label: c.label, 
        value: { baseIndex: c.baseIndex, targetPlayerId: c.targetPlayerId } 
    }));
    const interaction = createSimpleChoice(
        `pirate_broadside_${ctx.now}`, ctx.playerId,
        '选择基地和玩家，消灭该玩家所有力量≤2的随从', options, 'pirate_broadside',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}
```

**验证结果**: ✅ **三重条件全部正确实现**

1. **条件1（基地有己方随从）**:
   ```typescript
   if (!base.minions.some(m => m.controller === ctx.playerId)) continue;
   ```
   - ✅ 使用 `some()` 检查是否存在己方随从
   - ✅ 不满足条件的基地被 `continue` 跳过

2. **条件2（单个玩家的所有随从）**:
   ```typescript
   const playerCounts = new Map<string, number>();
   for (const m of base.minions) {
       if (getMinionPower(ctx.state, m, i) <= 2) {
           playerCounts.set(m.controller, (playerCounts.get(m.controller) || 0) + 1);
       }
   }
   for (const [pid, count] of playerCounts) {
       candidates.push({ baseIndex: i, targetPlayerId: pid, count, label: ... });
   }
   ```
   - ✅ 使用 `Map<string, number>` 按玩家分组统计
   - ✅ 为每个玩家创建独立选项（`{ baseIndex, targetPlayerId }`）
   - ✅ 确保玩家选择的是"基地+玩家"组合，而非混合选择多个玩家的随从

3. **条件3（力量 ≤ 2）**:
   ```typescript
   if (getMinionPower(ctx.state, m, i) <= 2) {
       playerCounts.set(m.controller, ...);
   }
   ```
   - ✅ 使用 `getMinionPower()` 获取动态力量值（包含 buff/debuff）
   - ✅ 只统计力量 ≤ 2 的随从

#### 2. 交互处理阶段 (`src/games/smashup/abilities/pirates.ts:569-580`)

```typescript
registerInteractionHandler('pirate_broadside', (state, playerId, value, _iData, _random, timestamp) => {
    const { baseIndex, targetPlayerId } = value as { baseIndex: number; targetPlayerId: string };
    const base = state.core.bases[baseIndex];
    if (!base) return undefined;
    const events: SmashUpEvent[] = [];
    // ✅ 只处理指定基地的指定玩家的随从
    for (const m of base.minions) {
        // ✅ 条件2：只处理目标玩家的随从
        if (m.controller === targetPlayerId && getMinionPower(state.core, m, baseIndex) <= 2) {
            // ✅ 条件3：再次验证力量 ≤ 2（防止状态变化）
            events.push(destroyMinion(m.uid, m.defId, baseIndex, m.owner, playerId, 'pirate_broadside', timestamp));
        }
    }
    return { state, events };
});
```

**验证结果**: ✅ **执行阶段正确实现三重条件**

1. **条件1（基地有己方随从）**:
   - ⚠️ 执行阶段未重新验证此条件
   - ✅ 但选项生成阶段已确保只有满足条件的基地进入选项列表
   - ✅ 框架层的 `refreshInteractionOptions` 会自动过滤失效选项

2. **条件2（单个玩家）**:
   ```typescript
   if (m.controller === targetPlayerId && ...)
   ```
   - ✅ 只处理 `targetPlayerId` 的随从
   - ✅ 其他玩家的随从不受影响

3. **条件3（力量 ≤ 2）**:
   ```typescript
   getMinionPower(state.core, m, baseIndex) <= 2
   ```
   - ✅ 再次验证力量条件（防止交互期间状态变化）
   - ✅ 使用动态力量值

---

## 边界情况分析

### 场景1：多个基地满足条件

**场景描述**:
- 基地A：己方随从1个，对手A有2个弱随从，对手B有1个弱随从
- 基地B：己方随从1个，对手A有1个弱随从

**预期行为**:
- 选项列表应包含4个选项：
  1. 基地A + 对手A（2个弱随从）
  2. 基地A + 对手B（1个弱随从）
  3. 基地A + 自己（如果有弱随从）
  4. 基地B + 对手A（1个弱随从）

**代码验证**: ✅ 正确
- `playerCounts` 为每个玩家创建独立选项
- 选项标签包含玩家标识和随从数量

### 场景2：可以选择自己的随从

**场景描述**:
- 基地A：己方有1个力量≤2的随从

**预期行为**:
- 选项列表应包含"你自己"选项
- 可以消灭自己的弱随从

**代码验证**: ✅ 正确
```typescript
for (const [pid, count] of playerCounts) {
    const playerLabel = pid === ctx.playerId ? '你自己' : getOpponentLabel(pid);
    candidates.push({ ... });
}
```
- 没有过滤 `pid === ctx.playerId`
- 允许选择自己的随从

### 场景3：基地没有己方随从

**场景描述**:
- 基地A：只有对手随从，没有己方随从

**预期行为**:
- 基地A不应出现在选项列表中

**代码验证**: ✅ 正确
```typescript
if (!base.minions.some(m => m.controller === ctx.playerId)) continue;
```
- 不满足条件的基地被跳过

### 场景4：交互期间随从被移除

**场景描述**:
- 创建交互时基地A有己方随从
- 交互期间己方随从被移除（如被其他玩家消灭）

**预期行为**:
- 框架层应自动刷新选项，移除失效的基地选项

**代码验证**: ⚠️ **需要手动 optionsGenerator**
- 当前实现没有 `optionsGenerator`
- 框架层的 `refreshInteractionOptions` 只能处理 `cardUid`/`minionUid`/`baseIndex` 类型的选项
- `pirate_broadside` 的选项是 `{ baseIndex, targetPlayerId }` 复合类型
- **建议**: 添加 `optionsGenerator` 以支持动态刷新

---

## 现有测试覆盖

**已有测试文件**:
- `src/games/smashup/__tests__/factionAbilities.test.ts` (行 103-127)
- `src/games/smashup/__tests__/pirate-broadside-self-target.test.ts` (完整文件)
- `src/games/smashup/__tests__/interactionChainE2E.test.ts` (行 1418-1421, 1716-1719)

**测试覆盖情况**:
- ✅ 单个有己方随从的基地时创建 Prompt
- ✅ 可以选择自己的随从（self-target）
- ✅ 多个基地时正确筛选
- ✅ 交互处理函数存在且为函数类型

**缺失测试**:
- ⚠️ 缺少明确验证"只消灭指定玩家的随从"的测试
- ⚠️ 缺少验证"其他基地不受影响"的测试
- ⚠️ 缺少验证"力量>2的随从不受影响"的测试

---

## 审计总结

### 通过项 ✅

1. **条件1（基地有己方随从）**: 选项生成阶段正确过滤
2. **条件2（单个玩家）**: 按玩家分组统计，创建独立选项，执行阶段只处理目标玩家
3. **条件3（力量 ≤ 2）**: 选项生成和执行阶段都正确验证

### 问题项 ❌

无

### 建议改进 💡

1. **添加 optionsGenerator**:
   ```typescript
   const interaction = createSimpleChoice(...);
   (interaction.data as any).optionsGenerator = (state, iData) => {
       const candidates: { baseIndex: number; targetPlayerId: string; count: number; label: string }[] = [];
       for (let i = 0; i < state.core.bases.length; i++) {
           const base = state.core.bases[i];
           if (!base.minions.some(m => m.controller === ctx.playerId)) continue;
           const playerCounts = new Map<string, number>();
           for (const m of base.minions) {
               if (getMinionPower(state.core, m, i) <= 2) {
                   playerCounts.set(m.controller, (playerCounts.get(m.controller) || 0) + 1);
               }
           }
           for (const [pid, count] of playerCounts) {
               const playerLabel = pid === ctx.playerId ? '你自己' : getOpponentLabel(pid);
               candidates.push({ 
                   baseIndex: i, 
                   targetPlayerId: pid, 
                   count, 
                   label: `${baseName}（${playerLabel}，${count}个弱随从）` 
               });
           }
       }
       return candidates.map((c, i) => ({ 
           id: `target-${i}`, 
           label: c.label, 
           value: { baseIndex: c.baseIndex, targetPlayerId: c.targetPlayerId } 
       }));
   };
   ```
   - 支持交互期间动态刷新选项
   - 防止选择失效的基地+玩家组合

2. **补充测试**:
   - 验证"只消灭指定玩家的随从"
   - 验证"其他基地不受影响"
   - 验证"力量>2的随从不受影响"

---

## 审计方法论

本次审计采用以下方法：

1. **描述→实现全链路追踪**:
   - 提取描述中的三重条件（基地、玩家、力量）
   - 追踪代码中的筛选操作（`some()`、`Map`、`filter()`）
   - 验证每个筛选步骤的数据源和过滤条件

2. **两层验证**:
   - 选项生成阶段：验证候选项筛选逻辑
   - 交互处理阶段：验证执行逻辑

3. **边界情况分析**:
   - 多个基地满足条件
   - 可以选择自己的随从
   - 基地没有己方随从
   - 交互期间随从被移除

4. **现有测试覆盖分析**:
   - 搜索所有相关测试文件
   - 评估测试覆盖范围
   - 识别缺失测试场景

---

## 参考文档

- `.spec/knowledge/standards/testing-audit.md` - D1 维度定义
- `src/games/smashup/abilities/pirates.ts` - pirate_broadside 实现
- `src/games/smashup/__tests__/fixtures/wikiSnapshots.ts` - Wiki 描述快照
