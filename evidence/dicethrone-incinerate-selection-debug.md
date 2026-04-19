# DiceThrone 焚灭技能无法选择 - 排查过程

## 问题描述

用户反馈：DiceThrone 游戏中无法选择"焚灭"(Incinerate)技能。

## 技能信息

"焚灭"是火法（Pyromancer）的 Hot Streak II 技能的变体：
- **技能 ID**：`incinerate`
- **触发条件**：2火 + 2炽魂（diceSet）
- **优先级**：2（高于 fiery-combo-2 的优先级 1）
- **效果**：
  - 获得 2 FM
  - 施加 1 层燃烧
  - 造成 6 点伤害

## 可能的原因

### 1. 自动跳过逻辑（最可能）

Board.tsx 中有三个自动跳过响应窗口的逻辑：

#### a. 用户开启"自动跳过"模式（第 448 行）
```typescript
React.useEffect(() => {
    // 灰色"自动跳过" = 立即跳过，不显示响应窗口 UI
    // 绿色"手动响应" = 显示响应窗口，等待手动选择
    if (autoResponseEnabled || !isResponseWindowOpen || !currentResponderId || currentResponderId !== rootPid) return;
    // 立即发送 RESPONSE_PASS，不延迟（0ms）
    engineMoves.responsePass(currentResponderId);
}, [autoResponseEnabled, isResponseWindowOpen, currentResponderId, rootPid, engineMoves]);
```

**问题**：如果用户不小心开启了"自动跳过"模式（灰色按钮），响应窗口一打开就会立即跳过，用户根本没有机会选择技能。

#### b. 响应者离线时自动跳过（第 563 行）
```typescript
React.useEffect(() => {
    if (isResponderOffline && isActivePlayer && currentResponderId && currentResponderId !== rootPid) {
        console.warn('[Board] offline auto-pass triggered', { isResponderOffline, isActivePlayer, currentResponderId, rootPid });
        const timer = setTimeout(() => {
            engineMoves.responsePass(currentResponderId);
        }, 100);
        return () => clearTimeout(timer);
    }
}, [isResponderOffline, isActivePlayer, currentResponderId, rootPid, engineMoves]);
```

**问题**：如果系统误判用户离线，会自动跳过响应窗口。

#### c. 教学模式下对手自动跳过（第 575 行）
```typescript
React.useEffect(() => {
    if (gameMode?.mode !== 'tutorial') return;
    if (!isResponseWindowOpen || !currentResponderId || currentResponderId === rootPid) return;
    console.warn('[Board] tutorial auto-pass triggered', { gameMode: gameMode?.mode, currentResponderId, rootPid });
    const timer = setTimeout(() => {
        engineMoves.responsePass(currentResponderId);
    }, 100);
    return () => clearTimeout(timer);
}, [gameMode?.mode, isResponseWindowOpen, currentResponderId, rootPid, engineMoves]);
```

**问题**：如果游戏模式判断错误，可能会误触发自动跳过。

### 2. 视角切换问题（已排除）

之前怀疑是响应窗口自动切换视角导致无法选择，但这个功能是用户要求的，不是 bug。

### 3. 技能定义问题（已排除）

检查了 `src/games/dicethrone/heroes/pyromancer/abilities.ts`，技能定义正确：
- `id: 'incinerate'` ✅
- `trigger: { type: 'diceSet', faces: { ... } }` ✅
- `priority: 2` ✅
- `effects: [...]` ✅

## 排查步骤

### 第一步：确认用户的响应模式

需要确认用户是否开启了"自动跳过"模式（灰色按钮）。如果是，需要切换到"手动响应"模式（绿色按钮）。

### 第二步：添加日志定位问题

在 Board.tsx 的三个自动跳过逻辑中添加日志，确认是哪个逻辑触发了自动跳过。

### 第三步：检查响应窗口是否正常打开

确认响应窗口是否正常打开，以及是否显示了"焚灭"技能选项。

## 下一步

添加日志来定位问题根源。


## 已添加调试日志

在 Board.tsx 的三个自动跳过逻辑中添加了醒目的日志（🔴 标记）：

### 1. 用户自动跳过模式（第 448 行）
```typescript
console.warn('[Board] 🔴 AUTO-SKIP TRIGGERED (User Mode)', {
    autoResponseEnabled,
    isResponseWindowOpen,
    currentResponderId,
    rootPid,
    reason: '用户开启了自动跳过模式（灰色按钮）'
});
```

### 2. 响应者离线自动跳过（第 563 行）
```typescript
console.warn('[Board] 🔴 AUTO-SKIP TRIGGERED (Offline)', {
    isResponderOffline,
    isActivePlayer,
    currentResponderId,
    rootPid,
    reason: '响应者离线，自动跳过'
});
```

### 3. 教学模式自动跳过（第 565 行）
```typescript
console.warn('[Board] 🔴 AUTO-SKIP TRIGGERED (Tutorial)', {
    gameMode: gameMode?.mode,
    currentResponderId,
    rootPid,
    reason: '教学模式下对手自动跳过'
});
```

## 如何使用日志排查

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 尝试选择"焚灭"技能
4. 查看控制台是否出现 🔴 标记的日志
5. 如果出现日志，说明响应窗口被自动跳过了，根据日志中的 `reason` 字段确定原因

## 可能的解决方案

### 如果是用户自动跳过模式
- 点击右上角的响应模式切换按钮
- 从灰色"自动跳过"切换到绿色"手动响应"

### 如果是响应者离线
- 检查网络连接
- 刷新页面重新连接

### 如果是教学模式
- 确认游戏模式是否正确
- 如果不是教学模式但触发了教学模式逻辑，说明有 bug

## 下一步

等待用户反馈控制台日志，确定具体原因。
