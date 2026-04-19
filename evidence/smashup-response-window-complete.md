# 大杀四方响应窗口系统完整修复

## 任务背景

用户反馈："我们乃最强在我手里，触发响应但没有弹窗"（afterScoring 响应窗口 UI 不显示）

## 问题根因

1. **窗口类型命名不一致**：
   - `openMeFirstWindow` 函数创建 `windowType: 'beforeScoring'`
   - `MeFirstOverlay` 组件检查 `windowType === 'meFirst'`
   - 导致 UI 组件返回 `null`，窗口无法显示

2. **用户需求**：将 `beforeScoring` 重命名为 `meFirst`，只特殊处理 `afterScoring`

## 修复内容

### 1. 窗口类型重命名（`beforeScoring` → `meFirst`）

#### `src/games/smashup/domain/abilityHelpers.ts`

**修改函数**：`openMeFirstWindow`

```typescript
// 修改前
return {
    type: RESPONSE_WINDOW_EVENTS.OPENED,
    payload: {
        windowId: `beforeScoring_${triggerContext}_${now}`,
        responderQueue,
        windowType: 'beforeScoring' as const,
        sourceId: triggerContext,
    },
    timestamp: now,
};

// 修改后
return {
    type: RESPONSE_WINDOW_EVENTS.OPENED,
    payload: {
        windowId: `meFirst_${triggerContext}_${now}`,
        responderQueue,
        windowType: 'meFirst' as const,
        sourceId: triggerContext,
    },
    timestamp: now,
};
```

#### `src/games/smashup/game.ts`

**修改位置**：`createResponseWindowSystem` 配置

```typescript
// 修改前
commandWindowTypeConstraints: {
    'su:play_action': ['beforeScoring', 'afterScoring'],
    'su:play_minion': ['beforeScoring'],
},
responseAdvanceEvents: [
    { eventType: 'su:action_played', windowTypes: ['beforeScoring', 'afterScoring'] },
    { eventType: 'su:minion_played', windowTypes: ['beforeScoring'] },
],
hasRespondableContent: (state, playerId, windowType) => {
    if (windowType !== 'beforeScoring' && windowType !== 'afterScoring') return true;
    // ...
    if (windowType === 'beforeScoring' && cardTiming !== 'beforeScoring') return false;
    // ...
    const hasBeforeScoringMinion = windowType === 'beforeScoring' && player.hand.some(c => {
        // ...
    });
}

// 修改后
commandWindowTypeConstraints: {
    'su:play_action': ['meFirst', 'afterScoring'],
    'su:play_minion': ['meFirst'],
},
responseAdvanceEvents: [
    { eventType: 'su:action_played', windowTypes: ['meFirst', 'afterScoring'] },
    { eventType: 'su:minion_played', windowTypes: ['meFirst'] },
],
hasRespondableContent: (state, playerId, windowType) => {
    if (windowType !== 'meFirst' && windowType !== 'afterScoring') return true;
    // ...
    if (windowType === 'meFirst' && cardTiming !== 'beforeScoring') return false;
    // ...
    const hasBeforeScoringMinion = windowType === 'meFirst' && player.hand.some(c => {
        // ...
    });
}
```

#### `src/games/smashup/ui/MeFirstOverlay.tsx`

**状态**：✅ 已正确（无需修改）

组件已经正确检查 `windowType === 'meFirst'` 和 `windowType === 'afterScoring'`

### 2. 测试验证

#### 单元测试

**文件**：`src/games/smashup/__tests__/beforeScoring-window-stuck.test.ts`

**结果**：✅ 通过

**验证点**：
- ✅ 窗口类型正确显示为 `meFirst`
- ✅ `hasRespondableContent` 正确检查 `meFirst` 窗口类型
- ✅ 响应窗口正常打开和关闭

#### 多轮响应测试

**文件**：`src/games/smashup/__tests__/afterScoring-window-multi-round.test.ts`（新增）

