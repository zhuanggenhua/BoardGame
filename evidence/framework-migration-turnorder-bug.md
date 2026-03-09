# 框架迁移 - turnOrder 缺失修复

## 问题描述

E2E 测试 `e2e/smashup-phase-transition-simple.e2e.ts` 和 `e2e/smashup-complex-multi-base-scoring.e2e.ts` 失败，阶段转换没有发生。

## 根本原因

`e2e/framework/GameTestContext.ts` 的 `setupScene()` 方法只设置了 `currentPlayerIndex`，但没有设置 `turnOrder`，导致 `getCurrentPlayerId()` 返回 `undefined`，阶段转换逻辑失败。

## 调用链分析

1. 用户点击"结束回合" → `dispatch(FLOW_COMMANDS.ADVANCE_PHASE, {})`
2. FlowSystem 调用 `onPhaseExit('playCards')` → 需要 `getCurrentPlayerId(core)`
3. `getCurrentPlayerId` 依赖 `turnOrder`：`return core.turnOrder[core.currentPlayerIndex]`
4. **问题**：`turnOrder` 为 `undefined`，`getCurrentPlayerId()` 返回 `undefined`
5. 阶段转换逻辑失败

## 修复方案

在 `e2e/framework/GameTestContext.ts` 的 `setupScene()` 方法中，当设置 `currentPlayer` 时，同时设置 `turnOrder`：

```typescript
if (cfg.currentPlayer !== undefined) {
    const playerIndex = parseInt(cfg.currentPlayer, 10);
    patch.core.currentPlayerIndex = playerIndex;
    // 确保 turnOrder 存在（默认双人游戏）
    if (!patch.core.turnOrder) {
        patch.core.turnOrder = ['0', '1'];
    }
}
```

## 测试验证

### 简化测试（通过 ✅）

运行 `npm run test:e2e:ci -- e2e/smashup-phase-transition-simple.e2e.ts`

**测试结果**：通过 ✅

**测试截图**：
- 截图 1：初始状态显示 "TURN 1" + "YOU" + "Play" 阶段
- 截图 2：点击"结束回合"后，回合成功切换到对手（显示 "OPP"）

### 复杂测试（失败 ❌）

运行 `npm run test:e2e:ci -- e2e/smashup-complex-multi-base-scoring.e2e.ts`

**测试结果**：失败 ❌

**失败原因**：基地计分逻辑没有正确执行
- 玩家分数为 0（期望 > 0）
- 基地上的随从没有被清空（期望计分后随从被弃掉）
- 基地没有被替换（因为没有设置牌库）

**测试日志**：
```
[TEST] 最终状态: {
  "bases": [
    { "defId": "base_the_jungle", "minions": [4个随从] },  // ❌ 随从没有被清空
    { "defId": "base_ninja_dojo", "minions": [3个随从] },  // ❌ 随从没有被清空
    { "defId": "base_the_factory", "minions": [] }
  ],
  "p0Vp": 0,  // ❌ 分数为 0
  "p1Vp": 0,
  "phase": "playCards"  // ✅ 阶段正确推进
}
```

**分析**：
1. ✅ 阶段转换正常（playCards → scoreBases → playCards）
2. ✅ 交互流程正常（多基地计分选择、海盗王移动）
3. ❌ 基地计分逻辑没有执行（随从没有被弃掉，分数没有增加）

**下一步**：
- 需要调查为什么基地计分逻辑没有执行
- 可能是测试场景设置不完整（缺少必要的配置）
- 或者是基地计分逻辑本身有问题

## 总结

`turnOrder` 缺失问题已修复，简化测试通过。复杂测试失败的原因是基地计分逻辑没有正确执行，这是一个独立的问题，需要进一步调查。
