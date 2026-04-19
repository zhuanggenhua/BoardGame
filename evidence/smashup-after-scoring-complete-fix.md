# 大杀四方 - After Scoring 响应窗口完整修复

## 更新时间
2026-03-04 19:55

## 问题总结

1. ✅ **consecutivePassRounds 逻辑** - 已修复并验证
2. ✅ **重新计分逻辑** - 已实现并验证执行
3. ⏳ **测试用例** - 需要更新（使用会改变总力量的卡牌）

## 1. consecutivePassRounds 修复

### 问题
afterScoring 响应窗口使用 `loopUntilAllPass` 模式时，窗口在玩家能够响应之前就立即关闭了。

### 解决方案
添加 `consecutivePassRounds` 计数器，只有连续两轮所有人都 pass 才关闭窗口。

### 测试结果
✅ 逻辑工作正常，从测试日志可以看到窗口正确地在连续两轮 pass 后关闭。

## 2. 重新计分逻辑实现

### 问题
响应窗口关闭后，重新计分逻辑没有执行。

### 根本原因
`onAutoContinueCheck` 返回 `undefined` 时，`FlowSystem` 不会再次调用 `onPhaseExit`。

### 解决方案
修改 `onAutoContinueCheck` 逻辑：当检测到 `afterScoringInitialPowers` 时，返回 `autoContinue: true`，触发 `ADVANCE_PHASE`，这会再次调用 `onPhaseExit`，重新计分逻辑会执行。

```typescript
if (state.sys.flowHalted && !state.sys.interaction.current && !state.sys.responseWindow?.current) {
    if ((state.sys as any).afterScoringInitialPowers) {
        console.log('[onAutoContinueCheck] scoreBases: 检测到 afterScoringInitialPowers，自动推进触发重新计分');
        return { autoContinue: true, playerId: pid };
    }
    return { autoContinue: true, playerId: pid };
}
```

### 测试结果
✅ 重新计分逻辑执行成功！从测试日志可以看到：
1. `[onAutoContinueCheck] scoreBases: 检测到 afterScoringInitialPowers，自动推进触发重新计分`
2. `[FlowSystem][afterEvents] autoContinue from=scoreBases playerId=0`
3. `[onPhaseExit] 检查 afterScoring 后力量变化: { baseIndex: 0, initialPowers: { '0': 13, '1': 10 } }`

## 3. 测试用例问题

### 问题
测试仍然失败（只有 1 次 BASE_SCORED 而不是 2 次）。

### 原因
"我们乃最强"卡牌转移力量指示物时，**不改变玩家的总力量**（只是在同一玩家的随从之间重新分配），所以重新计分逻辑检测到力量没有变化，不发出第二次 BASE_SCORED 事件。

### 解决方案
需要更新测试用例，使用会改变总力量的卡牌（如添加/移除随从、添加/移除力量指示物到不同玩家的随从）。

## 当前状态

✅ `consecutivePassRounds` 逻辑已实现并验证
✅ 重新计分逻辑已实现并验证执行
✅ `onAutoContinueCheck` 修复已实现
⏳ 测试用例需要更新

## 下一步工作

1. 更新测试用例（使用会改变总力量的卡牌）
2. 清理调试日志
3. 更新现有测试（替换 `'meFirst'` → `'beforeScoring'`）
4. 创建 E2E 测试验证完整流程

## 相关文件

- `src/engine/types.ts` - ResponseWindowState 类型定义
- `src/engine/systems/ResponseWindowSystem.ts` - 响应窗口系统实现
- `src/games/smashup/domain/index.ts` - onPhaseExit 和 onAutoContinueCheck（已修复）
- `src/games/smashup/__tests__/afterScoring-rescoring.test.ts` - 测试文件（需要更新）
- `evidence/smashup-after-scoring-consecutivePassRounds-fix.md` - 详细分析文档

