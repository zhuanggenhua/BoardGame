# 焦点玩家系统设计

## 概述

焦点玩家系统（Focus Player System）用于统一判断"当前应该操作的玩家"，解决了之前在 UI 层散落的焦点判断逻辑导致的维护性问题。

## 问题背景

### 原有问题

在重构前，焦点玩家的判断逻辑散落在多处：

```typescript
// Board.tsx 中的多处判断
const isActivePlayer = G.activePlayerId === rootPid;
const rollerId = currentPhase === 'defensiveRoll' ? G.pendingAttack?.defenderId : G.activePlayerId;
const isResponder = isResponseWindowOpen && currentResponderId === rootPid;
const isTokenResponder = pendingDamage && pendingDamage.responderId === rootPid;
const isInteractionOwner = pendingInteraction?.playerId === rootPid;

// 组合成复杂的条件链
const waitingReason =
    (isResponseWindowOpen && !isResponder) ? 'response'
    : (isDiceInteraction && !isInteractionOwner) ? 'interaction'
    : (pendingDamage && !isTokenResponder) ? 'token'
    : (currentPhase === 'defensiveRoll' && !!rollerId && !canInteractDice) ? 'defense'
    : (!isActivePlayer && !isResponder) ? 'opponentTurn'
    : null;
```

### 具体问题

1. **维护困难**：每加新场景（如 Token 响应）需要修改多处
2. **逻辑冗余**：相同的判断逻辑在不同地方重复
3. **易出错**：防御阶段结束后进入响应窗口时，焦点判断错误导致按钮隐藏

## 设计方案

### 核心概念

**焦点玩家（Focus Player）**：当前应该进行操作的玩家，具有以下特征：
- 可以看到操作按钮（如"下一阶段"）
- 其他玩家看到"等待对方思考"提示
- 由游戏状态自动计算，无需手动维护

### 实现位置

在 `useDiceThroneState.ts` 中实现统一的焦点计算：

```typescript
/**
 * 获取当前焦点玩家 ID
 * 
 * 焦点玩家 = 当前应该操作的玩家，优先级从高到低：
 * 1. 响应窗口的当前响应者
 * 2. Token 响应的响应者
 * 3. 交互（骰子修改等）的所有者
 * 4. Prompt（选择）的目标玩家
 * 5. 防御阶段的防御方（掷骰者）
 * 6. 回合主动玩家
 */
export function getFocusPlayerId(state: EngineState): PlayerId {
    const { core, sys } = state;
    const turnPhase = (sys.phase ?? core.turnPhase) as TurnPhase;
    
    // 1. 响应窗口的当前响应者
    if (sys.responseWindow?.current) {
        const rw = sys.responseWindow.current;
        return rw.responderQueue[rw.currentResponderIndex];
    }
    
    // 2. Token 响应的响应者
    if (core.pendingDamage) {
        return core.pendingDamage.responderId;
    }
    
    // 3. 交互（骰子修改等）的所有者
    if (core.pendingInteraction) {
        return core.pendingInteraction.playerId;
    }
    
    // 4. Prompt（选择）的目标玩家
    if (sys.prompt.current) {
        return sys.prompt.current.playerId;
    }
    
    // 5. 防御阶段的防御方（掷骰者）
    if (turnPhase === 'defensiveRoll' && core.pendingAttack) {
        return core.pendingAttack.defenderId;
    }
    
    // 6. 默认：回合主动玩家
    return core.activePlayerId;
}
```

### 接口变更

在 `DiceThroneStateAccess` 接口中新增 `focusPlayerId`：

```typescript
export interface DiceThroneStateAccess {
    // ... 其他字段
    
    // 焦点玩家（当前应该操作的玩家）
    focusPlayerId: PlayerId;
    
    // ... 其他字段
}
```

### UI 层简化

Board.tsx 中的使用：

