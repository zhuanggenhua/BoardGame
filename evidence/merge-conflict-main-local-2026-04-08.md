# 冲突解决汇报：main-local-2026-04-08

## 1. 背景
- base: `main@85e4513ab54a12c8eac3313ddc29d033c501accc`
- head: `wip/main-pre-pull-2026-04-08@cea1dff0dfe40e4f66d8a01925bc7d7e6f7f89d5`
- 触发命令: `git merge wip/main-pre-pull-2026-04-08 --no-commit --no-ff`
- 目标: 在主工作区拉入远端最新 `main` 的同时，保留本地未提交改动，并用正式冲突处理流程收口。

## 2. 冲突文件
- `src/pages/onlineAiForceSkip.ts`
- `src/pages/__tests__/matchSeatValidation.test.ts`

## 3. 解决策略
### `src/pages/onlineAiForceSkip.ts`
- 策略：保留远端 PR #57 已合入的修复，不恢复 `active-turn` 兜底；同时保留本地 follow-up 机制所需的 `requiresConfirmedAdvancePhase`、`resolveCurrentPlayerId`、`resolveForceAdvancePhaseAfterRecovery`、`resolveForceEndTurnFollowUpAfterConfirmation`。
- 合并要点：
  - `reason` 保持为 `'hidden-interaction' | 'visible-interaction' | 'response-window'`
  - 补回 `resolveCurrentPlayerId()` 辅助函数，供 follow-up ADVANCE_PHASE 判定使用
  - 继续保留“先收口交互/响应窗口，确认后再决定是否推进阶段”的本地逻辑
- 原因：PR #57 已修复“仅凭 active-turn 直接强推 ADVANCE_PHASE”导致的错误回合推进，不能在本地 merge 时回滚掉；但本地后续又引入了更安全的两段式 follow-up 机制，这部分应保留。

### `src/pages/__tests__/matchSeatValidation.test.ts`
- 策略：测试口径与最终实现一致。
- 合并要点：
  - 保留“仅凭轮到 AI 且共享态 8 秒未变化，不应直接强制 ADVANCE_PHASE”这条回归断言
  - 保留本地新增的 follow-up 测试：恢复成功后才单独发 `ADVANCE_PHASE`，且若回合已切走/出现新阻塞则不得继续推进
- 原因：测试要同时覆盖远端回归修复和本地新机制，避免只保其一。

## 4. 风险评估
- 风险点 1：`MatchRoom` 当前已消费 follow-up 逻辑，若 `onlineAiForceSkip.ts` 少任何辅助函数，会在测试或运行时直接抛错。
- 风险点 2：AI 自动恢复逻辑同时涉及 `response-window` 与 `interaction`，后续若再改这里，容易把 PR #57 的回归修复吃掉。
- 风险点 3：`src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts` 是这次自动合并的高风险文件之一，需要确认仍保留 AI 默认延迟 `400` 的预期。

## 5. 回归与行为变化登记
- 原 PR 目标问题：
  - PR #57 修复了 `onlineAiForceSkip.ts` 中残留的 `active-turn` fallback 和对应测试漂移
- 本次额外发现的真实回归：
  - merge 初版遗漏 `resolveCurrentPlayerId()`，导致 `resolveForceAdvancePhaseAfterRecovery` 运行时报 `ReferenceError`
  - 已在本次冲突处理时补回并通过定向测试验证
- 仅业务口径/规则变化：
  - 无新增业务规则变化；本次是保留已 merge 主线修复 + 合回本地后续安全机制

## 6. 验证清单与结果
- `npm run i18n:check` ✅ 通过
- `npx eslint src/pages/onlineAiForceSkip.ts src/pages/__tests__/matchSeatValidation.test.ts` ✅ 通过
- `npx vitest run src/pages/__tests__/matchSeatValidation.test.ts` ✅ 通过（46 tests）
- `npx vitest run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts` ✅ 通过

## 7. 最终提交信息
- commit hash: `6ac96a4f`
- push 目标分支: 本地 `main`（本轮未 push）
