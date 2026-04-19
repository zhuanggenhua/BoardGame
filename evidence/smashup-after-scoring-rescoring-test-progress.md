# 大杀四方 - After Scoring 重新计分测试进展

## 测试创建时间
2026-03-04

## 当前状态
✅ 测试文件已创建并修复编码问题
✅ 测试可以运行
❌ 测试失败：基地只计分了一次，未触发重新计分

## 测试文件
`src/games/smashup/__tests__/afterScoring-rescoring.test.ts`

## 测试场景
1. **基本重新计分**：力量变化后重新计分（当前失败）
2. **无力量变化**：不重新计分（✅ 通过）

## 失败原因分析

### 问题 1：newBaseDeck 未定义错误（已修复）
**错误信息**：
```
ReferenceError: Cannot access 'newBaseDeck' before initialization
at scoreOneBase src/games/smashup/domain/index.ts:454:30
```

**根本原因**：
在打开 afterScoring 响应窗口后提前返回时，尝试返回 `newBaseDeck` 变量，但该变量在后面才定义。

**修复方案**：
在返回前计算 `newBaseDeck`：
```typescript
// 计算 newBaseDeck（替换基地后的牌库）
let newBaseDeck = baseDeck;
if (newBaseDeck.length > 0) {
    newBaseDeck = newBaseDeck.slice(1);
}

return { events, newBaseDeck, matchState: ms };
```

**修复位置**：`src/games/smashup/domain/index.ts` 第 447-461 行

### 问题 2：player_mismatch 错误（当前问题）
**错误信息**：
```
[Pipeline] 命令验证失败: {
  commandType: 'su:play_action',
  playerId: '0',
  error: 'player_mismatch',
  payload: { cardUid: 'c1' }
}
```

**根本原因**：
1. afterScoring 响应窗口打开后，阶段自动推进到 draw → endTurn → startTurn(P1) → playCards(P1)
2. 当前玩家变成了 P1
3. P0 尝试打出卡牌时，验证失败（不是当前玩家）

**问题分析**：
- 响应窗口应该阻止阶段推进，但实际上没有阻止
- 可能是 `flowHalted` 标志没有正确设置
- 或者响应窗口的 `loopUntilAllPass` 逻辑没有正确处理

### 问题 3：只计分了一次
**预期行为**：
1. 第一次计分（初始计分）
2. P0 打出"我们乃最强"，转移指示物
3. 力量变化，触发重新计分
4. 第二次计分（重新计分）

**实际行为**：
- 只有一次 BASE_SCORED 事件
- P0 无法打出卡牌（player_mismatch）
- 没有触发重新计分

## 下一步工作

### 1. 修复响应窗口阻止阶段推进
需要检查：
- `openAfterScoringWindow` 是否正确设置了 `flowHalted`
- ResponseWindowSystem 是否正确处理 afterScoring 窗口
- `onAutoContinueCheck` 是否正确检查响应窗口状态

### 2. 调整测试策略
可能需要：
- 使用不同的测试方法（不依赖响应窗口的自动推进）
- 或者修复响应窗口的阶段推进逻辑

### 3. 验证重新计分逻辑
在响应窗口正确工作后，需要验证：
- 力量变化检测是否正确
- 重新计分是否被触发
- 第二次 BASE_SCORED 事件是否正确发出

## 相关文件
- `src/games/smashup/__tests__/afterScoring-rescoring.test.ts` - 测试文件
- `src/games/smashup/domain/index.ts` - scoreOneBase 函数（已修复 newBaseDeck 错误）
- `src/games/smashup/domain/abilityHelpers.ts` - openAfterScoringWindow 函数
- `src/engine/systems/ResponseWindowSystem.ts` - 响应窗口系统

## 测试日志关键信息
```
[scoreBase] 打开 afterScoring 响应窗口: { baseIndex: 0, playersWithCards: [ '0' ] }
[onPhaseExit] 基地已记分，更新 scoredBaseIndices: { foundIndex: 0, scoredBaseIndices: [ 0 ] }
[FlowSystem][afterEvents] phase updated from=scoreBases to=draw
[FlowSystem][afterEvents] phase updated from=draw to=endTurn
[FlowSystem][afterEvents] phase updated from=endTurn to=startTurn
[FlowSystem][afterEvents] phase updated from=startTurn to=playCards
[Pipeline] 命令验证失败: { commandType: 'su:play_action', playerId: '0', error: 'player_mismatch' }
```

可以看到：
1. afterScoring 响应窗口成功打开
2. 但阶段继续自动推进（scoreBases → draw → endTurn → startTurn → playCards）
3. 当前玩家变成了 P1
4. P0 无法打出卡牌

## 结论
afterScoring 响应窗口的实现基本正确，但响应窗口没有正确阻止阶段推进。需要修复响应窗口的 `flowHalted` 逻辑或 `onAutoContinueCheck` 检查逻辑。
