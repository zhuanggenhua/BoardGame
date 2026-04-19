# afterScoring 响应窗口中打出卡牌的执行修复

## 问题描述

用户反馈在 afterScoring 响应窗口中打出"重返深海"和"我们乃最强"后，没有任何日志反馈。

## 根本原因

afterScoring 卡牌在打出时只生成 ARMED 事件，不立即执行能力。这导致：
1. 卡牌被打出后没有立即执行效果
2. 用户看不到任何反馈
3. 卡牌效果被延迟到基地计分后才执行

## 修复方案

### 1. reducer.ts 修复（通用路径）

修改 `src/games/smashup/domain/reducer.ts` 中的 PLAY_ACTION 处理逻辑：

- 在 `specialTiming === 'afterScoring'` 分支中，检查是否在 afterScoring 响应窗口中
- 如果在响应窗口中，立即执行能力（调用 `resolveSpecial` 或 `resolveOnPlay`）
- 如果不在响应窗口中，生成 ARMED 事件（原有逻辑）

```typescript
} else if (specialTiming === 'afterScoring') {
    // afterScoring：检查是否在响应窗口中
    const responseWindow = state.sys.responseWindow?.current;
    const isInAfterScoringWindow = responseWindow?.windowType === 'afterScoring';
    
    if (isInAfterScoringWindow) {
        // 在 afterScoring 响应窗口中：立即执行
        const executor = resolveSpecial(card.defId) ?? resolveOnPlay(card.defId);
        if (executor) {
            const ctx: AbilityContext = { ... };
            const result = executor(ctx);
            events.push(...result.events);
            if (result.matchState) {
                updatedState = result.matchState;
            }
        }
    } else {
        // 不在响应窗口中：生成 ARMED 事件，延迟到基地计分后执行
        const armedEvt: SpecialAfterScoringArmedEvent = { ... };
        events.push(armedEvt);
    }
}
```

### 2. giant_ants.ts 修复（特殊路径）

修改 `src/games/smashup/abilities/giant_ants.ts` 中的 `giantAntWeAreTheChampions` 函数：

- 该函数直接返回 ARMED 事件，绕过了 reducer 的逻辑
- 需要在函数内部检查是否在 afterScoring 响应窗口中
- 如果在响应窗口中，立即创建交互（选择转移力量指示物的随从）
- 如果不在响应窗口中，返回 ARMED 事件（原有逻辑）

```typescript
function giantAntWeAreTheChampions(ctx: AbilityContext): AbilityResult {
    // 检查是否在 afterScoring 响应窗口中
    const responseWindow = ctx.matchState?.sys.responseWindow?.current;
    const isInAfterScoringWindow = responseWindow?.windowType === 'afterScoring';
    
    if (isInAfterScoringWindow) {
        // 在响应窗口中：立即执行（不生成 ARMED 事件）
        // 捕获当前基地上己方有力量指示物的随从
        const base = ctx.state.bases[ctx.baseIndex];
        const sources = base?.minions
            .filter(m => m.controller === ctx.playerId && m.powerCounters > 0)
            .map(m => ({ ... })) ?? [];
        
        if (sources.length === 0) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
        }
        
        // 检查是否有足够的随从进行转移（至少需要2个随从：来源+目标）
        const allMyMinions = collectOwnMinions(ctx.state, ctx.playerId);
        if (allMyMinions.length < 2) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
        }
        
        // 创建选择来源随从的交互
        const interaction = createSimpleChoice(...);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    
    // 不在响应窗口中：生成 ARMED 事件（原有逻辑）
    return {
        events: [{
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
            payload: { ... },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}
```

## 测试验证

创建了 `src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts`：

### 测试 1：重返深海

- 在 afterScoring 响应窗口中打出"重返深海"
- 验证：生成 ACTION_PLAYED 事件
- 验证：不生成 SPECIAL_AFTER_SCORING_ARMED 事件
- 验证：不生成 ABILITY_FEEDBACK 事件（因为没有同名随从可以返回）

### 测试 2：我们乃最强

- 在 afterScoring 响应窗口中打出"我们乃最强"
- 验证：生成 ACTION_PLAYED 事件
- 验证：不生成 SPECIAL_AFTER_SCORING_ARMED 事件
- 验证：生成交互（选择转移指示物）

## 测试结果

```
✓ src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts (2 tests) 25ms
  ✓ afterScoring 响应窗口中打出卡牌的执行 (2)
    ✓ 在 afterScoring 响应窗口中打出"重返深海"应该立即执行能力 19ms
    ✓ 在 afterScoring 响应窗口中打出"我们乃最强"应该立即执行能力 5ms

Test Files  1 passed (1)
     Tests  2 passed (2)
```

## 影响范围

- 所有 afterScoring 卡牌在响应窗口中打出时，都会立即执行效果
- 不影响正常出牌阶段打出 afterScoring 卡牌的行为（仍然生成 ARMED 事件）
- 不影响 beforeScoring 卡牌的行为

## 相关文件

- `src/games/smashup/domain/reducer.ts` - PLAY_ACTION 命令处理
- `src/games/smashup/abilities/giant_ants.ts` - 我们乃最强能力实现
- `src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts` - 测试文件

## 下一步

继续修复其他失败的测试：
- `alien-scout-no-duplicate-scoring.test.ts` - 侦察兵 afterScoring 交互导致基地重复记分
