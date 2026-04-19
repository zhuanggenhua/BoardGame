# 引擎层专项审计：ResponseWindow 重触发 / 立即 reopen / 音效循环（2026-04-12）

## 审计范围

- `src/engine/systems/ResponseWindowSystem.ts`
- `src/engine/transport/onlineAiRecovery.ts`
- `src/engine/transport/__tests__/server.test.ts`

## 问题分类（强口径）

### 1. 系统级：ResponseWindowSystem 对“重复 OPENED”缺少去重

审计结论：
- 旧实现里，`afterEvents()` 只要收到 `RESPONSE_WINDOW_OPENED` 就会重新 `openResponseWindow()`。
- 若同一批事件里出现：
  - 已有窗口时再次收到语义等价 `OPENED`，或
  - `CLOSED` 后立刻又收到语义等价 `OPENED`
- 系统会把窗口重新打开，甚至把已经推进过的 `currentResponderIndex / passedPlayers` 重置。

这类问题的直接表现就是：
- 玩家明明刚点了“跳过响应”，立刻又重新弹响应；
- `RESPONSE_WINDOW_OPENED` 事件被再次消费，音效听起来像“AI 不停点”；
- 若这时 watchdog 也在旁路尝试恢复，就会叠加失败提示噪音。

### 2. 游戏级：领域层可能重复发射窗口事件

审计结论：
- DiceThrone 已对 `afterAttackResolved` 有专门序列去重（`afterAttackResponseWindowSequence`）。
- 但 `afterRollConfirmed / afterCardPlayed` 仍主要依赖领域事件源自己“不重复发射”。
- 所以系统层仍需要有一层“重复 OPENED 防抖”，避免单次逻辑错误直接把 UI/音效打爆。

### 3. AI 行为级：watchdog / AI 动作会放大系统噪音，但不是唯一根因

审计结论：
- `onlineAiRecovery.ts` 之前已加了“当前 responder 是 human 时 watchdog 不出手”的硬门禁；
- 本轮又补了更细的 `response-window fingerprintHint`，让重复 incident 更容易归因到具体 `windowType/sourceId/responderQueue`；
- 但如果系统层允许语义等价窗口重复 reopen，单靠 watchdog 门禁仍不能阻止“human 自己看到的重复弹窗/重复音效”。

## 本轮最小风险修复

### 修复 A：已有窗口时，忽略语义等价的重复 OPENED

位置：`src/engine/systems/ResponseWindowSystem.ts`

判定维度：
- `windowType`
- `sourceId`
- `responderQueue`

明确**不比较**：
- `windowId`（很多重复 reopen 恰恰是新 id）

效果：
- 避免同一窗口在已打开状态下被重复 OPENED 重置进度。

### 修复 B：同一批事件里，若刚 CLOSED 且没有任何非响应窗口业务事件，再收到语义等价 OPENED，则忽略

位置：`src/engine/systems/ResponseWindowSystem.ts`

设计原因：
- 这是专门兜“跳过后立刻 reopen”的系统级故障；
- 只有在 **CLOSED →（无业务进展）→ 等价 OPENED** 时才拦截；
- 若中间出现真实业务事件（例如新的 `ROLL_CONFIRMED`），则允许 reopen，避免误伤合法新窗口。

这条门禁的目标不是替代游戏层修 bug，而是：
- 防止单次重复事件直接把真人体验打爆；
- 给后续继续审计领域事件源留出空间。

### 修复 C：response-window 候选恢复增加更细 fingerprint

位置：`src/engine/transport/onlineAiRecovery.ts`

新增 fingerprint 维度：
- `playerId`
- `windowType`
- `sourceId`
- `responderQueue`

作用：
- 自动反馈/失败 incident 更容易聚合到真实窗口来源；
- 有助于区分“同一个 AI seat 的不同 response-window 故障”。

## 新增验证

测试文件：`src/engine/transport/__tests__/server.test.ts`

新增用例：
1. `当前窗口已存在时，语义等价的 OPENED 事件不应重置响应者进度`
2. `同一批事件中 CLOSED 后紧接语义等价 OPENED 时，不应立即 reopen`
3. `同一批事件中 CLOSED 后若出现非响应窗口业务事件，再收到 OPENED 应允许重新打开`

## 已执行验证

### ESLint
```bash
npx eslint src/engine/systems/ResponseWindowSystem.ts src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/server.test.ts
```

结果：通过

### Vitest
```bash
npm test -- src/engine/transport/__tests__/server.test.ts
```

结果：通过（29 tests）

## 风险与未覆盖项

1. **这不是游戏层重复发窗的最终修复**  
   若领域层每次都重新发一个“语义不同”的窗口（例如 responderQueue 真变了），系统层不会硬拦。

2. **`sourceId` 缺失的窗口只能按 `windowType + responderQueue` 判重**  
   这属于当前事件契约的信息缺口；若后续发现误伤，需要回到领域层补更稳定的 source 语义。

3. **watchdog 仍不是 human 响应场景的主修复手段**  
   human responder 时 watchdog 不出手依然是正确策略；真人可见的重复 reopen 必须优先在系统层/领域层解决。

## 结论

本轮结论不是“所有 response-window 问题都收口了”，而是：

- 已明确把问题拆成 **系统级 / 游戏级 / AI 行为级** 三类；
- 已在引擎层补上最小风险、直接止痛的去重门禁；
- 这条门禁不会主动改写真人对战规则，只拦 **无业务进展的语义等价 reopen**；
- 后续若仍有重触发，优先继续追查具体游戏的事件源，而不是再把问题全部推给 watchdog。
