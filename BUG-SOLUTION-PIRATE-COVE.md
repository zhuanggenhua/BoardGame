# Bug 解决方案：海盗湾计分问题

## 问题总结

用户报告："猫眼石（海盗湾）一直触发，并每次移动都加分"

关键信息：
1. 日志中没有显示移动事件
2. 每个随从都触发了移动
3. 海盗王移动过来后才出现该 bug

## 根因分析

经过代码审查和测试，发现：

### 1. 海盗湾实现是正确的
- ✅ afterScoring 只触发一次
- ✅ 只为非冠军玩家创建交互
- ✅ 每个玩家只能移动一个随从

### 2. 日志缺失问题
- `MINION_MOVED` 事件的日志格式化代码存在
- 但用户报告日志中没有显示移动
- **可能原因**：
  - 前端日志显示组件有过滤逻辑
  - 或者事件没有被正确传递到日志系统

### 3. "每次移动都加分"的可能原因

#### 可能性A：多个非冠军玩家
- 海盗湾规则：**每位**非冠军玩家可以移动一个随从
- 如果有多个非冠军玩家，会创建多个交互
- 用户可能误以为是"重复触发"

#### 可能性B：牧场基地的连锁反应
- 如果场上有牧场基地（base_the_pasture）
- 牧场规则：每回合玩家第一次移动随从到牧场后，可以再移动另一个随从到牧场
- 场景：
  1. 海盗湾 afterScoring 让玩家移动随从到牧场
  2. 牧场的 onMinionMoved 触发，让玩家再移动一个随从到牧场
  3. 如果牧场也达到临界点，触发计分
  4. 形成连锁反应

#### 可能性C：UI 状态同步问题
- 前端可能没有正确处理交互队列
- 导致用户看到多个交互弹窗
- 或者交互响应后状态没有正确更新

## 解决方案

### 1. 修复日志显示（优先级：高）

检查前端日志组件是否正确显示 `MINION_MOVED` 事件：

```typescript
// src/games/smashup/ui/ActionLogDisplay.tsx 或类似文件
// 确保 MINION_MOVED 事件没有被过滤
```

### 2. 添加防重复触发机制（优先级：中）

虽然代码逻辑正确，但可以添加额外的防护：

```typescript
// src/games/smashup/domain/baseAbilities.ts
registerBaseAbility('base_pirate_cove', 'afterScoring', (ctx) => {
    // 添加防重复触发检查
    const alreadyTriggered = (ctx.state as any)._pirateCoveTriggered?.[ctx.baseIndex];
    if (alreadyTriggered) {
        console.warn('[base_pirate_cove] afterScoring already triggered for this base');
        return { events: [] };
    }
    
    // ... 原有逻辑 ...
    
    // 标记已触发（在 matchState 中，不影响 core）
    if (ctx.matchState) {
        (ctx.matchState as any)._pirateCoveTriggered = {
            ...(ctx.matchState as any)._pirateCoveTriggered,
            [ctx.baseIndex]: true,
        };
    }
});
```

### 3. 改进交互 UI 提示（优先级：中）

在交互标题中明确说明：

```typescript
const interaction = createSimpleChoice(
    `base_pirate_cove_${pid}_${ctx.now}`, 
    pid,
    `海盗湾：选择移动一个随从到其他基地（${pid === '0' ? '玩家1' : '玩家2'}）`,  // 明确玩家身份
    options,
    { sourceId: 'base_pirate_cove', targetType: 'minion' },
);
```

### 4. 添加调试日志（优先级：低）

在关键位置添加日志，帮助排查问题：

```typescript
registerBaseAbility('base_pirate_cove', 'afterScoring', (ctx) => {
    console.log('[base_pirate_cove] afterScoring triggered:', {
        baseIndex: ctx.baseIndex,
        winnerId: ctx.rankings[0].playerId,
        nonWinnerPlayers: Array.from(playerMinions.keys()),
    });
    
    // ... 原有逻辑 ...
});
```

## 测试验证

已创建单元测试验证：
- ✅ afterScoring 只触发一次
- ✅ 只为非冠军玩家创建交互
- ✅ 冠军不会收到移动交互

## 下一步

1. **立即**：检查前端日志显示，确认 `MINION_MOVED` 事件是否正确显示
2. **短期**：添加防重复触发机制和改进 UI 提示
3. **长期**：创建 E2E 测试，模拟完整的计分流程，包括多个非冠军玩家的场景

## 用户反馈建议

如果用户再次遇到此问题，请收集以下信息：
1. 完整的游戏状态快照（包括所有基地和随从）
2. 前端控制台日志（特别是 `[base_pirate_cove]` 相关的日志）
3. 是否有牧场基地在场
4. 有多少个非冠军玩家在海盗湾有随从
