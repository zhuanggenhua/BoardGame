# Bug 分析：海盗湾重复触发问题

## 用户报告
- **问题**：猫眼石（海盗湾）一直触发，并每次移动都加分
- **关键信息**：
  1. 日志中没有显示移动事件
  2. 每个随从都触发了移动
  3. 海盗王移动过来后才出现该 bug

## 问题推测

### 可能性1：海盗湾 afterScoring 被重复触发
- **正常流程**：海盗湾计分后，为每位非冠军玩家创建一个交互，每人只能移动一个随从
- **异常情况**：如果 afterScoring 被重复触发，会为同一个玩家创建多个交互
- **触发条件**：海盗王移动到海盗湾后，可能导致某种循环

### 可能性2：移动触发了重新计分
- **场景**：
  1. 海盗湾达到临界点（17），触发计分
  2. 海盗王 beforeScoring 移动到海盗湾
  3. 海盗湾计分，afterScoring 创建移动交互
  4. 玩家移动随从后，可能触发了某个机制导致海盗湾重新计分
  5. 重新计分又触发 afterScoring，创建新的移动交互
  6. 循环往复

### 可能性3：牧场基地的连锁反应
- **牧场规则**：每回合玩家第一次移动随从到牧场后，可以再移动另一个随从到牧场
- **场景**：
  1. 海盗湾 afterScoring 让玩家移动随从到牧场
  2. 牧场的 onMinionMoved 触发，让玩家再移动一个随从到牧场
  3. 如果牧场也达到临界点，触发计分
  4. 可能形成连锁反应

## 代码审查

### 海盗湾 afterScoring
```typescript
registerBaseAbility('base_pirate_cove', 'afterScoring', (ctx) => {
    // 为每位非冠军玩家创建交互
    for (const [pid, minions] of playerMinions) {
        const interaction = createSimpleChoice(
            `base_pirate_cove_${pid}_${ctx.now}`,  // ← 使用 timestamp 确保唯一性
            pid,
            '海盗湾：选择移动一个随从到其他基地',
            options,
            { sourceId: 'base_pirate_cove', targetType: 'minion' },
        );
        ctx.matchState = queueInteraction(ctx.matchState, interaction);
    }
});
```

### 交互处理器
```typescript
registerInteractionHandler('base_pirate_cove', (state, playerId, value, iData, _random, timestamp) => {
    if (selected.skip) return { state, events: [] };
    
    // 单基地直接移动
    if (baseCandidates.length <= 1) {
        return { state, events: [moveMinion(...)] };
    }
    
    // 多基地→链式选择
    return { state: queueInteraction(state, interaction), events: [] };
});
```

## 关键问题

### 1. 日志缺失
- `MINION_MOVED` 事件的日志格式化代码存在，但用户报告日志中没有显示移动
- 可能原因：
  - 事件没有被正确发射
  - 日志系统过滤了某些事件
  - 前端日志显示有问题

### 2. 重复触发检查
需要检查以下几点：
- `afterScoring` 是否有防重复触发机制？
- 移动随从后是否会触发重新计分？
- 是否有其他基地能力会在移动后触发计分？

### 3. 海盗王的影响
- 海盗王 beforeScoring 移动到海盗湾
- 移动后海盗湾的力量增加
- 是否会触发某种重新评估机制？

## 复现步骤

1. 设置场景：
   - 基地1：海盗湾（临界点17）
   - 基地2：其他基地
   - 海盗王在基地2
   - 海盗湾上有其他随从，总力量接近17

2. 触发计分：
   - 海盗王 beforeScoring 移动到海盗湾
   - 海盗湾达到临界点，触发计分
   - afterScoring 创建移动交互

3. 观察：
   - 是否创建了多个交互？
   - 移动后是否触发了重新计分？
   - 日志中是否显示移动事件？

## 下一步

1. 创建单元测试复现问题
2. 检查 afterScoring 的触发机制
3. 验证移动事件的日志输出
4. 检查是否有循环触发的可能
