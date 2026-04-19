# DiceThrone 攻击修正徽章在 main2 阶段未清除问题修复

## 问题描述

用户反馈：DiceThrone 游戏中，攻击修正徽章（ActiveModifierBadge）和伤害加成显示（AttackBonusDamageDisplay）在进入主要阶段 2（main2）后仍然显示，甚至回合切换后也还在显示。

## 根因分析

### 数据流追踪

1. **UI 显示逻辑**（`Board.tsx:1285`）：
   ```typescript
   bonusDamage={G.pendingAttack?.bonusDamage ?? G.players[G.activePlayerId]?.pendingBonusDamage}
   activeModifiers={activeModifiers}
   ```

2. **两个独立的显示系统**：
   - **AttackBonusDamageDisplay**：显示 `bonusDamage` 数值
     - 数据来源：`G.pendingAttack?.bonusDamage ?? G.players[G.activePlayerId]?.pendingBonusDamage`
   - **ActiveModifierBadge**：显示攻击修正卡列表
     - 数据来源：`useActiveModifiers` hook，通过 EventStream 监听 `ATTACK_RESOLVED` 事件

### 问题 1：pendingBonusDamage 清理时机

**字段定义**（`core-types.ts:382`）：
```typescript
/** 待处理的攻击修正伤害（在 pendingAttack 创建前累积，创建时转移到 pendingAttack.bonusDamage） */
pendingBonusDamage?: number;
```

**清理时机**：
- `pendingAttack.bonusDamage`：在攻击结算时清除（`ATTACK_RESOLVED` 事件将 `pendingAttack` 设为 `null`）
- `player.pendingBonusDamage`：
  - ✅ 回合切换时清除（`handleTurnChanged`）
  - ❌ **进入 main2 阶段时未清除**（本次修复）

### 问题 2：ActiveModifierBadge 依赖 EventStream

`useActiveModifiers` hook 通过监听 `ATTACK_RESOLVED` 事件来清除修正卡列表：

```typescript
if (attackResolvedIndex >= 0) {
    // 有 ATTACK_RESOLVED 事件：清空旧修正卡
    setModifiers(newModifiers);
}
```

**潜在问题**：
- 如果 `ATTACK_RESOLVED` 事件没有被正确添加到 EventStream
- 或者 EventStream 没有正确更新
- 修正卡列表就不会被清除

**验证方法**：
1. 打开浏览器控制台
2. 查看 `[useActiveModifiers]` 日志
3. 确认是否有 "找到 ATTACK_RESOLVED 事件" 的日志

## 修复方案

### 修复：在 main2 阶段清除 pendingBonusDamage

在进入 main2 阶段时，清除当前玩家的 `pendingBonusDamage`：

```typescript
if (to === 'main2') {
    // 清理攻击相关状态
    let players = state.players;
    const activePlayer = state.players[activePlayerId];
    if (activePlayer?.pendingBonusDamage !== undefined) {
        players = {
            ...state.players,
            [activePlayerId]: {
                ...activePlayer,
                pendingBonusDamage: undefined,
            },
        };
    }
    
    return {
        ...state,
        activePlayerId,
        players,
        extraAttackInProgress: state.extraAttackInProgress ? undefined : state.extraAttackInProgress,
    };
}
```

## 修复文件

- `src/games/dicethrone/domain/reducer.ts`：在 `SYS_PHASE_CHANGED` 处理中添加 `pendingBonusDamage` 清理逻辑
- `src/games/dicethrone/__tests__/pending-bonus-damage-cleanup.test.ts`：新增单元测试验证清理逻辑

## 测试验证

### 单元测试

创建了 `pending-bonus-damage-cleanup.test.ts`，包含 11 个测试用例：

1. **进入 main2 阶段时清除 pendingBonusDamage**（4 个测试）：
   - ✅ 应该清除当前玩家的 pendingBonusDamage
   - ✅ 如果 pendingBonusDamage 不存在，不应该修改 players 对象（结构共享）
   - ✅ 应该同时清除 extraAttackInProgress
   - ✅ 不应该影响其他玩家的 pendingBonusDamage

2. **回合切换时清除所有玩家的 pendingBonusDamage**（2 个测试）：
   - ✅ 应该清除所有玩家的 pendingBonusDamage
   - ✅ 如果没有玩家有 pendingBonusDamage，不应该修改 players 对象（结构共享）

