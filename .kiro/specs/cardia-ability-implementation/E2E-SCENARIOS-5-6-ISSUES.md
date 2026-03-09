# Cardia 完整回合流程测试 - 场景5-6问题分析

> **日期**: 2026-03-01  
> **状态**: ⚠️ 场景5-6遇到问题  
> **测试文件**: `e2e/cardia-full-turn-flow.e2e.ts`

---

## 问题总结

### 场景5：牌库为空时的回合流程 ❌
**问题**: 测试超时，等待阶段推进到 `play` 失败

**测试输出**:
```
=== 场景5：牌库为空时的回合流程 ===
初始状态: { p1Hand: 1, p2Hand: 1, p1Deck: 0, p2Deck: 0, phase: 'play' }

--- 阶段1：打出卡牌 ---
✅ 阶段1验证通过

--- 阶段2：跳过能力 ---
点击跳过能力

--- 阶段3：回合结束（牌库为空，不抽牌）---
[超时 30秒]
```

**分析**:
- 阶段1和阶段2都正常
- 点击"跳过能力"按钮后，阶段没有推进
- 可能原因：
  1. `executeSkipAbility` 调用 `executeAutoEndTurn` 时，牌库为空导致某些逻辑异常
  2. UI 层没有正确响应阶段变化
  3. 游戏结束检测阻止了阶段推进（牌库为空应该触发游戏结束）

**代码检查**:
```typescript
// executeAutoEndTurn 中的抽牌逻辑
for (const pid of Object.keys(core.players)) {
    const player = core.players[pid];
    if (player && player.deck.length > 0) {  // ✅ 有检查牌库是否为空
        events.push({
            type: CARDIA_EVENTS.CARD_DRAWN,
            timestamp,
            payload: { playerId: pid, count: 1 },
        });
    }
}
```

**可能的根因**:
- `isGameOver` 函数检查到牌库为空时应该触发游戏结束
- 但是游戏结束检测可能在错误的时机触发，导致阶段推进被阻止

---

### 场景6：达到5印戒时的胜利流程 ❌
**问题**: P2达到5个印戒，但 `sys.gameover` 未定义

**测试输出**:
```
=== 场景6：达到5印戒时的胜利流程 ===
初始状态: { p1Signets: 1, p2Signets: 4, phase: 'play' }

--- 阶段1：打出卡牌 ---

--- 验证游戏结束 ---
游戏结束后: {
  p2TotalSignets: 5,
  gameover: undefined,
  phase: 'ability',
  p2PlayedCards: 5
}
```

**分析**:
- P2确实有5个印戒（`p2TotalSignets: 5`）
- 但是 `sys.gameover` 是 `undefined`
- 阶段停留在 `ability`，说明游戏没有结束

**代码检查**:
```typescript
// isGameOver 函数中的印戒检查
const signetsCount: Record<PlayerId, number> = {};
for (const playerId of core.playerOrder) {
    const player = core.players[playerId];
    signetsCount[playerId] = getTotalSignets(player);
}

const playersWithEnoughSignets = core.playerOrder.filter(
    pid => signetsCount[pid] >= core.targetSignets
);

if (playersWithEnoughSignets.length > 0) {
    // 应该返回游戏结束
    return { winner: playersWithEnoughSignets[0] };
}
```

**可能的根因**:
1. **游戏结束检测时机问题**：
   - 根据 `docs/ai-rules/engine-systems.md`，游戏结束检测应该在管线（`executePipeline`）中每次命令执行成功后自动调用
   - 但是可能在印戒放置后，游戏结束检测还没有被触发
   - 或者游戏结束检测被触发了，但是结果没有被正确写入 `sys.gameover`

2. **印戒计算问题**：
   - `getTotalSignets` 函数从 `player.playedCards` 中计算印戒
   - 可能当前回合的卡牌还没有被添加到 `playedCards` 中
   - 或者印戒还没有被放置到卡牌上

3. **测试时机问题**：
   - 测试在打出卡牌后等待3秒
   - 但是可能需要更长时间让游戏处理遭遇战和游戏结束逻辑
   - 或者需要等待特定的UI事件（如游戏结束弹窗）

---

## 根本原因分析

### 共同点
两个场景都涉及游戏结束检测：
- 场景5：牌库为空应该触发游戏结束
- 场景6：达到5印戒应该触发游戏结束

### 可能的系统性问题
1. **游戏结束检测未被正确触发**：
   - 管线可能没有在正确的时机调用 `isGameOver`
   - 或者 `isGameOver` 的返回值没有被正确处理

2. **`sys.gameover` 未被正确写入**：
   - 游戏结束检测的结果可能没有被写入到 `sys.gameover`
   - 或者写入的位置不对（写入到 `core.gameover` 而非 `sys.gameover`）

3. **阶段推进被阻止**：
   - 游戏结束时，阶段推进可能被阻止
   - 导致测试等待阶段推进超时

---

## 下一步调试计划

### 1. 检查游戏结束检测的触发时机
- 在 `executePipeline` 中添加日志，确认 `isGameOver` 是否被调用
- 确认 `isGameOver` 的返回值是什么

### 2. 检查 `sys.gameover` 的写入逻辑
- 确认游戏结束检测的结果是否被正确写入到 `sys.gameover`
- 检查是否有其他地方覆盖了 `sys.gameover`

### 3. 简化测试场景
- 先测试一个更简单的场景：P2已有4个印戒，打出一张卡牌后立即检查游戏结束
- 不涉及能力激活，只验证印戒放置和游戏结束检测

### 4. 检查现有测试
- 查看其他测试是否有类似的游戏结束检测
- 参考它们的实现方式

---

## 临时解决方案

### 方案A：跳过这两个场景
- 暂时跳过场景5和场景6
- 先完成场景1-4的文档和总结
- 后续单独修复游戏结束检测问题

### 方案B：修改测试预期
- 场景5：不验证阶段推进，只验证牌库为空时不抽牌
- 场景6：不验证 `sys.gameover`，只验证印戒数量达到5

### 方案C：深入调试
- 添加更多日志，确认游戏结束检测的触发时机
- 修复游戏结束检测的问题
- 然后重新运行测试

---

## 建议

**推荐方案A**：
1. 暂时跳过场景5和场景6
2. 完成场景1-4的文档和总结
3. 创建一个单独的 issue 或 spec 来修复游戏结束检测问题
4. 修复后再补充场景5和场景6的测试

**理由**:
- 场景1-4已经覆盖了核心的回合流程
- 游戏结束检测是一个独立的系统性问题
- 不应该阻塞当前的测试框架完成

---

## 当前进度

✅ **场景1-4完成**
- 场景1：基础回合流程 ✅
- 场景2：即时能力回合流程 ✅
- 场景3：持续能力回合流程 ✅
- 场景4：平局回合流程 ✅

⚠️ **场景5-6遇到问题**
- 场景5：牌库为空时的回合流程 ❌ 超时
- 场景6：达到5印戒时的胜利流程 ❌ 游戏结束检测失败

**完成度**: 4/6 场景（约67%）  
**测试质量**: ⭐⭐⭐⭐ (4/5) - 核心流程已覆盖，游戏结束检测待修复

---

**创建时间**: 2026-03-01  
**预计修复时间**: 1-2小时（需要深入调试游戏结束检测系统）
