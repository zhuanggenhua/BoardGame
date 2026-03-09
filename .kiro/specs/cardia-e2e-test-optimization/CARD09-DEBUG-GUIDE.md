# Card09 伏击者 - 手动调试指南

## 问题描述

伏击者能力：选择一个派系，对手弃掉所有该派系的手牌

**测试失败**：P2 的 Academy 派系手牌没有被弃掉
- 期望手牌数：3 张
- 实际手牌数：4 张
- Academy 派系手牌应该被弃掉，但没有

## 调试步骤

### 1. 注入测试状态

使用调试面板的 "Inject State" 功能，粘贴 `CARD09-INJECT-STATE.json` 的内容。

**初始状态**：
- P1 手牌：伏击者（影响力 9）
- P2 手牌：4 张
  - 傀儡师（影响力 10，Academy 派系）
  - 审判官（影响力 8，Dynasty 派系）
  - 女导师（影响力 14，Academy 派系）
  - 雇佣剑士（影响力 1，Swamp 派系）

### 2. 执行游戏流程

1. **P1 打出伏击者**（影响力 9）
2. **P2 打出傀儡师**（影响力 10）
3. **P1 失败**（9 < 10），进入 ability 阶段
4. **激活伏击者能力**
5. **选择 Academy 派系**
6. **确认选择**

### 3. 预期结果

**能力执行后**：
- P2 的 Academy 派系手牌应该被弃掉：
  - 女导师（Academy）→ 弃牌堆
- P2 剩余手牌：2 张
  - 审判官（Dynasty）
  - 雇佣剑士（Swamp）
- P2 弃牌堆：1 张（女导师）

**回合结束后**：
- P2 抽 1 张牌
- P2 最终手牌：3 张

### 4. 检查点

#### 检查点 1：能力激活
- ✅ 派系选择弹窗是否显示？
- ✅ 是否可以选择 Academy 派系？
- ✅ 确认后弹窗是否关闭？

#### 检查点 2：事件发射
打开浏览器控制台，查看是否有以下日志：
- `[Ambusher]` 相关日志（如果有调试日志）
- `CARDS_DISCARDED` 事件
- 弃牌的 cardIds

#### 检查点 3：状态更新
使用调试面板的 "Read State" 功能，检查：
```javascript
// P2 的手牌
core.players['1'].hand
// 应该只有 2 张：审判官 + 雇佣剑士

// P2 的弃牌堆
core.players['1'].discard
// 应该有 1 张：女导师
```

### 5. 可能的问题

#### 问题 1：交互处理器没有被调用
**症状**：弹窗关闭后，手牌没有变化
**原因**：`abilityId` 字段缺失，或者交互处理器注册有问题
**验证**：查看浏览器控制台，是否有 `[CardiaEventSystem]` 相关日志

#### 问题 2：事件被发射但没有被 reduce
**症状**：控制台有 `CARDS_DISCARDED` 事件，但手牌没有变化
**原因**：`reduceCardsDiscarded` 函数有 bug，或者事件没有被正确应用
**验证**：在 `src/games/cardia/domain/reduce.ts` 中添加调试日志

#### 问题 3：框架层 bug（与 Card15 相同）
**症状**：交互处理器返回的 `state` 不会被应用
**原因**：框架层已知 bug
**解决方案**：交互处理器应该返回 `events` 而不是修改 `state`

### 6. 调试日志位置

如果需要添加调试日志，可以在以下位置添加：

1. **能力执行器**：`src/games/cardia/domain/abilities/group7-faction.ts`
   ```typescript
   abilityExecutorRegistry.register(ABILITY_IDS.AMBUSHER, (ctx) => {
       console.log('[Ambusher] 能力执行器被调用');
       // ...
   });
   ```

2. **交互处理器**：`src/games/cardia/domain/abilities/group7-faction.ts`
   ```typescript
   registerInteractionHandler(ABILITY_IDS.AMBUSHER, (state, playerId, value, ...) => {
       console.log('[Ambusher] 交互处理器被调用:', { playerId, value });
       // ...
   });
   ```

3. **Reducer**：`src/games/cardia/domain/reduce.ts`
   ```typescript
   function reduceCardsDiscarded(core, payload) {
       console.log('[Reducer] CARDS_DISCARDED:', payload);
       // ...
   }
   ```

## 预期修复

如果问题与 Card15 相同（框架层 bug），则需要：
1. 确认交互处理器返回的 `events` 包含 `CARDS_DISCARDED`
2. 确认 `reduceCardsDiscarded` 被调用
3. 如果 reducer 被调用但状态没有更新，则是 reducer 的 bug

## 相关文档

- `CARD15-BUG-FIX-COMPLETE.md` - Card15 的修复说明（类似问题）
- `INTERACTION-HANDLER-BUG.md` - 交互处理器框架层 bug 说明
- `ABILITYID-FIX-COMPLETE.md` - abilityId 字段修复说明
