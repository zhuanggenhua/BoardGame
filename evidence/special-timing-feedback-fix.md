# Special Timing "没有效果" Bug - 反馈改进方案

## 问题总结

用户反馈"承受压力和重返深海没触发效果"，实际根因是：

1. **承受压力**：前置条件不满足（需要其他基地上有己方随从才能转移力量指示物）
2. **ActionLog 没有记录"没有效果"的原因**：当交互处理器返回 `feedback.no_valid_targets` 时，ActionLog 应该显示"场上没有符合条件的目标"，但实际上没有显示

## 核心问题

**不是 bug，而是反馈不足**。用户不知道为什么没有效果，误以为是 bug。

## 修复方案

### 改进 ActionLog 反馈（推荐）

当交互处理器返回 `feedback.no_valid_targets` 时，生成 `ABILITY_FEEDBACK` 事件，ActionLog 显示"场上没有符合条件的目标"。

**实现步骤**：

1. **在交互处理器中返回 ABILITY_FEEDBACK 事件**

```typescript
// src/games/smashup/abilities/giant_ants.ts:827-835
const handleUnderPressureChooseSource: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as { scoringBaseIndex?: number } | undefined;
    const scoringBaseIndex = context?.scoringBaseIndex;
    if (scoringBaseIndex === undefined) return undefined;

    const selected = value as { minionUid?: string; baseIndex?: number; defId?: string };
    if (!selected.minionUid || selected.baseIndex === undefined) return undefined;

    const source = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
    if (!source || source.controller !== playerId || source.powerCounters <= 0) return undefined;

    // 目标必须是非计分基地上的己方随从
    const targets = collectOwnMinions(state.core, playerId).filter(m => 
        m.uid !== selected.minionUid && m.baseIndex !== scoringBaseIndex
    );
    if (targets.length === 0) {
        // ✅ 改进：返回 ABILITY_FEEDBACK 事件，而不是 buildAbilityFeedback
        return { 
            state, 
            events: [{
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: {
                    playerId,
                    message: '场上没有其他基地上的己方随从可以接收力量指示物',
                    abilityDefId: 'giant_ant_under_pressure',
                },
                timestamp,
            }]
        };
    }

    // ... 后续逻辑
};
```

2. **ActionLog 监听 ABILITY_FEEDBACK 事件**

```typescript
// src/games/smashup/ui/ActionLog.tsx
case SU_EVENTS.ABILITY_FEEDBACK: {
    const { playerId, message, abilityDefId } = evt.payload;
    const player = G.players[playerId];
    const abilityName = getAbilityName(abilityDefId);
    return {
        time: formatTime(evt.timestamp),
        player: player?.name ?? `玩家${playerId}`,
        action: `${abilityName}：${message}`,
        type: 'feedback',
    };
}
```

3. **添加 i18n 支持**

```json
// public/locales/zh-CN/game-smashup.json
{
  "feedback": {
    "no_valid_targets_other_bases": "场上没有其他基地上的己方随从可以接收力量指示物",
    "no_same_name_minions": "计分基地上没有同名随从可以返回手牌"
  }
}
```

## 重返深海的情况

重返深海是 `afterScoring` 技能，需要验证：
1. `SPECIAL_AFTER_SCORING_ARMED` 事件是否被正确 reduce
2. `scoreOneBase` 中是否正确触发 ARMED 的 special 效果
3. 重返深海的交互是否正确创建（需要计分基地上有同名随从）

如果计分基地上没有同名随从，也应该返回 `ABILITY_FEEDBACK` 事件。

## 教训

**不要假设"没有效果"就是 bug**。必须先确认：
1. 前置条件是否满足
2. 如果前置条件不满足，是否有合理的反馈

**核心问题是 ActionLog 没有记录"没有效果"的原因**，导致用户误以为是 bug。

## 下一步

1. 实现 ActionLog 反馈改进
2. 验证重返深海的 `afterScoring` 触发逻辑
3. 添加测试：验证前置条件不满足时的反馈
