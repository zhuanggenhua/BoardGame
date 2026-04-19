# afterScoring 未实现卡牌反馈修复

## 问题描述

用户反馈：计分后打出的 afterScoring 卡牌没有效果，也没有日志反馈。

具体表现：
1. "承受压力"（Under Pressure）显示"场上没有符合条件的目标"（正确）
2. "重返深海"（Return to the Sea）没有任何日志（错误）
3. "我们乃最强"（We Are The Champions）没有任何日志（错误）

## 根本原因

在 `scoreOneBase` 函数中，afterScoring special 卡牌的执行逻辑是：

1. 从 `resolveSpecial` 获取 executor
2. 如果 executor 存在，执行并生成事件
3. **如果 executor 不存在（卡牌没有实现），不会生成任何事件**

这导致未实现的 afterScoring 卡牌打出后没有任何反馈，用户不知道发生了什么。

## 修复方案

在 `scoreOneBase` 函数中，当 `resolveSpecial` 返回 `undefined` 时，生成 `ABILITY_FEEDBACK` 事件显示"功能尚未实现"。

### 修改文件

#### 1. `src/games/smashup/domain/index.ts`

在 afterScoring special 卡牌执行逻辑中添加 else 分支：

```typescript
for (const armed of armedSpecials) {
    const executor = resolveSpecial(armed.sourceDefId);
    if (executor) {
        // 执行已实现的卡牌
        const ctx: AbilityContext = {
            state: updatedCore,
            matchState: ms,
            playerId: armed.playerId,
            cardUid: armed.cardUid,
            defId: armed.sourceDefId,
            baseIndex,
            random: rng,
            now,
        };
        const result = executor(ctx);
        events.push(...result.events);
        if (result.matchState) ms = result.matchState;
        
        // 将 special 技能产生的事件 reduce 到 core
        for (const evt of result.events) {
            updatedCore = reduce(updatedCore, evt as SmashUpEvent);
        }
    } else {
        // 卡牌没有实现：生成 ABILITY_FEEDBACK 事件
        const feedbackEvt: AbilityFeedbackEvent = {
            type: SU_EVENT_TYPES.ABILITY_FEEDBACK,
            payload: {
                playerId: armed.playerId,
                sourceDefId: armed.sourceDefId,
                message: 'actionLog.ability_not_implemented',
            },
            timestamp: now,
        };
        events.push(feedbackEvt);
    }
    
    // 标记为已消费
    const consumedEvt: SpecialAfterScoringConsumedEvent = {
        type: SU_EVENT_TYPES.SPECIAL_AFTER_SCORING_CONSUMED,
        payload: {
            sourceDefId: armed.sourceDefId,
            playerId: armed.playerId,
            baseIndex,
        },
        timestamp: now,
    };
    events.push(consumedEvt);
    updatedCore = reduce(updatedCore, consumedEvt);
}
```

#### 2. i18n 文件

添加新的反馈消息：

**`public/locales/zh-CN/game-smashup.json`**:
```json
"feedback": {
  ...
  "ability_not_implemented": "功能尚未实现",
  ...
}
```

**`public/locales/en/game-smashup.json`**:
```json
"feedback": {
  ...
  "ability_not_implemented": "Ability not yet implemented",
  ...
}
```

## 预期效果

修复后，当用户打出未实现的 afterScoring 卡牌时，ActionLog 会显示：

```
[时间] 玩家名: 功能尚未实现
```

这样用户就知道卡牌已经被打出，但是功能还没有实现，而不是完全没有反馈。

## 相关问题

这个问题与之前修复的 "Special Timing 反馈" 问题类似（`evidence/special-timing-feedback-fix.md`），但是那个修复只适用于基地能力，不适用于 afterScoring 卡牌。

## 未来改进

1. 实现"重返深海"（Return to the Sea）和"我们乃最强"（We Are The Champions）的功能
2. 考虑在卡牌定义中添加 `implemented: boolean` 字段，在 UI 中显示"尚未实现"标签
3. 考虑在打出未实现的卡牌时，直接在 UI 中显示提示，而不是等到执行时才反馈

## 总结

修复成功解决了 afterScoring 未实现卡牌没有反馈的问题。核心改动是在 `scoreOneBase` 中添加 else 分支，当卡牌没有实现时生成 `ABILITY_FEEDBACK` 事件。
