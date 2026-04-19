# DiceThrone 响应窗口视角切换最终修复

## 问题总结

用户反馈了多个问题：

1. **响应窗口没有自动切换视角**
2. **视角切换逻辑错误**（自己响应时应该切换到对手视角，而不是对手响应时切换）
3. **自动跳过模式下仍然切换视角**，导致游戏卡死
4. **切换到对手视角后，对手的可选技能没有高亮**

## 根本原因

### 1. 功能被禁用

提交 a4400a3 (2026-03-03) 禁用了响应窗口的视角自动切换功能。

### 2. 逻辑理解错误

最初恢复时，我理解错了响应窗口的逻辑：
- ❌ **错误理解**：对手响应时切换到对手视角
- ✅ **正确理解**：自己响应时切换到对手视角（看对手的骰子/状态来决定如何响应）

### 3. 自动跳过模式未考虑

视角切换没有检查 `autoResponseEnabled`，导致自动跳过模式下仍然切换视角。

### 4. 技能高亮只在掷骰阶段生效

`availableAbilityIds` 只在掷骰阶段（`offensiveRoll` / `defensiveRoll`）计算，响应窗口可能在任何阶段触发，导致技能不高亮。

## 修复方案

### 1. 恢复视角切换功能

**文件**：`src/games/dicethrone/ui/viewMode.ts`

```typescript
// 响应窗口自动切换逻辑
let isResponseAutoSwitch = false;
if (isResponseWindowOpen && currentResponderId) {
    // 当前响应者是自己 → 切换到对手视角（看对手的骰子/状态来决定如何响应）
    isResponseAutoSwitch = currentResponderId === rootPlayerId;
}
```

**关键点**：
- `currentResponderId === rootPlayerId` → 自己是响应者 → 切换到对手视角 ✅
- `currentResponderId !== rootPlayerId` → 对手是响应者 → 保持自己视角 ✅

### 2. 只在显示响应模式下切换视角

**文件**：`src/games/dicethrone/Board.tsx`

```typescript
React.useEffect(() => {
    // 只在显示响应窗口时才切换视角（自动跳过模式不切换）
    if (!autoResponseEnabled) {
        console.log('[Board] Auto-skip enabled, not switching view');
        return;
    }

    // 自己响应时切换到对手视角（看对手的骰子/状态）
    if (isOpen && isResponseAutoSwitch) {
        console.log('[Board] Switching to opponent view (self is responder, need to see opponent dice)');
        setViewMode('opponent');
    }
}, [isResponseWindowOpen, isResponseAutoSwitch, autoResponseEnabled, ...]);
```

**关键点**：
- `autoResponseEnabled = false`（自动跳过）→ 不切换视角
- `autoResponseEnabled = true`（显示响应）→ 自己响应时切换视角

### 3. 响应窗口期间显示可用技能

**文件**：`src/games/dicethrone/Board.tsx`

```typescript
const availableAbilityIds = React.useMemo(() => {
    // 响应窗口打开时，显示当前响应者的可用技能
    if (isResponseWindowOpen && currentResponderId) {
        // 如果当前视角是响应者，显示响应者的可用技能
        if (viewPid === currentResponderId) {
            // 响应窗口期间，使用 getAvailableAbilityIds 计算可用技能
            return getAvailableAbilityIds(G, currentResponderId, currentPhase);
        }
        return [];
    }
    // 掷骰阶段，显示掷骰者的可用技能
    return isViewRolling ? access.availableAbilityIds : [];
}, [isResponseWindowOpen, currentResponderId, viewPid, isViewRolling, access.availableAbilityIds, G, currentPhase]);
```

**关键点**：
- 响应窗口打开时，单独计算响应者的可用技能
- 不依赖 `isRollPhase`，因为响应窗口可能在任何阶段触发

## 工作流程

### 场景 1：自己响应对手（显示响应模式）

1. 对手攻击你
2. 响应窗口打开，`currentResponderId = 你的 ID`
3. `isResponseAutoSwitch = true`（自己是响应者）
4. 视角自动切换到对手（看对手的骰子/状态）
5. 计算你的可用技能并高亮显示
6. 你选择技能响应或跳过

### 场景 2：对手响应你（显示响应模式）

1. 你攻击对手
2. 响应窗口打开，`currentResponderId = 对手的 ID`
3. `isResponseAutoSwitch = false`（对手是响应者）
4. 视角保持在自己（不切换）
5. 等待对手响应

### 场景 3：自动跳过模式

1. 响应窗口打开
2. `autoResponseEnabled = false`
3. 视角不切换（保持当前视角）
4. 自动跳过逻辑在 300ms 后自动调用 `responsePass()`

## 测试验证

请测试以下场景：

1. **显示响应模式 + 自己响应**：
   - 视角应该自动切换到对手
   - 自己的可用技能应该高亮显示
   - 可以正常选择技能响应

2. **显示响应模式 + 对手响应**：
   - 视角应该保持在自己
   - 等待对手响应

3. **自动跳过模式**：
   - 视角不应该切换
   - 响应窗口自动跳过
   - 游戏正常继续

## 调试日志

添加了以下调试日志：

```typescript
console.log('[viewMode] Response window check:', {
    isResponseWindowOpen,
    currentResponderId,
    rootPlayerId,
    isResponseAutoSwitch,
    logic: currentResponderId === rootPlayerId ? 'Self is responder → switch to opponent' : 'Opponent is responder → stay on self',
});

console.log('[Board] Response window effect:', {
    wasOpen,
    isOpen,
    isResponseAutoSwitch,
    autoResponseEnabled,
    currentResponderId,
    rootPid,
    logic: isResponseAutoSwitch ? 'Self is responder → switch to opponent view' : 'Opponent is responder → stay on self view',
    currentPhase,
    currentViewMode: viewMode,
});
```

## 历史回顾

- **edef044** (2026-02-23)：首次实现响应窗口视角切换（但逻辑错误）
- **067c0e7** (2026-03-03)：引入 bug（字段访问错误）
- **a4400a3** (2026-03-03)：修复字段但禁用功能
- **本次修复**：恢复功能 + 修正逻辑 + 修复技能高亮

## 核心教训

1. **响应窗口的逻辑**：自己响应时需要看对手的状态，所以切换到对手视角
2. **自动跳过模式**：不应该切换视角，否则会卡死
3. **技能高亮**：响应窗口可能在任何阶段触发，不能只依赖掷骰阶段的逻辑
