## Context
- DiceThrone 响应窗口在“跳过后立即 reopen”场景下出现循环卡死。
- watchdog 的 loop 检测依赖 progress marker，当前包含 responseWindowId（通常带 timestamp），导致重复 reopen 时无法判定“无进展”。
- 需保证真人响应不被 AI 兜底误触发。

## Goals / Non-Goals
- Goals:
  - 响应窗口具备“语义去重/冷却”能力，避免同语义窗口在短周期内重复 reopen。
  - watchdog 对响应窗口循环具备稳定语义指纹，能识别无进展而不依赖窗口 id。
  - AI 兜底只对 AI seat 生效，确保真人响应不被跳过。
- Non-Goals:
  - 不改变游戏规则与响应窗口的业务语义。
  - 不引入新的 UI 交互形态。

## Decisions
- Decision: 在 ResponseWindowSystem 中加入“语义 fingerprint”与冷却/去重判定。
  - Why: 只靠 windowId/sourceId 无法避免 reopen；语义层指纹能稳定识别重复。
- Decision: watchdog 进展标记使用“语义 fingerprint + phase + currentPlayerId”，忽略 timestamp 派生字段。
  - Why: responseWindowId 变化不应视为“进展”。

## Risks / Trade-offs
- 过度去重可能屏蔽真实新窗口（例如不同卡牌但语义相同）。
  - 缓解：指纹可包含窗口类型 + responderQueue + 可选 sourceId，支持按游戏层配置。

## Migration Plan
- 引擎层先提供可选配置，不强制所有游戏立刻启用。
- DiceThrone 先启用语义去重；其他游戏按审计结果逐步打开。

## Open Questions
- 是否需要在游戏层提供“fingerprintBuilder”以纳入更多业务语义？
- 是否需要为响应窗口加“max reopen count / cooldown time”？
