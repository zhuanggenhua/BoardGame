# 无法计分 Bug - beforeScoringTriggeredBases 标记残留

## 用户反馈

> 无法计分了

## 问题根源

**`beforeScoringTriggeredBases` 标记没有被清理，导致基地无法再次计分**。

### 状态分析

从状态快照看：

```json
"beforeScoringTriggeredBases":[2]
```

托尔图加基地（baseIndex 2）的总力量 = 29 > breakpoint(21)，应该触发计分，但 `beforeScoringTriggeredBases` 已包含基地 2，导致 `scoreOneBase` 跳过了 beforeScoring 触发。

### 为什么标记没有被清理？

**清理逻辑只在 `onPhaseExit('scoreBases')` 中执行**：

```typescript
// src/games/smashup/domain/index.ts:845-856
if (from === 'scoreBases') {
    // ...
    // 清空 beforeScoring 和 afterScoring 触发标记（计分阶段结束）
    events.push({
        type: SU_EVENT_TYPES.BEFORE_SCORING_CLEARED,
        payload: {},
        timestamp: now,
    });
    events.push({
        type: SU_EVENT_TYPES.AFTER_SCORING_CLEARED,
        payload: {},
        timestamp: now,
    });
    // ...
}
```

**问题**：如果用户在计分阶段中途退出（刷新页面、断线重连、浏览器崩溃），`onPhaseExit` 可能没有被执行，导致标记残留。

### 触发场景

1. 用户在 Me First! 窗口中打出 special 卡
2. 浏览器崩溃/刷新页面/断线
3. 重新连接后，`beforeScoringTriggeredBases` 仍然包含基地索引
4. 下一轮计分时，基地达到 breakpoint，但 `scoreOneBase` 检查发现标记已存在，跳过计分
5. 用户无法计分，游戏卡住

## 修复方案

**在 `onPhaseEnter('scoreBases')` 时清理标记**（方案 2）

### 实现

```typescript
// src/games/smashup/domain/index.ts:920-933
if (to === 'scoreBases') {
    // 清理上一轮的触发标记（防止异常退出导致标记残留）
    events.push({
        type: SU_EVENT_TYPES.BEFORE_SCORING_CLEARED,
        payload: {},
        timestamp: now,
    } as GameEvent);
    events.push({
        type: SU_EVENT_TYPES.AFTER_SCORING_CLEARED,
        payload: {},
        timestamp: now,
    } as GameEvent);

    // 检查是否有基地达到临界点...
    // ...
}
```

### 优点

1. **最简单**：改动最小，只需在 `onPhaseEnter` 中添加清理逻辑
2. **确保每次进入 scoreBases 阶段时都是干净的状态**：无论上一轮是否正常完成
3. **不依赖 onPhaseExit 的清理事件是否被正确执行**：即使用户中途退出，下一轮也能正常计分
4. **符合"每个计分阶段独立"的语义**：每次进入计分阶段都是全新的开始

### 为什么不用方案 1（确保清理事件被正确 reduce）

方案 1 依赖 `onPhaseExit` 被正常执行，但无法防止异常退出（刷新页面、断线、崩溃）导致的标记残留。

### 为什么不用方案 3（使用基地 defId 而不是索引）

方案 3 改动较大，需要修改类型定义和所有相关代码。而且仍然无法防止异常退出导致的标记残留。

## 测试验证

### 手动测试

1. 创建一个基地达到 breakpoint 的场景
2. 在 Me First! 窗口中刷新页面
3. 重新连接后，基地应该能正常计分

### 自动化测试

```typescript
it('异常退出后标记被清理，基地能正常计分', () => {
    const core = makeState({
        bases: [makeBase('base_tortuga', [makeMinion('m1', '0', 21)])],
        beforeScoringTriggeredBases: [0], // 模拟残留标记
    });
    const ms = makeScoreBasesMS(core);
    
    // 进入 scoreBases 阶段应该清理标记
    const enterEvents = callOnPhaseEnter(ms, 'playCards', 'scoreBases');
    expect(enterEvents.some(e => e.type === SU_EVENTS.BEFORE_SCORING_CLEARED)).toBe(true);
    
    // 应用清理事件后，标记应该被清空
    const updatedCore = enterEvents.reduce((c, e) => reduce(c, e), core);
    expect(updatedCore.beforeScoringTriggeredBases).toBeUndefined();
    
    // 基地应该能正常计分
    callOnPhaseExitScoreBases(ms);
    expect(hasBaseScored(ms, 0)).toBe(true);
});
```

## 教训

**清理逻辑必须在进入阶段时执行，而不是退出阶段时执行**。

原因：
1. 退出阶段时的清理依赖正常流程完成，无法防止异常退出
2. 进入阶段时的清理确保每次都是干净的状态，无论上一轮是否正常完成
3. 这是一个通用原则，适用于所有需要清理的状态

## 相关问题

这个问题与之前的 "Special Timing 没有效果" bug 是同一个根因：`beforeScoringTriggeredBases` 标记没有被正确清理。

区别：
- 之前的 bug：用户能打出 special 卡，但没有效果（前置条件不满足）
- 这次的 bug：用户无法计分（标记残留导致 `scoreOneBase` 跳过）

两个问题都通过在 `onPhaseEnter('scoreBases')` 时清理标记来修复。
