# SmashUp afterScoring 基地过早清空 Bug

## 问题描述

用户反馈：计分后都无法正常触发效果。

## 用户日志

```
[20:28:49] 游客6118: 行动卡施放： 我们乃最强
[20:28:44] 游客6118: 行动卡施放： 重返深海
[20:28:33] 管理员1: 随从登场： 影舞者  → 蚁丘
[20:28:28] 游客6118: 场上没有符合条件的目标
[20:28:27] 游客6118: 行动卡施放： 承受压力
[08:00:00] 管理员1: 基地结算： 蚁丘 管理员1 +4VP 游客6118 +2VP
```

## State 快照

```json
{
  "bases": [
    {"defId": "base_egg_chamber", "minions": [], "ongoingActions": []},
    {"defId": "base_innsmouth_base", "minions": [], "ongoingActions": []},
    {"defId": "base_plateau_of_leng", "minions": [], "ongoingActions": []}
  ],
  "beforeScoringTriggeredBases": [0],
  "afterScoringTriggeredBases": [0]
}
```

## 问题分析

### 症状

1. 用户打出了两张 afterScoring 卡牌：
   - "我们乃最强"（giant_ant_we_are_the_champions）
   - "重返深海"（innsmouth_return_to_the_sea）
2. 两张卡牌都显示"场上没有符合条件的目标"
3. State 显示所有基地上都没有随从（`"minions": []`）
4. 基地 0 已经从"蚁丘"（base_the_hill）被替换成了"卵室"（base_egg_chamber）

### 根本原因

**afterScoring 响应窗口打开时，BASE_CLEARED 和 BASE_REPLACED 事件已经被发出并 reduce 了，导致基地被清空，afterScoring 卡牌无法找到目标。**

### 正确的时序应该是

1. 基地计分（BASE_SCORED）
2. 触发 afterScoring 基地能力
3. 触发 ongoing afterScoring
4. **打开 afterScoring 响应窗口**
5. **玩家打出 afterScoring 卡牌**
6. **关闭响应窗口**
7. **清空基地（BASE_CLEARED）**
8. **替换基地（BASE_REPLACED）**

### 实际的时序（错误）

1. 基地计分（BASE_SCORED）
2. 触发 afterScoring 基地能力
3. 触发 ongoing afterScoring
4. **清空基地（BASE_CLEARED）** ← 过早发出
5. **替换基地（BASE_REPLACED）** ← 过早发出
6. 打开 afterScoring 响应窗口
7. 玩家打出 afterScoring 卡牌 → 没有目标

### 为什么 BASE_CLEARED 被过早发出？

根据 `scoreOneBase` 函数的逻辑（`src/games/smashup/domain/index.ts` line 300-350）：

```typescript
// 判断 afterScoring 是否新增了交互
const interactionAfter = ms?.sys?.interaction?.current?.id ?? null;
const queueLenAfter = ms?.sys?.interaction?.queue?.length ?? 0;
const afterScoringCreatedInteraction =
    (interactionAfter !== null && interactionAfter !== interactionBeforeAfterScoring) ||
    (queueLenAfter > queueLenBeforeAfterScoring);

// 关键：仅当 afterScoring 新增了交互时，才延迟发出 BASE_CLEARED/BASE_REPLACED
if (afterScoringCreatedInteraction) {
    // 延迟发出
    return { events, newBaseDeck, matchState: ms };
}

// 无 afterScoring 交互：正常发出清除+替换事件
events.push(...postScoringEvents);
return { events, newBaseDeck, matchState: ms };
```

**问题**：`afterScoringCreatedInteraction` 的判断逻辑只检查"是否创建了交互"，但**没有检查"是否打开了响应窗口"**。

**响应窗口不是交互！** 响应窗口是通过 `ResponseWindowSystem` 管理的，不会创建 `sys.interaction`。

所以，即使打开了 afterScoring 响应窗口，`afterScoringCreatedInteraction` 仍然是 `false`，导致 BASE_CLEARED 事件被立即发出。

## 解决方案

### 方案 1：检查响应窗口是否打开

在 `scoreOneBase` 函数中，除了检查"是否创建了交互"，还要检查"是否打开了响应窗口"。

```typescript
// 判断 afterScoring 是否新增了交互或打开了响应窗口
const responseWindowAfter = ms?.sys?.responseWindow?.current?.windowType ?? null;
const afterScoringCreatedInteractionOrWindow =
    (interactionAfter !== null && interactionAfter !== interactionBeforeAfterScoring) ||
    (queueLenAfter > queueLenBeforeAfterScoring) ||
    (responseWindowAfter === 'afterScoring');

if (afterScoringCreatedInteractionOrWindow) {
    // 延迟发出
    return { events, newBaseDeck, matchState: ms };
}
```

### 方案 2：在打开 afterScoring 响应窗口时设置标志

在 `openAfterScoringWindow` 函数中，设置一个标志表示"afterScoring 响应窗口已打开"，然后在 `scoreOneBase` 中检查这个标志。

### 方案 3：将 BASE_CLEARED 延迟到响应窗口关闭后发出

在 `onPhaseExit` 中，检查是否刚关闭了 afterScoring 响应窗口，如果是则补发 BASE_CLEARED 和 BASE_REPLACED 事件。

**这个方案已经实现了！** 但是为什么没有生效？

让我检查 `onPhaseExit` 中的逻辑：

```typescript
// 【重新计分规则】检查是否刚关闭了 afterScoring 响应窗口
if (state.sys.afterScoringInitialPowers) {
    // ...
    // ⚠️ 关键修复：无论力量是否变化，都需要发出 BASE_CLEARED 和 BASE_REPLACED 事件
    if (currentBase) {
        // 发出 BASE_CLEARED 事件
        const clearEvt: BaseClearedEvent = { ... };
        events.push(clearEvt);
        
        // 替换基地
        if (core.baseDeck.length > 0) {
            const newBaseDefId = core.baseDeck[0];
            const replaceEvt: BaseReplacedEvent = { ... };
            events.push(replaceEvt);
        }
    }
}
```

**这个逻辑是在响应窗口关闭后补发 BASE_CLEARED 事件的！**

**但是，问题是：`scoreOneBase` 函数在打开响应窗口时，没有检查响应窗口是否打开，所以 BASE_CLEARED 事件被立即发出了。**

## 推荐方案

**方案 1：在 `scoreOneBase` 中检查响应窗口是否打开**

这是最直接的解决方案。在 `scoreOneBase` 函数中，检查是否打开了 afterScoring 响应窗口，如果是则延迟发出 BASE_CLEARED 事件。

## 实现步骤

1. 修改 `scoreOneBase` 函数，在判断 `afterScoringCreatedInteraction` 时，同时检查是否打开了 afterScoring 响应窗口
2. 测试验证修复是否生效

## 相关文件

- `src/games/smashup/domain/index.ts`（`scoreOneBase` 函数）
- `src/games/smashup/domain/abilityHelpers.ts`（`openAfterScoringWindow` 函数）