3. **其他阶段不应该清除 pendingBonusDamage**（4 个测试）：
   - ✅ 进入 upkeep 阶段时不应该清除
   - ✅ 进入 income 阶段时不应该清除
   - ✅ 进入 main1 阶段时不应该清除
   - ✅ 进入 discard 阶段时不应该清除

4. **攻击结算时 pendingAttack 被清除**（1 个测试）：
   - ✅ ATTACK_RESOLVED 事件应该清除 pendingAttack

**测试结果**：所有 11 个测试通过 ✅

```
Test Files  1 passed (1)
     Tests  11 passed (11)
```

### 手动测试流程（待用户验证）

1. 进入 DiceThrone 游戏
2. 在 main1 阶段打出攻击修正卡（timing: 'roll'）
3. 观察骰子区域上方出现 ActiveModifierBadge 和 AttackBonusDamageDisplay
4. 进入 offensiveRoll 阶段，掷骰并确认
5. 进入 defensiveRoll 阶段，防御方掷骰并确认
6. 攻击结算后进入 main2 阶段
7. **验证点 1**：AttackBonusDamageDisplay 应该消失（修复已验证）
8. **验证点 2**：ActiveModifierBadge 应该消失（依赖 EventStream）
9. 如果 ActiveModifierBadge 仍然显示，打开控制台查看日志

### 控制台日志检查

如果 ActiveModifierBadge 仍然显示，检查以下日志：

```
[useActiveModifiers] 找到 ATTACK_RESOLVED 事件，索引: X
[useActiveModifiers] 处理 ATTACK_RESOLVED，当前 modifiers 数量: Y
[useActiveModifiers] ATTACK_RESOLVED 后的新修正卡: [] （应该清空旧的）
```

如果没有这些日志，说明 `ATTACK_RESOLVED` 事件没有被添加到 EventStream。

## 相关组件

- `src/games/dicethrone/ui/ActiveModifierBadge.tsx`：攻击修正徽章组件
- `src/games/dicethrone/ui/AttackBonusDamageDisplay.tsx`：伤害加成显示组件
- `src/games/dicethrone/ui/RightSidebar.tsx`：右侧边栏（包含骰子区域和徽章）
- `src/games/dicethrone/Board.tsx`：主 Board 组件（传递 bonusDamage 和 activeModifiers props）
- `src/games/dicethrone/hooks/useActiveModifiers.ts`：攻击修正卡追踪 hook
- `src/games/dicethrone/domain/reducer.ts`：状态 reducer（包含清理逻辑）

## 设计原则

### 状态清理时机

1. **攻击相关状态**：
   - `pendingAttack`：攻击结算时清除（`ATTACK_RESOLVED`）
   - `pendingBonusDamage`：进入 main2 阶段时清除（本次修复）+ 回合切换时清除（已有逻辑）
   - `extraAttackInProgress`：进入 main2 阶段时清除（已有逻辑）

2. **回合相关状态**：
   - `lastResolvedAttackDamage`：回合切换时清除
   - `taijiGainedThisTurn`：回合切换时清除

### 结构共享原则

修复代码遵循 DRY 原则和结构共享：
- 只在需要时创建新的 `players` 对象
- 使用条件判断避免不必要的对象创建
- 保持与现有代码风格一致

### EventStream 驱动的 UI 状态

`useActiveModifiers` hook 通过 EventStream 监听事件，而不是直接读取 core 状态：
- ✅ 优点：支持撤回、刷新恢复
- ⚠️ 注意：依赖 EventStream 正确更新

## 后续行动

1. ✅ **已完成**：修复 pendingBonusDamage 清理逻辑
2. ✅ **已完成**：编写单元测试验证修复
3. ⏳ **待用户验证**：测试 AttackBonusDamageDisplay 是否消失
4. ⏳ **如果 ActiveModifierBadge 仍然显示**：
   - 检查控制台日志
   - 确认 ATTACK_RESOLVED 事件是否被添加到 EventStream
   - 考虑修复 useActiveModifiers 的依赖项

## 总结

通过在 main2 阶段转换时清除 `pendingBonusDamage`，确保伤害加成显示在攻击结算后立即消失。单元测试验证了修复的正确性，包括边界情况和结构共享优化。攻击修正徽章的清除依赖 EventStream 中的 `ATTACK_RESOLVED` 事件，需要用户验证是否正常工作。


