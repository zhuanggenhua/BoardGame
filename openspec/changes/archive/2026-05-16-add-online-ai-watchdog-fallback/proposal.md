# Change: 在线 AI 服务端兜底 watchdog 与自动反馈

## Why
- 当前在线房间的 AI 仍由房主页面托管，`4 秒自动跳过隐藏交互` 与 `8 秒强制结束回合` 也依赖房主页面上的 `OnlineAiSeatBridge`。一旦房主页面失活、AI seat 凭据失效、或普通 AI 重试链与 watchdog 并发抢同一座位，就会出现“强制结束失败，会继续重试”的噪音提示，且缺少权威侧兜底。
- 用户已经明确反馈：现在最痛的是“AI 卡死后仍弹失败提示”，并希望系统不仅能自动反馈问题，还要有真正独立于房主页面的兜底强制结束能力。

## What Changes
- 新增服务端权威 `online-ai-recovery` 能力：由 `GameTransportServer` 周期性扫描在线房间里的 AI 座位卡死状态，在权威状态上执行最小语义正确的恢复命令，而不是继续依赖房主页面客户端批量提交。
- 将现有客户端 `force-skip / force-end-turn` 逻辑下沉为共享恢复规则，明确“先解卡住，再按最新权威状态多步推进阶段直到安全收口”的两段式恢复模型，避免把 stale recovery batch 与普通 AI 重试链绑在一起。
- 增加自动反馈：当服务端 watchdog 被迫执行强制恢复，或连续恢复失败超过阈值时，系统自动向现有 `/feedback` 管道提交一条结构化问题反馈，带上 `matchId / gameId / seat / reason / stateSnapshot` 等最小复现上下文，并做去重与冷却，避免刷屏。
- 将房主页面上的 `OnlineAiSeatBridge` 保留为次级前端兜底与用户提示层，但不再作为唯一真相来源；当服务端已接管同一 incident 时，前端应降噪，不再反复提示“强制结束失败，会继续重试”。

## Impact
- Affected specs: `online-ai-recovery`
- Affected code: `src/engine/transport/server.ts`、AI 恢复共享逻辑、`src/pages/MatchRoom.tsx`、反馈提交通道与相关测试
