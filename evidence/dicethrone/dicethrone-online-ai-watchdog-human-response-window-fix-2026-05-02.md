# Dice Throne 线上反馈修复：watchdog 误把 human 响应窗口当成 AI 卡死

## 反馈映射

- 反馈 ID：`69f4806c156a1838e4c26dd7`
- 来源：`online-ai-watchdog`
- 自动反馈类型：`force-end-turn-failed`
- 现场关键字段：
  - `phase=offensiveRoll`
  - `responseWindow.windowType=afterRollConfirmed`
  - `responseWindow.responderQueue=['0']`
  - `responseWindow.currentResponderIndex=0`
  - `playerId='3'`
  - `legalActions.total=0`

## 根因

- `src/engine/transport/onlineAiRecovery.ts` 的 `resolveForceEndTurnForStalledAi(...)` 只处理了“当前 responder 是 AI”的 `response-window` 分支。
- 当响应窗口真实当前响应者是 human 时，这个函数不会停下，而是继续掉到 `active-turn-legal-only`。
- 在 Dice Throne 的 `afterRollConfirmed` 现场里，这会把“正在等 human 响应”误报成“AI 当前回合法动作为 0”，最终由 watchdog 上报：
  - `active-turn-legal-only:follow-up-advance:legal_action_unavailable`

## 修复

- 在 `src/engine/transport/onlineAiRecovery.ts` 增加明确门禁：
  - 若当前 `responseWindow` 的 `responderId` 是 human，直接返回 `null`
  - 不再继续回退到 `active-turn-legal-only`
- 同步更新 `src/engine/transport/__tests__/server.test.ts`：
  - 原先把“watchdog 自动强关 human 响应窗口再推进”当成预期的测试，改成“不应误判为 AI 卡死”
  - 补一条更贴线上现场的单测：
    - `offensiveRoll + afterRollConfirmed + responderQueue=['0'] + active AI seat='3'`
    - 期望 `resolveForceEndTurnForStalledAi(...) === null`

## 验证

- 运行：
  - `npx vitest run src/engine/transport/__tests__/server.test.ts -t "(online AI watchdog 在 human 当前响应窗口中不应误判为 AI 卡死|DiceThrone afterRollConfirmed 当前响应者为 human 时，不应回退成 active-turn-legal-only|online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS)"`
  - `npm run typecheck`
- 结果：
  - 3 条目标用例全部通过
  - `typecheck` 通过

## 结论

- 这条修复针对的是“human 正在响应时，server watchdog 不该插手”的 transport 判定错误。
- 它直接覆盖了反馈 `69f4806c156a1838e4c26dd7` 的核心现场。
- 其余未关闭单里：
  - `69f40b9e9efe1f53e1e9c700` 更像 `afterCardPlayed + AI responder/pendingInteractionId` 的另一条响应链问题，不是本次同根现场。
  - `69edd4f3aaf1b13c50d21cf3` 目前更像 action log 观感问题，不像真实“AI 连续两个回合”。
