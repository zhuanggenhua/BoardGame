# SmashUp afterScoring 响应窗口未打开问题

## 问题描述

用户反馈："打出计分后响应窗口出来的时候，已经没有目标基地了"

## 用户日志分析

### Action Log
```
[08:00:00] 基地结算： 灰色猫眼石/海盗湾 管理员1 +3VP 游客6118 +1VP
[08:00:00] 清空灰色猫眼石/海盗湾
[08:00:00] 基地替换： 灰色猫眼石/海盗湾 → 印斯茅斯
[08:00:00] 基地结算： 印斯茅斯
[08:00:00] 清空印斯茅斯
[08:00:00] 基地替换： 印斯茅斯 → 蚁丘
```

### 状态快照
```json
{
  "bases": [
    {"defId": "base_egg_chamber", "minions": []},
    {"defId": "base_the_hill", "minions": []},  // ← 新基地，已经空了
    {"defId": "base_ninja_dojo", "minions": [...]}
  ],
  "afterScoringTriggeredBases": [1],
  "players": {
    "1": {
      "hand": [
        {"defId": "giant_ant_we_are_the_champions"}  // ← afterScoring 卡牌！
      ]
    }
  }
}
```

## 问题分析

### 预期流程

1. 基地 1（灰色猫眼石/海盗湾）计分
2. 检查玩家手牌中是否有 afterScoring 卡牌 → **有**（玩家 1 的"我们乃最强"）
3. **打开 afterScoring 响应窗口**
4. **延迟发出 BASE_CLEARED 和 BASE_REPLACED**
5. 玩家打出 afterScoring 卡牌或跳过
6. 响应窗口关闭
7. 发出 BASE_CLEARED 和 BASE_REPLACED

### 实际情况

1. 基地 1（灰色猫眼石/海盗湾）计分
2. **立即发出 BASE_CLEARED 和 BASE_REPLACED**（基地被清空和替换）
3. 基地 1（印斯茅斯）又立即计分
4. **立即发出 BASE_CLEARED 和 BASE_REPLACED**（基地再次被清空和替换）
5. 现在基地 1 是"蚁丘"（新基地），已经空了
6. 响应窗口打开（？）
7. 玩家打出 afterScoring 卡牌时，目标基地已经不存在了

## 可能的原因

### 原因 1：检查 afterScoring 卡牌的逻辑有问题

代码中检查 afterScoring 卡牌的逻辑：

```typescript
const playersWithAfterScoringCards: PlayerId[] = [];
for (const [playerId, player] of Object.entries(afterScoringCore.players)) {
    const hasAfterScoringCard = player.hand.some(c => {
        if (c.type !== 'action') return false;
        const def = getCardDef(c.defId) as ActionCardDef | undefined;
        return def?.subtype === 'special' && def.specialTiming === 'afterScoring';
    });
    if (hasAfterScoringCard) {
        playersWithAfterScoringCards.push(playerId);
    }
}
```

可能的问题：
- `getCardDef` 返回 `undefined`？
- `def.subtype` 不是 `'special'`？
- `def.specialTiming` 不是 `'afterScoring'`？

但是从卡牌定义来看，"我们乃最强"的定义是正确的：
```typescript
{
    id: 'giant_ant_we_are_the_champions',
    type: 'action',
    subtype: 'special',
    specialTiming: 'afterScoring',
    // ...
}
```

### 原因 2：多基地计分时的时序问题

从日志来看，有两个基地同时计分：
1. 基地 1（灰色猫眼石/海盗湾）
2. 基地 1（印斯茅斯）- 新替换的基地

可能的情况：
- 第一个基地计分时，没有检查 afterScoring 卡牌（为什么？）
- 第二个基地计分时，才检查 afterScoring 卡牌并打开响应窗口
- 但是这时基地已经被替换了两次，目标基地已经不存在了

### 原因 3：响应窗口打开后立即被关闭

可能的情况：
- 响应窗口打开了
- 但是由于某种原因（如 `hasRespondableContent` 返回 `false`），响应窗口立即被关闭
- BASE_CLEARED 和 BASE_REPLACED 事件被发出

## 排查建议

### 1. 添加日志

在 `scoreOneBase` 函数中添加日志，记录：
- 是否检查了 afterScoring 卡牌
- 检查结果（哪些玩家有 afterScoring 卡牌）
- 是否打开了响应窗口
- 是否延迟发出 BASE_CLEARED

```typescript
console.log('[scoreOneBase] 检查 afterScoring 卡牌:', {
    baseIndex,
    baseDefId: base.defId,
    playersWithAfterScoringCards,
    willOpenWindow: playersWithAfterScoringCards.length > 0,
});
```

### 2. 检查 `hasRespondableContent`

检查 `ResponseWindowSystem` 的 `hasRespondableContent` 函数，确认它能正确识别 afterScoring 卡牌：

```typescript
hasRespondableContent: (state, playerId, windowType) => {
    if (windowType !== 'afterScoring') return true;
    const core = state as SmashUpCore;
    const player = core.players[playerId];
    if (!player) return false;
    
    // 检查 afterScoring 卡牌
    const hasAfterScoringCard = player.hand.some(c => {
        if (c.type !== 'action') return false;
        const def = getCardDef(c.defId) as ActionCardDef | undefined;
        return def?.subtype === 'special' && def.specialTiming === 'afterScoring';
    });
    
    console.log('[hasRespondableContent] afterScoring 检查:', {
        playerId,
        windowType,
        hasAfterScoringCard,
        handSize: player.hand.length,
    });
    
    return hasAfterScoringCard;
},
```

### 3. 检查多基地计分逻辑

检查 `onPhaseExit` 中的多基地计分逻辑，确认：
- 第一个基地计分时是否正确检查了 afterScoring 卡牌
- 响应窗口打开后是否正确 halt
- 响应窗口关闭后是否正确恢复计分

## 临时解决方案

在修复根本原因之前，可以使用以下临时方案：

### 方案 1：在响应窗口中记录目标基地 defId

修改 `openAfterScoringWindow` 函数，将目标基地的 defId 存储到响应窗口的 `sourceId` 字段中：

```typescript
const afterScoringWindowEvt = openAfterScoringWindow(
    'scoreBases',
    pid,
    afterScoringCore.turnOrder,
    now,
    base.defId  // ← 传递基地 defId
);
```

然后在 afterScoring 卡牌的执行逻辑中，使用 `sourceId` 来查找目标基地：

```typescript
const targetBaseDefId = responseWindow.sourceId;
const targetBaseIndex = state.bases.findIndex(b => b.defId === targetBaseDefId);
if (targetBaseIndex === -1) {
    // 基地已被替换，返回错误
    return { events: [/* ABILITY_FEEDBACK */] };
}
```

### 方案 2：在基地替换时保留随从快照

在 `scoreOneBase` 函数中，将基地上的随从快照存储到 `matchState.sys`：

```typescript
if (ms) {
    ms = {
        ...ms,
        sys: {
            ...ms.sys,
            afterScoringMinionSnapshots: {
                baseIndex,
                minions: currentBase.minions.map(m => ({ ...m })),
            } as any,
        },
    };
}
```

然后在 afterScoring 卡牌的执行逻辑中，使用快照而不是当前基地状态。

## 总结

问题的根本原因尚不明确，需要添加日志来排查。可能的原因包括：
1. 检查 afterScoring 卡牌的逻辑有问题
2. 多基地计分时的时序问题
3. 响应窗口打开后立即被关闭

建议先添加日志，确认响应窗口是否正确打开，然后再决定修复方案。
