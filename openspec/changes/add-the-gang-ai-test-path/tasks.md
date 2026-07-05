## 0. Approval Gate
- [x] 0.1 Approval Gate：`add-the-gang-ai-test-path` 的 proposal / design / tasks / spec delta 支持基础版完整闭环中的玩家可见本地 AI baseline：本地 AI 只从合法动作集合中选择筹码或公共推进动作；强策略、难度、搜索和隐藏信息采样属于后续 AI 强化，不阻塞基础版完成。用户已明确本轮判断口径是“不是所有扩展，而是全部基本功能都能完成”，因此本 Approval Gate 关闭。

## 1. Implementation
- [x] 1.1 Add The Gang local AI legal-action builder for chip choice and public progression commands
- [x] 1.2 Add baseline policy that selects only from current legal actions
- [x] 1.3 Register The Gang AI runtime and enable `manifest.ai.localAi`
- [x] 1.4 Add tests covering chip selection, occupied-chip exclusion, progression commands, and policy legality
- [x] 1.5 Update The Gang capability-alignment docs

## 2. Verification
- [x] 2.1 `openspec validate add-the-gang-ai-test-path --strict --no-interactive`
- [x] 2.2 `npx vitest run src/games/the-gang --configLoader native`
- [x] 2.3 `npx eslint src/games/the-gang --ext .ts,.tsx`
