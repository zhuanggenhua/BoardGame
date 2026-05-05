# Dice Throne online AI `pendingInteractionId` hidden response 锁死修复

- 日期：`2026-05-02`
- 关联反馈：`69f40b9e9efe1f53e1e9c700`
- 范围：`src/engine/transport/onlineAiRecovery.ts`、`src/engine/transport/server.ts`

## 现象

- 反馈现场摘要指向 `afterCardPlayed` 响应窗口。
- shared state 仍保留 `responseWindow.current.pendingInteractionId`，但 shared `sys.interaction.current` 已空，`isBlocked` 也不一定为 `true`。
- watchdog 旧逻辑只在 `shared.sys.interaction.isBlocked === true` 时才读取 AI seat overlay，因此会错过真实存在于私有 overlay 的 hidden simple-choice。
- 一旦错过 hidden interaction，后续就会退化成 `response-window -> RESPONSE_PASS`，而不是先把 AI 自己的隐藏交互收口。

## 根因

- hidden interaction 的“需要看 seat overlay”判定过窄，误把 `pendingInteractionId` 锁场景当成普通 response window。
- `resolveForceEndTurnForStalledAi(...)` 与 `GameTransportServer.resolveOnlineAiRecoveryCandidate(...)` 两边都复用了这条过窄判定，导致服务端根本不会准备 AI seatState。

## 修复

- 抽出统一判定 `shouldInspectSeatStatesForHiddenAiInteraction(...)`。
- 只要 shared state 满足以下任一条件，就会去看 AI seat overlay：
  - `shared.sys.interaction.isBlocked === true`
  - `responseWindow.current.pendingInteractionId` 存在
- 在 `pendingInteractionId` 锁场景里，watchdog 会优先尝试 hidden simple-choice 的 `SYS_INTERACTION_RESPOND`，不再直接退成 `RESPONSE_PASS`。

## 验证

- `npx vitest run src/engine/transport/__tests__/server.test.ts -t "(DiceThrone afterCardPlayed 存在 pendingInteractionId 锁时，应优先检查 hidden interaction 而不是退成 RESPONSE_PASS|online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口)"`
- `npx vitest run src/engine/transport/__tests__/server.test.ts -t "(DiceThrone afterRollConfirmed 当前响应者为 human 时，不应回退成 active-turn-legal-only|DiceThrone afterCardPlayed 存在 pendingInteractionId 锁时，应优先检查 hidden interaction 而不是退成 RESPONSE_PASS|online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS|online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口|online AI watchdog 在 response window 先执行非 pass 合法动作时，不应误触发强制关窗)"`
- `npm run typecheck`

## 结论

- 现在 `pendingInteractionId` 锁场景会先走 hidden interaction 收口。
- 已覆盖相邻回归风险：
  - human 当前响应者不应误判成 AI 卡死
  - 普通 AI response window 仍可正常 `RESPONSE_PASS`
  - 先合法动作、后 pass 的 response window 不会被误强关
