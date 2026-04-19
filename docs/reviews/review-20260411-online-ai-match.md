# 代码审查报告：在线 AI / Match 进入与恢复链路

日期：2026-04-11  
审查人：AI（code-reviewer 汇总）

## 审查范围
- `src/engine/transport/onlineAiRecovery.ts`
- `src/pages/MatchRoom.tsx`
- `src/engine/transport/server.ts`
- `src/pages/onlineAiForceSkip.ts`
- `src/pages/__tests__/matchSeatValidation.test.ts`

## 结论
发现 1 个高风险问题；已在本次改动中修复。建议合入。

## 发现的问题

### [HIGH] 自动恢复可能在他人交互/响应窗口未完成时推进阶段
- **证据**：`resolveForceEndTurnRecoveryStep` 仅处理“当前 AI 自己”的 interaction/responseWindow，若当前响应者是他人，会直接落到 `ADVANCE_PHASE`  
  - `src/engine/transport/onlineAiRecovery.ts:258-305`
- **影响**：当响应窗口轮到其他玩家（或 pendingDamage 属于他人）时，AI 恢复链路可能越权推进阶段，导致对手响应被跳过。
- **修复**：新增显式守卫：只要存在 pendingDamage/interaction/responseWindow 且不属于该 AI，即返回 `null`，禁止推进阶段。

## 额外对齐
- `resolveForceEndTurnRecoveryStep` 新增 `allowAdvancePhase` 参数，并在客户端/服务端仅在首步且需要确认推进时允许 `ADVANCE_PHASE`：
  - `src/pages/MatchRoom.tsx:551-561`
  - `src/engine/transport/server.ts:894-899`

## 验证
- `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/pages/__tests__/matchSeatValidation.test.ts`

## 建议
- **APPROVE**：高风险推进问题已修复并通过相关测试。
