# Court Guard 多张派系手牌场景能力被跳过问题

## 问题描述

**影响卡牌**：影响力 7 - 宫廷卫士 (Court Guard)

**能力描述**：你选择一个派系，你的对手可以选择弃掉一张该派系的手牌，否则本牌添加+7影响力

**问题场景**：当对手有多张该派系手牌时，选择"弃牌"后应该显示卡牌选择界面让对手选择具体弃哪张，但实际游戏直接跳过了能力阶段进入下回合。

## 测试覆盖情况

| 场景 | 描述 | 状态 |
|------|------|------|
| 场景 1 | P2 没有该派系手牌 → P1 获得 +7 修正 | ✅ 通过 |
| 场景 2 | P2 有 1 张该派系手牌，选择弃牌 → 自动弃掉，P1 不获得修正 | ✅ 通过 |
| 场景 3 | P2 有该派系手牌，选择不弃牌 → P1 获得 +7 修正 | ✅ 通过 |
| 场景 4 | P2 有多张该派系手牌，需要选择具体弃哪张 | ❌ 能力被跳过 |

## 手动测试结果

**测试配置**：
- P1 打出 card_15 (发明家，影响力 15)
- P2 打出 card_07 (宫廷卫士，影响力 7)
- P1 赢了（15 > 7），P2 进入能力阶段

**实际结果**：
- 游戏状态显示 `"phase": "end"` - 已经进入结束阶段
- `"turnNumber": 6` - 已经是第 6 回合
- `"sys.interaction.queue": []` - 交互队列为空
- `"sys.interaction.isBlocked": true` - 交互系统被阻塞

**结论**：能力阶段被完全跳过，游戏直接推进到了下一回合。

## 根本原因分析

### 能力定义

```typescript
// src/games/cardia/domain/abilityRegistry.ts:175
abilityRegistry.register({
    id: ABILITY_IDS.COURT_GUARD,
    name: 'abilities.court_guard.name',
    description: 'abilities.court_guard.description',
    trigger: 'onLose',  // ← 只在输的时候触发
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'conditionalInfluence', modifierValue: 7, factionFilter: true, requiresChoice: true }
    ],
});
```

### 能力按钮显示条件

```typescript
// src/games/cardia/Board.tsx:221
const canActivateAbility = isAbilityPhase && core.currentEncounter?.loserId === myPlayerId;
```

### 自动推进逻辑

```typescript
// src/games/cardia/domain/flowHooks.ts:210-232
// 情况2：ability 阶段 → end 阶段
if (sys.phase === 'ability') {
    const interactionJustResolved = events.some(e => e.type === 'SYS_INTERACTION_RESOLVED');
    const abilitySkipped = events.some(e => e.type === CARDIA_EVENTS.ABILITY_SKIPPED);
    const abilityActivated = events.some(e => e.type === CARDIA_EVENTS.ABILITY_ACTIVATED);
    const interactionRequested = events.some(e => e.type === CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED);
    const abilityActivatedWithoutInteraction = abilityActivated && !interactionRequested;
    
    if (interactionJustResolved || abilitySkipped || abilityActivatedWithoutInteraction) {
        return {
            autoContinue: true,
            playerId: activePlayerId,
        };
    }
}
```

### 可能的原因

1. **能力按钮未显示**：`canActivateAbility` 条件不满足，导致玩家无法激活能力
2. **自动跳过逻辑触发**：`onAutoContinueCheck` 在不应该推进的时候推进了
3. **交互创建失败**：Court Guard 的第二步交互（选择具体弃哪张牌）没有正确创建或持久化

## 调试建议

1. **添加服务端日志**：
   - 在 `flowHooks.ts` 的 `onAutoContinueCheck` 中添加详细日志
   - 在 `group2-modifiers.ts` 的 Court Guard 交互处理器中添加日志
   - 记录能力阶段的进入和退出

2. **检查交互创建**：
   - 确认 `card_selection` 交互是否被正确创建
   - 确认交互数据（`context.factionCards`）是否正确传递
   - 确认 `wrapCardiaInteraction` 是否正确转换交互数据

3. **检查能力触发条件**：
   - 确认 `trigger: 'onLose'` 是否正确匹配
   - 确认失败者的卡牌是否有能力
   - 确认能力按钮的显示条件是否满足

## 临时解决方案

- 场景 2 和 3 已验证核心逻辑正确（单张卡自动弃掉、选择不弃牌）
- 场景 4 的核心逻辑（多张卡选择）可以通过单元测试补充验证
- E2E 测试已标记为 `skip`，待问题修复后重新启用

## 相关文件

- `e2e/cardia-deck1-card07-court-guard.e2e.ts` - E2E 测试文件
- `src/games/cardia/domain/abilityRegistry.ts` - 能力定义
- `src/games/cardia/domain/abilities/group2-modifiers.ts` - Court Guard 交互处理器
- `src/games/cardia/domain/flowHooks.ts` - 回合流程钩子
- `src/games/cardia/Board.tsx` - UI 渲染逻辑
- `src/games/cardia/domain/systems.ts` - 交互包装逻辑

## 修复优先级

**P2 - 中等优先级**

- 不影响其他能力的正常使用
- 场景 2 和 3 已覆盖大部分使用场景
- 场景 4 是边缘情况（对手恰好有多张该派系手牌）
- 但影响游戏完整性，应尽快修复
