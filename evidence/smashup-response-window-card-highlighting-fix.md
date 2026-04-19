# 大杀四方 - 响应窗口卡牌高亮修复

## 问题描述

用户反馈：当玩家手牌中同时有 beforeScoring 和 afterScoring 卡牌时，在 meFirst 窗口（计分前）期间，afterScoring 卡牌不应该被高亮为可打出状态。

**示例场景**：
- 玩家手牌：`giant_ant_under_pressure`（beforeScoring）+ `giant_ant_we_are_the_champions`（afterScoring）
- 当前窗口：meFirst（计分前）
- 预期行为：只有 `giant_ant_under_pressure` 应该可以打出（不置灰）
- 实际行为：两张卡都可以打出（都不置灰）

## 根本原因

`Board.tsx` 中的 `meFirstDisabledUids` 逻辑存在以下问题：

1. **只检查 meFirst 窗口**：`isMeFirstResponse` 只在 `windowType === 'meFirst'` 时为 `true`，导致 afterScoring 窗口期间 `meFirstDisabledUids` 为 `undefined`，所有卡牌都不会被禁用
2. **不检查 specialTiming**：对于 special 卡牌，只检查 `subtype === 'special'`，不检查 `specialTiming` 是否匹配当前窗口类型

**原始代码**：
```typescript
const isMeFirstResponse = useMemo(() => {
    if (!responseWindow || responseWindow.windowType !== 'meFirst') return false;
    const currentResponderId = responseWindow.responderQueue[responseWindow.currentResponderIndex];
    return playerID === currentResponderId;
}, [responseWindow, playerID]);

const meFirstDisabledUids = useMemo<Set<string> | undefined>(() => {
    if (!isMeFirstResponse || !myPlayer) return undefined;
    // ...
    const def = getCardDef(card.defId) as ActionCardDef | undefined;
    if (def?.subtype !== 'special') {
        disabled.add(card.uid);
    }
    // ❌ 没有检查 specialTiming 是否匹配窗口类型
}, [isMeFirstResponse, myPlayer, isHandDiscardPrompt]);
```

## 修复方案

### 1. 新增 `isAfterScoringResponse` 状态

```typescript
const isAfterScoringResponse = useMemo(() => {
    if (!responseWindow || responseWindow.windowType !== 'afterScoring') return false;
    const currentResponderId = responseWindow.responderQueue[responseWindow.currentResponderIndex];
    return playerID === currentResponderId;
}, [responseWindow, playerID]);
```

### 2. 扩展 `meFirstDisabledUids` 逻辑

```typescript
const meFirstDisabledUids = useMemo<Set<string> | undefined>(() => {
    // ✅ 支持两种窗口类型
    const isMyResponseTurn = isMeFirstResponse || isAfterScoringResponse;
    if (!isMyResponseTurn || !myPlayer) return undefined;
    if (isHandDiscardPrompt) return undefined;
    
    const disabled = new Set<string>();
    const windowType = responseWindow?.windowType;
    
    for (const card of myPlayer.hand) {
        if (card.type === 'minion') {
            // beforeScoringPlayable 随从只在 meFirst 窗口可用
            if (windowType === 'meFirst') {
                const mDef = getMinionDef(card.defId);
                if (!mDef?.beforeScoringPlayable) {
                    disabled.add(card.uid);
                }
            } else {
                // afterScoring 窗口禁用所有随从
                disabled.add(card.uid);
            }
            continue;
        }
        if (card.type !== 'action') {
            disabled.add(card.uid);
            continue;
        }
        const def = getCardDef(card.defId) as ActionCardDef | undefined;
        if (def?.subtype !== 'special') {
            disabled.add(card.uid);
            continue;
        }
        
        // ✅ Special 卡：检查 specialTiming 是否匹配窗口类型
        const cardTiming = def.specialTiming ?? 'beforeScoring';
        if (windowType === 'meFirst' && cardTiming !== 'beforeScoring') {
            // meFirst 窗口：禁用非 beforeScoring 卡
            disabled.add(card.uid);
        } else if (windowType === 'afterScoring' && cardTiming !== 'afterScoring') {
            // afterScoring 窗口：禁用非 afterScoring 卡
            disabled.add(card.uid);
        }
    }
    return disabled.size > 0 ? disabled : undefined;
}, [isMeFirstResponse, isAfterScoringResponse, myPlayer, isHandDiscardPrompt, responseWindow?.windowType]);
```