```typescript
// 重构前（复杂的条件链）
const isOperator = isActivePlayer || (currentPhase === 'defensiveRoll' && rootPid === rollerId);
const waitingReason =
    (isResponseWindowOpen && !isResponder) ? 'response'
    : (isDiceInteraction && !isInteractionOwner) ? 'interaction'
    : (pendingDamage && !isTokenResponder) ? 'token'
    : (currentPhase === 'defensiveRoll' && !!rollerId && !canInteractDice) ? 'defense'
    : (!isOperator && !isResponder) ? 'opponentTurn'
    : null;

// 重构后（单一判断）
const isFocusPlayer = access.focusPlayerId === rootPid;
const isWaitingOpponent = !isFocusPlayer;

// 阶段推进权限也使用 focusPlayerId
const canAdvancePhase = isFocusPlayer && (currentPhase === 'defensiveRoll' ? rollConfirmed : true);
```

## 解决的问题

### 1. 防御阶段 → 响应窗口的焦点转换

**场景**：防御方结束防御掷骰后，进入 `preResolve` 响应窗口

**问题**：
- `sys.phase` 仍是 `defensiveRoll`（因为 `halt: true`）
- 旧逻辑：`canAdvancePhase = rollerId === rootPid && rollConfirmed`
- 攻击方不是 `rollerId`，按钮被错误隐藏

**解决**：
- `getFocusPlayerId` 优先返回响应窗口的当前响应者
- `preResolve` 窗口时，`focusPlayerId = attackerId`（攻击方）
- 攻击方的 `isFocusPlayer = true` → 按钮正确显示 ✅

### 2. 等待提示的统一显示

重构前需要判断多种等待原因（`response`、`interaction`、`token`、`defense`、`opponentTurn`），重构后统一为：

```typescript
{isWaitingOpponent && (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="text-amber-400 text-[2vw] font-bold">
            {opponentName}
        </div>
        <div className="text-amber-300/80 text-[1.2vw] font-medium">
            {t('waiting.thinkingMessage')}
        </div>
    </div>
)}
```

## 优先级说明

焦点玩家的优先级（从高到低）：

| 优先级 | 场景 | 说明 |
|-------|------|------|
| 1 | 响应窗口 | 当前响应者可以打出卡牌响应 |
| 2 | Token 响应 | 使用 Token 抵消伤害 |
| 3 | 交互（骰子/状态） | 卡牌效果触发的交互选择 |
| 4 | Prompt（选择） | 游戏事件触发的选择（如技能分支） |
| 5 | 防御阶段 | 防御方进行防御掷骰 |
| 6 | 回合主动玩家 | 默认情况下的回合玩家 |

**设计原则**：越"临时"的状态优先级越高，因为必须先解决临时状态才能继续游戏流程。

## 扩展性

当需要新增焦点场景时：

1. 在 `getFocusPlayerId` 函数中添加新的条件分支
2. 确定优先级（通常插入到合适位置）
3. UI 层无需修改，自动生效

例如，未来如果需要支持"多人同时响应"：

```typescript
// 新增优先级 1.5：多人同时响应时的当前玩家
if (sys.multiPlayerResponse?.current) {
    return sys.multiPlayerResponse.current.currentPlayerId;
}
```

## 测试建议

关键测试场景：

1. **防御阶段焦点转换**
   - 防御方掷骰 → 焦点 = 防御方
   - 确认掷骰后进入响应窗口 → 焦点 = 攻击方
   - 响应窗口关闭后进入下一阶段 → 焦点 = 回合玩家

2. **响应窗口焦点轮转**
   - 响应队列 [P1, P2]
   - P1 pass → 焦点 = P2
   - P2 pass → 响应窗口关闭

3. **Token 响应优先级**
   - 攻击结算触发 Token 响应 → 焦点 = Token 响应者
   - Token 使用后继续结算 → 焦点恢复到回合玩家

## 相关文件

- `src/games/dicethrone/hooks/useDiceThroneState.ts` - 焦点玩家计算
- `src/games/dicethrone/Board.tsx` - UI 层使用
- `src/games/dicethrone/game.ts` - FlowHooks 配合焦点系统

## 版本记录

- **v1.0** (2026-01-27): 初始设计，解决防御阶段焦点问题
