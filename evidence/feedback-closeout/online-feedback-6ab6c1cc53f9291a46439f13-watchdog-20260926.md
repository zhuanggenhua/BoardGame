# 线上反馈复核：Smash Up online AI watchdog missing-policy

- 反馈 ID：`6ab6c1cc53f9291a46439f13`
- 反馈原文：`[system][online-ai-watchdog] repeated-recovery-force-unblocked visible-interaction:repeat-limit-force-unblock:3/3:commands=SYS_INTERACTION_CANCEL+ADVANCE_PHASE`
- 线上现场：生产 `appVersion=0.6.47`；Smash Up `giant_ant_a_kind_of_magic_distribute` 交互存在合法 `pass`，但 AI diagnostic 标记 `missing-policy`，watchdog 最终强制取消交互并推进阶段。
- 根因判断：当前本地代码已经注册 `smashup-reaction-choice` scorer，并由 Smash Up baseline local policy 使用；生产现场仍报告缺少该策略，直接证据指向生产版本未包含当前本地链，而不是继续新增第二套兜底策略。
- 同类扩审：已检查 reaction timing opportunity、AI policy 注册、合法动作构建、watchdog response-window recovery、重复卡点和 `pass` fallback。
- 验证：
  - `npx vitest run src/games/smashup/__tests__/aiReactionChoiceValidation.test.ts src/games/smashup/__tests__/timingOpportunities.test.ts src/engine/transport/__tests__/onlineAiWatchdogFeedbackAndResponseWindowRecovery.test.ts`：3 files / 35 tests passed。
  - 结果证明本地策略、live candidate 校验和 watchdog 的 response-window 收口链完整；未证明生产 `0.6.47` 已包含当前本地代码。
- 状态：本地已确认修复链；生产待发布/待线上版本复核，不能宣称线上已生效。
