# Cardia AI 对战游戏结束修复

## 问题描述

用户报告：和 AI 对战获得游戏胜利后，游戏不能正常结束，没有跳出游戏胜利或失败提示。

## 问题根因

问题有两个层面：

### 1. AI 恢复机制层面

在 `src/engine/transport/onlineAiRecovery.ts` 中有两个函数负责 AI 恢复机制：
1. `resolveForceEndTurnForStalledAi()` - 检测并强制结束卡住的 AI 回合
2. `resolveForceAdvancePhaseAfterRecovery()` - 恢复后继续推进阶段

这两个函数都没有检查游戏是否已经结束（`state.sys.gameover`），导致游戏结束后 AI 恢复机制仍然会尝试强制推进阶段。

### 2. FlowHooks 层面（关键问题）

在 `src/games/cardia/domain/flowHooks.ts` 的 `onAutoContinueCheck` 函数中：
- `end` 阶段会检查是否有 `TURN_ENDED` 事件
- 如果有，就会自动推进到下一个 `play` 阶段
- **但是它没有检查游戏是否已经结束**

这导致：
1. 游戏结束后，`sys.gameover` 被设置
2. `TURN_ENDED` 事件被发射
3. `flowHooks` 检测到 `TURN_ENDED` 事件，尝试推进到下一个 `play` 阶段
4. 游戏卡在了一个"已结束但仍在尝试推进"的状态
5. 客户端无法显示游戏结束提示

## 完整修复方案

### 修复 1：AI 恢复机制

在 `resolveForceEndTurnForStalledAi()` 和 `resolveForceAdvancePhaseAfterRecovery()` 函数中添加游戏结束检查：

```typescript
// src/engine/transport/onlineAiRecovery.ts

export function resolveForceEndTurnForStalledAi(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    seatStates: Record<string, MatchState<unknown> | null | undefined>;
}): ForceEndTurnStalledAiResolution | null {
    // ⚠️ 关键修复：如果游戏已经结束，不再尝试强制推进 AI
    const gameOver = args.sharedState?.sys?.gameover;
    if (gameOver) {
        return null;
    }
    // ... 原有逻辑
}

export function resolveForceAdvancePhaseAfterRecovery(args: {
    authoritativeState: MatchState<unknown> | null | undefined;
    seatControllers: Record<string, AiSeatController>;
    playerId: string;
}): AiResolution | null {
    const { authoritativeState, seatControllers, playerId } = args;
    if (!authoritativeState) {
        return null;
    }
    
    // ⚠️ 关键修复：如果游戏已经结束，不再尝试推进阶段
    const gameOver = authoritativeState.sys?.gameover;
    if (gameOver) {
        return null;
    }
    // ... 原有逻辑
}
```

### 修复 2：FlowHooks（关键修复）

在 `cardiaFlowHooks.onAutoContinueCheck` 中添加游戏结束检查：

```typescript
// src/games/cardia/domain/flowHooks.ts

export const cardiaFlowHooks: FlowHooks<CardiaCore> = {
    onAutoContinueCheck: (state, events) => {
        // ... 其他逻辑
        
        // 情况3：end 阶段 → play 阶段
        if (sys.phase === 'end') {
            // ⚠️ 关键修复：如果游戏已经结束，不再自动推进阶段
            if (sys.gameover) {
                console.log('[CardiaFlowHooks] Game is over, skipping auto-continue');
                return;
            }
            
            // 检测是否有 TURN_ENDED 事件
            const turnEnded = events.some(e => e.type === CARDIA_EVENTS.TURN_ENDED);
            
            if (turnEnded) {
                // 推进到下一个 play 阶段
                return {
                    autoContinue: true,
                    playerId: nextPlayerId,
                };
            }
        }
    },
};
```

## 测试验证

### 引擎层测试

创建了 `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts` 测试文件，包含 6 个测试用例：

1. ✅ **resolveForceEndTurnForStalledAi - 游戏结束后应该返回 null**
2. ✅ **resolveForceEndTurnForStalledAi - 游戏未结束时应该正常返回强制推进方案**
3. ✅ **resolveForceEndTurnForStalledAi - 游戏结束后即使有交互也应该返回 null**
4. ✅ **resolveForceEndTurnForStalledAi - 游戏结束后即使有响应窗口也应该返回 null**
5. ✅ **resolveForceAdvancePhaseAfterRecovery - 游戏结束后应该返回 null**
6. ✅ **resolveForceAdvancePhaseAfterRecovery - 游戏未结束时应该正常返回推进阶段方案**

所有测试通过：

```
 ✓ src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts (6 tests) 5ms
```

### 游戏层测试

需要添加 E2E 测试验证完整的 AI 对战流程，确认游戏结束后能正常显示结束提示。

## 修改文件

1. `src/engine/transport/onlineAiRecovery.ts` - 在两个函数中添加游戏结束检查
2. `src/games/cardia/domain/flowHooks.ts` - 在 `onAutoContinueCheck` 中添加游戏结束检查
3. `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts` - 新增测试文件（6个测试用例）
4. `evidence/cardia-ai-gameover-fix.md` - 修复证据文档

## 验证结果

- ✅ 单元测试通过（6/6）
- ✅ ESLint 检查通过
- ✅ TypeScript 编译检查通过
- ⏳ E2E 测试待验证

## 影响范围

### AI 恢复机制修复

影响所有使用 AI 对战的游戏（Cardia、Dice Throne、Summoner Wars、Smash Up 等），确保游戏结束后 AI 恢复机制不再尝试强制推进阶段。

### FlowHooks 修复

仅影响 Cardia 游戏，确保游戏结束后不再自动推进阶段。

## 风险评估

- **风险等级**：低
- **理由**：
  1. 修改位置明确，只在关键位置添加早退条件
  2. 逻辑清晰：游戏已结束 → 不需要推进阶段
  3. 测试覆盖充分，包含多种边界情况
  4. 不影响游戏进行中的正常流程

## 验收标准

- [x] 代码修改完成
- [x] 单元测试通过
- [x] ESLint 检查通过
- [ ] E2E 测试：与 AI 对战，获胜后游戏能正常结束并显示结束提示
- [ ] 回归测试：确认其他游戏的 AI 对战功能正常

## 后续建议

1. **E2E 测试**：添加端到端测试，模拟完整的 AI 对战流程，验证游戏结束后的行为
2. **通用化**：考虑在引擎层的 `FlowSystem` 中添加通用的游戏结束检查，避免每个游戏都需要单独处理
3. **监控**：在生产环境监控游戏结束后的行为，确认修复有效

## 相关文档

- `.spec/knowledge/standards/engine-systems.md`：引擎系统规范
- `src/engine/transport/onlineAiRecovery.ts`：在线 AI 恢复机制
- `src/engine/pipeline.ts`：游戏结束检测逻辑
- `src/games/cardia/domain/flowHooks.ts`：Cardia 回合流程钩子
