# Change: update-ai-response-window-stability

## Why
线上反馈显示 DiceThrone 的响应窗口在“跳过后立即重开”场景下会造成循环卡死，且 watchdog 的 loop 检测对 responseWindowId 过敏，兜底容易失效。需要在系统层引入语义去重与 AI 兜底的稳定指纹，避免重复触发与误报，同时不影响真人响应。

## What Changes
- 新增系统层要求：ResponseWindowSystem 需要提供“语义去重/冷却”机制，避免同一语义窗口在短时间内重复 reopen。
- 新增系统层要求：在线 AI watchdog 使用语义 fingerprint（忽略 timestamp 派生 id）判断进展与循环，并保证只对 AI seat 生效。
- 追加对 AI 交互审计与反馈的约束：自动反馈需携带“不可选择原因/响应窗口指纹”。
- 在线 AI watchdog 不再依赖 enableAi 标记启用，改为以 seatControllers 判定是否存在 AI seat。

## Impact
- Affected specs: `systems-layer`
- Affected code: `src/engine/systems/ResponseWindowSystem.ts`, `src/engine/transport/onlineAiRecovery.ts`, `src/engine/transport/server.ts`