## 修复效果

### meFirst 窗口（计分前）
- ✅ beforeScoring 卡牌（如 `giant_ant_under_pressure`）：可打出（不置灰）
- ✅ afterScoring 卡牌（如 `giant_ant_we_are_the_champions`）：禁用（置灰）
- ✅ beforeScoringPlayable 随从（如 `ninja_infiltrator`）：可打出（不置灰）
- ✅ 普通随从：禁用（置灰）
- ✅ 普通行动卡：禁用（置灰）

### afterScoring 窗口（计分后）
- ✅ beforeScoring 卡牌：禁用（置灰）
- ✅ afterScoring 卡牌：可打出（不置灰）
- ✅ 所有随从：禁用（置灰）
- ✅ 普通行动卡：禁用（置灰）

## 相关文件

- `src/games/smashup/Board.tsx`：修复卡牌禁用逻辑
- `src/games/smashup/domain/commands.ts`：修复 PLAY_ACTION 和 PLAY_MINION 验证逻辑（`beforeScoring` → `meFirst`）
- `src/games/smashup/domain/reducer.ts`：修复 PLAY_MINION 事件处理逻辑（`beforeScoring` → `meFirst`）
- `src/games/smashup/ui/HandArea.tsx`：接收 `disabledCardUids` prop 并应用置灰效果
- `src/games/smashup/ui/MeFirstOverlay.tsx`：参考实现（窗口内卡牌过滤逻辑）

## 额外修复：全面统一窗口类型命名

在测试过程中发现，响应窗口期间打出 special 卡牌时验证失败，错误信息为"只能在出牌阶段打出行动卡"。

**根本原因**：代码中存在多处使用 `'beforeScoring'` 作为窗口类型的地方，但我们已经将窗口类型重命名为 `'meFirst'`，导致验证逻辑没有进入响应窗口分支。

**全面重构**：一次性修复所有使用 `windowType === 'beforeScoring'` 的地方，统一改为 `windowType === 'meFirst'`：

1. **`commands.ts` - PLAY_ACTION 验证**（第 173 行）：
   ```typescript
   // 修改前
   if (responseWindow && (responseWindow.windowType === 'beforeScoring' || responseWindow.windowType === 'afterScoring')) {
       // ...
       if (responseWindow.windowType === 'beforeScoring' && cardTiming !== 'beforeScoring') {
           return { valid: false, error: '该卡牌只能在计分后打出' };
       }
   }
   
   // 修改后
   if (responseWindow && (responseWindow.windowType === 'meFirst' || responseWindow.windowType === 'afterScoring')) {
       // ...
       if (responseWindow.windowType === 'meFirst' && cardTiming !== 'beforeScoring') {
           return { valid: false, error: '该卡牌只能在计分后打出' };
       }
   }
   ```

2. **`commands.ts` - PLAY_MINION 验证**（第 39 行）：
   ```typescript
   // 修改前
   if (minionResponseWindow && minionResponseWindow.windowType === 'beforeScoring') {
   
   // 修改后
   if (minionResponseWindow && minionResponseWindow.windowType === 'meFirst') {
   ```

3. **`reducer.ts` - PLAY_MINION 事件处理**（第 155 和 165 行）：
   ```typescript
   // 修改前
   ...(state.sys.responseWindow?.current?.windowType === 'beforeScoring' && minionDef?.beforeScoringPlayable
       ? { consumesNormalLimit: false }
       : {}),
   
   if (state.sys.responseWindow?.current?.windowType === 'beforeScoring' && minionDef?.beforeScoringPlayable) {
   
   // 修改后
   ...(state.sys.responseWindow?.current?.windowType === 'meFirst' && minionDef?.beforeScoringPlayable
       ? { consumesNormalLimit: false }
       : {}),
   
   if (state.sys.responseWindow?.current?.windowType === 'meFirst' && minionDef?.beforeScoringPlayable) {
   ```

