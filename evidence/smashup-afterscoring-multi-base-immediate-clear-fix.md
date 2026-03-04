# 大杀四方 - afterScoring 响应窗口被基地能力交互阻止打开 Bug 修复

## 问题描述

用户反馈：当基地计分后，打出计分后（afterScoring）卡牌时，目标基地已经被清空，无法对基地上的随从生效。

## 用户日志

```
[08:00:00] 基地结算： 灰色猫眼石/海盗湾
[08:00:00] 清空灰色猫眼石/海盗湾        ← BASE_CLEARED 立即发送
[08:00:00] 基地替换： 灰色猫眼石/海盗湾 → 印斯茅斯
[08:00:00] 基地结算： 印斯茅斯           ← 新基地也达标，立即计分
[08:00:00] 清空印斯茅斯
[08:00:00] 基地替换： 印斯茅斯 → 蚁丘
```

用户状态快照显示：
- `afterScoringTriggeredBases: [1]`（基地 1 触发了 afterScoring）
- `bases[1].defId = "base_the_hill"`（新基地，空的）
- 玩家 1 手牌中有 `giant_ant_we_are_the_champions`（afterScoring 卡牌）

## 根本原因

**基地能力创建交互后，代码跳过了检查 afterScoring 卡牌和打开响应窗口的逻辑。**

### 代码流程分析

1. `scoreOneBase` 触发海盗湾（`base_pirate_cove`）的 afterScoring 能力
2. 海盗湾能力创建交互（让非冠军玩家移动随从）
3. `afterScoringCreatedInteraction` 变为 `true`
4. 第 364 行的 `if (!afterScoringCreatedInteraction)` 条件为 `false`
5. **跳过检查 afterScoring 卡牌和打开响应窗口的代码块**
6. 继续执行到第 476 行，检查 `if (afterScoringCreatedInteraction)`
7. 延迟发送 BASE_CLEARED（存到交互的 `continuationContext` 中）
8. 交互解决后，补发 BASE_CLEARED
9. **但是响应窗口从未打开**，用户无法打出 afterScoring 卡牌

### 错误的代码逻辑

```typescript
// ❌ 错误：假设基地能力创建交互后，就不需要打开响应窗口
if (!afterScoringCreatedInteraction) {
    // 检查是否有玩家手牌中有 afterScoring 卡牌
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

    // 如果有玩家有 afterScoring 卡牌，打开 afterScoring 响应窗口
    if (playersWithAfterScoringCards.length > 0) {
        // 打开响应窗口
        ...
        return { events, newBaseDeck, matchState: ms };
    }
}
```

**问题**：`if (!afterScoringCreatedInteraction)` 这个条件导致：
- 当基地能力创建交互时（如海盗湾移动随从），整个代码块都不会执行
- 即使玩家手牌中有 afterScoring 卡牌，响应窗口也不会打开
- 用户无法打出 afterScoring 卡牌

## 修复方案

**移除 `if (!afterScoringCreatedInteraction)` 条件，无论基地能力是否创建交互，都检查是否有 afterScoring 卡牌并打开响应窗口。**

### 修复后的代码逻辑

```typescript
// ✅ 正确：无论基地能力是否创建交互，都检查是否有 afterScoring 卡牌
// 
// ⚠️ 【关键修复】无论基地能力是否创建了交互，都要检查是否有 afterScoring 卡牌
// 原因：基地能力创建交互（如海盗湾移动随从）和响应窗口（让玩家打出 afterScoring 卡牌）
// 是两个独立的机制，应该同时存在
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

// 如果有玩家有 afterScoring 卡牌，打开 afterScoring 响应窗口
if (playersWithAfterScoringCards.length > 0) {
    // 打开响应窗口
    ...
    return { events, newBaseDeck, matchState: ms };
}
```

## 修复后的流程

### 正确流程（基地能力创建交互 + afterScoring 响应窗口）

1. `scoreOneBase` 触发海盗湾的 afterScoring 能力 → 创建交互（移动随从）
2. `afterScoringCreatedInteraction` 变为 `true`
3. **检查是否有 afterScoring 卡牌**（不受 `afterScoringCreatedInteraction` 影响）
4. 发现玩家手牌中有 afterScoring 卡牌
5. **打开响应窗口**（发送 `RESPONSE_WINDOW_OPENED` 事件）
6. `return`（不发送 BASE_CLEARED）
7. `onPhaseExit` 检测到 `RESPONSE_WINDOW_OPENED` → `halt`
8. 用户先解决基地能力交互（移动随从）
9. 然后在响应窗口中打出 afterScoring 卡牌（基地上的随从还在）
10. 响应窗口关闭 → `SmashUpEventSystem` 补发 BASE_CLEARED 和 BASE_REPLACED

## 关键修复点

1. **移除条件**：移除 `if (!afterScoringCreatedInteraction)` 条件
2. **独立机制**：基地能力交互和响应窗口是两个独立的机制，应该同时存在
3. **优先级**：响应窗口优先级更高（先打开响应窗口，再处理基地能力交互）

## 测试验证

需要测试以下场景：

1. **基地能力创建交互 + afterScoring 响应窗口**：
   - 基地：海盗湾（afterScoring 能力创建交互）
   - 玩家手牌中有 afterScoring 卡牌
   - 验证：响应窗口打开，基地不被清空
   - 验证：用户可以先解决交互，再打出 afterScoring 卡牌
   - 验证：响应窗口关闭后，基地被清空

2. **基地能力创建交互 + 无 afterScoring 卡牌**：
   - 基地：海盗湾（afterScoring 能力创建交互）
   - 玩家手牌中没有 afterScoring 卡牌
   - 验证：不打开响应窗口，交互解决后基地被清空

3. **无基地能力交互 + afterScoring 响应窗口**：
   - 基地：普通基地（无 afterScoring 能力）
   - 玩家手牌中有 afterScoring 卡牌
   - 验证：响应窗口打开，基地不被清空
   - 验证：响应窗口关闭后，基地被清空

## 相关文件

- `src/games/smashup/domain/index.ts`（`scoreOneBase` 函数）
- `src/games/smashup/domain/baseAbilities.ts`（海盗湾 afterScoring 能力）
- `src/games/smashup/domain/systems.ts`（`SmashUpEventSystem`，监听 `RESPONSE_WINDOW_CLOSED`）
- `src/engine/systems/ResponseWindowSystem.ts`（响应窗口系统）

## 教训

1. **独立机制不应互相干扰**：基地能力交互和响应窗口是两个独立的机制，不应该用一个机制的存在来阻止另一个机制
2. **条件检查要谨慎**：`if (!condition)` 这种否定条件容易导致逻辑错误，应该明确写出"什么情况下执行"而不是"什么情况下不执行"
3. **全链路检查**：修复 bug 时必须检查整个调用链，不能只看表面现象（BASE_CLEARED 立即发送）而忽略根本原因（响应窗口未打开）