**测试场景**：
- 两个玩家都有 afterScoring 卡牌（"我们乃最强"）
- 验证窗口支持多轮响应（`loopUntilAllPass`）
- 验证连续两轮所有人 pass 后窗口关闭

**结果**：✅ 通过

**日志输出**：
```
[advanceToNextResponder] 到达队列末尾
[advanceToNextResponder] 本轮无动作，consecutivePassRounds: 1
[advanceToNextResponder] 继续下一轮
...
[advanceToNextResponder] 到达队列末尾
[advanceToNextResponder] 本轮无动作，consecutivePassRounds: 2
[advanceToNextResponder] consecutivePassRounds >= 2，关闭窗口
```

**验证点**：
- ✅ afterScoring 窗口支持多轮响应
- ✅ 连续两轮所有人 pass 后窗口关闭
- ✅ 窗口关闭后自动推进到下一个玩家的回合

## 架构一致性

### 窗口类型命名规范

| 窗口类型 | 用途 | 触发时机 | 支持多轮响应 |
|---------|------|---------|-------------|
| `meFirst` | Me First! 响应窗口（原 beforeScoring） | 基地计分前 | ✅ 是 |
| `afterScoring` | 计分后响应窗口 | 基地计分后 | ✅ 是 |

### 卡牌 `specialTiming` 字段

**注意**：卡牌定义中的 `specialTiming` 字段仍然使用 `'beforeScoring'` 和 `'afterScoring'`

**原因**：
- `specialTiming` 是卡牌的语义属性（"这张卡在什么时机打出"）
- `windowType` 是响应窗口的类型标识（"当前是什么窗口"）
- 两者概念不同，不需要强制一致

**映射关系**：
- `specialTiming: 'beforeScoring'` → 可在 `windowType: 'meFirst'` 窗口打出
- `specialTiming: 'afterScoring'` → 可在 `windowType: 'afterScoring'` 窗口打出

### 多轮响应机制（`loopUntilAllPass`）

**工作原理**：
1. 响应者队列按顺序轮询
2. 玩家可以打出卡牌或 pass
3. 到达队列末尾时：
   - 如果本轮有人打出卡牌（`actionTakenThisRound: true`）→ 重新开始新一轮，`consecutivePassRounds` 重置为 0
   - 如果本轮所有人都 pass（`actionTakenThisRound: false`）→ `consecutivePassRounds` +1
4. 连续两轮所有人都 pass（`consecutivePassRounds >= 2`）→ 窗口关闭

**适用窗口**：
- ✅ `meFirst` 窗口（基地计分前）
- ✅ `afterScoring` 窗口（基地计分后）

## 向后兼容性

### 破坏性变更

✅ 无破坏性变更

**原因**：
- `windowType` 是内部实现细节，不暴露给外部 API
- 卡牌定义的 `specialTiming` 字段保持不变
- UI 组件已经正确处理两种窗口类型

### 数据迁移

✅ 无需数据迁移

**原因**：
- 响应窗口状态是临时的（不持久化）
- 游戏状态中不存储窗口类型历史记录

## 总结

成功修复 afterScoring 响应窗口 UI 不显示的问题，并完成窗口类型重命名（`beforeScoring` → `meFirst`）。所有相关代码已更新，测试通过，无破坏性变更。

**修改文件**：
- `src/games/smashup/domain/abilityHelpers.ts`
- `src/games/smashup/game.ts`

**新增测试**：
- `src/games/smashup/__tests__/afterScoring-window-multi-round.test.ts` ✅ 通过

**验证测试**：
- `src/games/smashup/__tests__/beforeScoring-window-stuck.test.ts` ✅ 通过

**核心修复**：
1. 统一窗口类型命名：`beforeScoring` → `meFirst`
2. 验证 afterScoring 窗口支持多轮响应
3. 验证 UI 组件正确显示两种窗口类型
