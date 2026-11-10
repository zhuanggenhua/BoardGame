# 线上反馈复查：6ab1564fb4540dce0aeae045

## 反馈原文

> 2v2经常卡住动不了

## 现场与根因

反馈房间 `Y_d7ePnSxtx` 在 `defensiveRoll` 阶段停住。状态同时存在待处理伤害、展示态奖励骰和 Token 响应链；旧恢复路径把“确认奖励骰 / 跳过 Token / 推进阶段”交回普通 AI 合法动作生成，遇到没有可供 AI 生成的普通动作时会反复得到紧急取消或 `unavailable`，玩家看起来无法继续。

## 本地修复

- `src/games/dicethrone/ai.ts:1873`：在 Token 响应动作构建前，先为当前攻击者生成奖励骰确认、重掷和相关卡牌动作，避免把仍未确认的 `pendingBonusDiceSettlement` 当成可直接跳过的 Token 交互。
- `src/engine/transport/onlineAiRecoverySequenceRunner.ts`、`onlineAiManualRecoveryCoordinator.ts`、`server.ts`：手动强制恢复直接执行权威恢复命令；该链保持 `CONFIRM_ROLL -> SKIP_TOKEN_RESPONSE -> ADVANCE_PHASE`，不再依赖普通 AI 合法动作生成。

## 本轮验证

- `src/games/dicethrone/__tests__/ai-main-phase-turn-gating.test.ts`
- `src/engine/transport/__tests__/onlineAiDiceThroneWatchdogRecovery.test.ts`
- `src/engine/transport/__tests__/onlineAiManualRecoveryCoordinator.test.ts`
- `src/engine/transport/__tests__/onlineAiRecoverySequenceRunner.test.ts`
- `src/engine/transport/__tests__/server-command-authority.test.ts`
- 结果：5 个测试文件、50 项通过。
- `git diff --check`：通过。
- 真实反馈状态回放已确认 `accepted=true`，恢复命令按 `CONFIRM_ROLL -> SKIP_TOKEN_RESPONSE -> ADVANCE_PHASE` 收口并清除阻塞字段。

## 线上边界

生产 `boardgame-game-server` 当前镜像 revision 为 `71c367a1e4bd2a8c2e376e3839427de07a93e7f1`。该 revision 已包含既有恢复链部分逻辑，但尚未包含本轮 `src/games/dicethrone/ai.ts` 的 19 行奖励骰优先处理差异；当前生产 health 200、CPU watch 连续正常，但不能据此宣称本修复已在线生效。

因此本条继续保持 `in_progress`，最小补救动作是把本轮差异纳入下一次生产发布，并用同一 DiceThrone 2v2 入口做发布后回放。