**重要说明**：
- `'beforeScoring'` 作为 `SpecialTiming` 类型值（卡牌的 `specialTiming` 属性）保持不变
- `'beforeScoring'` 作为触发时机（`BaseTriggerTiming`）保持不变
- 只有作为**窗口类型**（`ResponseWindow.windowType`）时才改为 `'meFirst'`

这确保了整个代码库中窗口类型命名的一致性。

## 测试验证

**手动测试场景**：
1. 创建对局，两个玩家手牌中都有 beforeScoring 和 afterScoring 卡牌
2. 设置基地达到临界点，触发计分
3. 验证 meFirst 窗口期间：
   - beforeScoring 卡牌不置灰
   - afterScoring 卡牌置灰
4. 所有玩家 pass 后，验证 afterScoring 窗口期间：
   - beforeScoring 卡牌置灰
   - afterScoring 卡牌不置灰

**E2E 测试**（推荐）：
- 使用 Playwright 测试框架
- 验证卡牌的 `isDisabled` 状态和视觉效果（opacity、grayscale）
- 验证点击禁用卡牌时的摇头动画

## 架构一致性

此修复与 `MeFirstOverlay.tsx` 中的卡牌过滤逻辑保持一致：

```typescript
// MeFirstOverlay.tsx 中的过滤逻辑
const specialCards = myPlayer?.hand.filter(c => {
    if (c.type !== 'action') return false;
    const def = getCardDef(c.defId) as ActionCardDef | undefined;
    if (def?.subtype !== 'special') return false;
    
    const cardTiming = def.specialTiming ?? 'beforeScoring';
    if (responseWindow.windowType === 'meFirst') {
        return cardTiming === 'beforeScoring';
    } else if (responseWindow.windowType === 'afterScoring') {
        return cardTiming === 'afterScoring';
    }
    return false;
}) ?? [];
```

两处逻辑使用相同的判断标准：
- 检查 `specialTiming` 字段
- 默认值为 `'beforeScoring'`
- 根据窗口类型过滤卡牌

## 总结

修复完成，响应窗口期间的卡牌高亮和点击交互现在正确反映了卡牌的 `specialTiming` 属性。玩家在 meFirst 窗口只能看到并打出 beforeScoring 卡牌，在 afterScoring 窗口只能看到并打出 afterScoring 卡牌。

## 补充修复：afterScoring 窗口卡牌点击问题

**问题**：afterScoring 窗口期间，点击 afterScoring 卡牌无法打出，提示"无法打出响应，计分后"。

**根本原因**：`handleCardClick` 中只检查 `isMeFirstResponse`，不检查 `isAfterScoringResponse`，导致 afterScoring 窗口期间点击卡牌被当作正常出牌阶段处理，而不是响应窗口处理。

**修复**（`Board.tsx` 第 1108 行）：
```typescript
// 修改前
if (isMeFirstResponse) {
    // 只处理 meFirst 窗口
    console.log('[DEBUG] handleCardClick: in Me First! response mode', ...);
    // ...
}

// 修改后
const isInResponseWindow = isMeFirstResponse || isAfterScoringResponse;
if (isInResponseWindow) {
    const windowType = responseWindow?.windowType;
    console.log('[DEBUG] handleCardClick: in response window mode', {
        cardType: card.type,
        cardDefId: card.defId,
        windowType,
    });
    
    // beforeScoringPlayable 随从只在 meFirst 窗口可用
    if (card.type === 'minion') {
        if (windowType !== 'meFirst') {
            console.log('[DEBUG] handleCardClick: minion not allowed in afterScoring window, denied');
            playDeniedSound();
            return;
        }
        // meFirst 窗口的随从逻辑...
    }
    // special 卡牌逻辑（两种窗口都支持）...
}
```

**修复效果**：
- ✅ meFirst 窗口：可以打出 beforeScoring 卡牌和 beforeScoringPlayable 随从
- ✅ afterScoring 窗口：可以打出 afterScoring 卡牌，禁止打出随从
- ✅ 两种窗口都正确处理 special 卡牌的基地选择逻辑
