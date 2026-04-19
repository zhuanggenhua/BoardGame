# Special Timing "没有效果" Bug 分析

## 用户反馈

> 重返深海和承受压力没触发效果
> 
> 用户补充："选择了随从但立刻结算了"

## 问题根源（已确认）

**这不是 bug，而是前置条件不满足**。

### 承受压力的前置条件

承受压力的效果是"从计分基地上的随从转移力量指示物到**其他基地**上的随从"。

从代码看（`src/games/smashup/abilities/giant_ants.ts:827-835`）：

```typescript
// 目标必须是非计分基地上的己方随从
const targets = collectOwnMinions(state.core, playerId).filter(m => 
    m.uid !== selected.minionUid && m.baseIndex !== scoringBaseIndex
);
if (targets.length === 0) {
    return { 
        state, 
        events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)]
    };
}
```

### 用户场景分析

从状态快照看：

```json
"bases": [
    {"defId": "base_temple_of_goju", "minions": []},
    {"defId": "base_ninja_dojo", "minions": []},
    {"defId": "base_tortuga", "minions": [{"uid": "c10", "defId": "pirate_first_mate", ...}]}
]
```

- 计分基地是"伦格高原"（baseIndex 1，已替换为"忍者道场"）
- 用户选择了计分基地上的工蚁（c42）作为来源
- 但此时**其他基地上没有己方随从**（只有对手的大副在 base_tortuga）
- 所以 `targets.length === 0`，返回了 `feedback.no_valid_targets`
- 交互立即结束，没有后续的选择目标和选择数量步骤

### 为什么用户看到"选择了随从但立刻结算了"

1. 用户打出承受压力
2. 第一个交互弹出：选择计分基地上要转出力量指示物的随从
3. 用户选择了工蚁（c42）
4. 代码检查发现其他基地上没有己方随从，返回 `feedback.no_valid_targets`
5. 交互链中断，没有后续的"选择目标随从"和"选择转移数量"步骤
6. 用户看到的是"选了随从后就结束了"

### 重返深海的情况

重返深海是 `afterScoring` 技能，应该生成 `SPECIAL_AFTER_SCORING_ARMED` 事件，延迟到基地计分后执行。但从 Action Log 看：

```
[11:14:08] 游客6118: 行动卡施放： 重返深海
```

没有看到后续的"随从返回手牌"效果。可能的原因：
1. 计分基地上没有同名随从（重返深海要求同名随从）
2. 或者 `afterScoring` 触发时机有问题（需要进一步验证）

## 核心问题

**承受压力的前置条件不满足**：需要其他基地上有己方随从才能转移力量指示物。

**ActionLog 没有记录"没有效果"的原因**：当交互处理器返回 `feedback.no_valid_targets` 时，ActionLog 应该显示"场上没有符合条件的目标"，但实际上没有显示。

## 修复方案

### 方案 1：改进 ActionLog 反馈（推荐）

当交互处理器返回 `feedback.no_valid_targets` 时，生成 `ABILITY_FEEDBACK` 事件，ActionLog 显示"场上没有符合条件的目标"。

**优点**：
- 不改变游戏规则
- 用户能清楚地知道为什么没有效果
- 适用于所有类似场景（前置条件不满足）

**实现**：
1. 在 `handleUnderPressureChooseSource` 中，当 `targets.length === 0` 时，返回 `ABILITY_FEEDBACK` 事件
2. ActionLog 监听 `ABILITY_FEEDBACK` 事件，显示友好的提示信息

### 方案 2：放宽承受压力的限制（不推荐）

允许在计分基地上的随从之间转移力量指示物。

**缺点**：
- 改变游戏规则（原版规则要求转移到其他基地）
- 可能破坏平衡性

## 重返深海的情况

重返深海是 `afterScoring` 技能，应该生成 `SPECIAL_AFTER_SCORING_ARMED` 事件，延迟到基地计分后执行。

从 reducer.ts 代码看（第 260-275 行）：

```typescript
if (specialTiming === 'afterScoring') {
    // afterScoring：生成 ARMED 事件，延迟到基地计分后执行
    const armedEvt: SpecialAfterScoringArmedEvent = {
        type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
        payload: {
            sourceDefId: card.defId,
            playerId: command.playerId,
            baseIndex: command.payload.targetBaseIndex ?? 0,
            cardUid: card.uid,
        },
        timestamp: now,
    };
    events.push(armedEvt);
}
```

逻辑看起来正确。需要进一步验证：
1. `SPECIAL_AFTER_SCORING_ARMED` 事件是否被正确 reduce
2. `scoreOneBase` 中是否正确触发 ARMED 的 special 效果
3. 重返深海的交互是否正确创建（需要计分基地上有同名随从）

## 教训

**不要假设"没有效果"就是 bug**。必须先确认：
1. 前置条件是否满足（如承受压力需要其他基地上有己方随从）
2. 如果前置条件不满足，是否有合理的反馈（ActionLog 应该显示原因）

**核心问题是 ActionLog 没有记录"没有效果"的原因**，导致用户误以为是 bug。

## 下一步

1. 实现方案 1：改进 ActionLog 反馈
2. 验证重返深海的 `afterScoring` 触发逻辑
3. 添加测试：验证前置条件不满足时的反馈
