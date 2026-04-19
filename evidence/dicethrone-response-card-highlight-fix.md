# DiceThrone 响应窗口卡牌高亮修复 + 防御阶段结束视角切换修复

## 问题 1：响应窗口卡牌高亮

### 问题描述

用户反馈：DiceThrone 响应时没有高亮可以打出的牌。

### 根因分析

#### 1. 响应窗口自动切换视角

当本地玩家是响应者时，视角会自动切换到对手（`src/games/dicethrone/ui/viewMode.ts:56-58`）：

```typescript
// 当前响应者是自己 → 切换到对手视角（看对手的骰子/状态来决定如何响应）
isResponseAutoSwitch = currentResponderId === rootPlayerId;
```

这个设计的目的是让玩家看到对手的骰子/状态来决定如何响应。

#### 2. 高亮逻辑依赖视角

原始代码（`src/games/dicethrone/Board.tsx:571-573`）：

```typescript
// 如果当前视角是响应者，高亮响应者的可响应卡牌
if (currentResponderId && viewPid === currentResponderId) {
    const responder = G.players[currentResponderId];
    // ...
}
```

问题：
- `viewPid` 是当前视角的玩家 ID
- 当自己响应时，`viewPid` 已经切换到对手了（`viewPid = otherPid`）
- 所以条件 `viewPid === currentResponderId` 不满足
- 导致卡牌不会高亮

#### 3. 调用链分析

```
响应窗口打开
  ↓
computeViewModeState 检测到 currentResponderId === rootPlayerId
  ↓
isResponseAutoSwitch = true
  ↓
viewMode 切换到 'opponent'
  ↓
viewPid = otherPid
  ↓
respondableCardIds 计算时 viewPid !== currentResponderId
  ↓
返回 undefined，卡牌不高亮
```

### 修复方案

修改高亮逻辑，使用 `rootPid`（本地玩家 ID）而不是 `viewPid`（当前视角玩家 ID）：

```typescript
// 如果本地玩家是响应者，高亮本地玩家的可响应卡牌（无论当前视角是谁）
// 修复：使用 rootPid 而不是 viewPid，因为响应时视角会自动切换到对手
if (currentResponderId && rootPid === currentResponderId) {
    const responder = G.players[currentResponderId];
    if (!responder) return undefined;
    
    const cardIds = new Set<string>();
    for (const card of responder.hand) {
        if (isCardPlayableInResponseWindow(G, currentResponderId, card, responseWindow.windowType, currentPhase)) {
            cardIds.add(card.id);
        }
    }
    return cardIds.size > 0 ? cardIds : undefined;
}
```

#### 修复后的行为

1. 响应窗口打开，视角自动切换到对手（保持原有设计）
2. 高亮逻辑检查 `rootPid === currentResponderId`（本地玩家是否是响应者）
3. 如果是，计算本地玩家手牌中可响应的卡牌并高亮
4. 即使视角在对手，本地玩家的手牌仍然正确高亮

---

## 问题 2：防御阶段结束后没有自动切换回自己视角

### 问题描述

用户反馈：防御阶段结束后，视角没有自动切换回自己。

### 根因分析

#### 1. 当前的视角切换逻辑

原始代码（`src/games/dicethrone/Board.tsx:922-931`）：

```typescript
React.useEffect(() => {
    if (currentPhase === 'defensiveRoll') {
        // 防御掷骰时如果自己是掷骰者，强制切回自己视角
        if (rollerId && rollerId === rootPid) {
            setViewMode('self');
        }
        return;
    }
    if (currentPhase === 'offensiveRoll' && isActivePlayer) setViewMode('self');
}, [currentPhase, isActivePlayer, rollerId, rootPid, setViewMode]);
```

问题：
- 只处理了 `defensiveRoll` 和 `offensiveRoll` 阶段
- 没有处理防御阶段结束后的 `main2`、`discard` 等阶段
- 如果之前因为 `shouldAutoObserve` 切换到了对手视角，就会一直停留在对手视角

#### 2. 视角切换时机

```
进攻阶段（offensiveRoll）
  ↓ 自己是进攻者 → 切换到自己视角
防御阶段（defensiveRoll）
  ↓ 对手是防御者 → shouldAutoObserve = true → 切换到对手视角
  ↓ 防御结束
main2 阶段
  ↓ ❌ 没有自动切换逻辑 → 停留在对手视角
```

### 修复方案

在阶段切换 effect 中添加 `main2` 和 `discard` 阶段的处理：

```typescript
React.useEffect(() => {
    if (currentPhase === 'defensiveRoll') {
        // 防御掷骰时如果自己是掷骰者，强制切回自己视角
        // 若不是掷骰者，交给 shouldAutoObserve 临时切换，不改变手动视角
        if (rollerId && rollerId === rootPid) {
            setViewMode('self');
        }
        return;
    }
    if (currentPhase === 'offensiveRoll' && isActivePlayer) {
        setViewMode('self');
        return;
    }
    // 防御阶段结束后（进入 main2/discard 等阶段），如果是自己的回合，切换回自己视角
    // 修复：防御阶段结束后没有自动切换回自己视角的问题
    if (isActivePlayer && (currentPhase === 'main2' || currentPhase === 'discard')) {
        setViewMode('self');
    }
}, [currentPhase, isActivePlayer, rollerId, rootPid, setViewMode]);
```

#### 修复后的行为

```
进攻阶段（offensiveRoll）
  ↓ 自己是进攻者 → 切换到自己视角
防御阶段（defensiveRoll）
  ↓ 对手是防御者 → shouldAutoObserve = true → 切换到对手视角
  ↓ 防御结束
main2 阶段
  ↓ ✅ 自己是活跃玩家 → 切换回自己视角
```

---

## 修改文件

- `src/games/dicethrone/Board.tsx`：
  1. 修改 `respondableCardIds` 计算逻辑（使用 `rootPid` 而不是 `viewPid`）
  2. 修改阶段切换 effect（添加 `main2` 和 `discard` 阶段的视角切换）

## 测试建议

### 测试 1：响应窗口卡牌高亮

1. 进入 DiceThrone 对局
2. 触发响应窗口（如对手确认骰面后）
3. 确认：
   - 视角自动切换到对手（看到对手的骰子/状态）
   - 自己的手牌中可响应的卡牌有青色高亮（`ring-4 ring-cyan-400`）
   - 不可响应的卡牌没有高亮
   - 可以正常打出高亮的卡牌

### 测试 2：防御阶段结束视角切换

1. 进入 DiceThrone 对局，自己是活跃玩家
2. 进攻阶段（offensiveRoll）→ 确认视角在自己
3. 防御阶段（defensiveRoll）→ 对手防御 → 视角自动切换到对手
4. 防御结束，进入 main2 阶段 → 确认视角自动切换回自己
5. 进入 discard 阶段 → 确认视角仍然在自己

## 相关代码

- `src/games/dicethrone/ui/viewMode.ts`：视角切换逻辑
- `src/games/dicethrone/ui/HandArea.tsx:769`：卡牌高亮样式
- `src/games/dicethrone/domain/rules.ts:794`：`isCardPlayableInResponseWindow` 函数

## 教训

1. **UI 高亮逻辑应该基于"谁的手牌"而不是"当前视角"**
   - 视角切换是为了观察，不应该影响交互逻辑
   - `rootPid`（本地玩家）vs `viewPid`（当前视角玩家）的区别很重要

2. **阶段切换时必须考虑所有相关阶段**
   - 不能只处理掷骰阶段，还要处理掷骰后的阶段
   - 自动视角切换必须有"切换回来"的逻辑，否则会卡在对手视角
