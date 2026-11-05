# 线上反馈 6ac3cb218e134ec1dfb102ee：Dice Throne AI 转移状态卡死

## 反馈原文

`[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:legal_action_command_failed`

来源：2026-10-06 重新读取生产 `https://api.easyboardgame.top/admin-api/feedback` 的反馈记录。

## 发现的问题

- 真实现场是 Dice Throne 对局 `mVdDzi2N0ep`，`main1`，`playerId=1`，交互 `dt-interaction-card-transfer-status-1791216416534`。
- 诊断快照显示 `dt:card-interaction` 的可见选项为空，但 AI legal actions 仍包含“转移 `targeted` 到 0”，并把该动作作为 chosen action。
- 重放确认：player 1 的 `targeted` 可以被转出，但 player 0 的 `targeted` 已达到 `stackLimit=1`；旧 AI 仍生成该目标，领域执行没有产生状态变化或事件，交互保持打开，随后 watchdog 报告 `legal_action_command_failed`。
- 这是同一根因造成的 AI 静默 no-op，不是卡牌规则允许后仍无法推进的独立问题。

## 处理方式 / 修复结果

- `src/games/dicethrone/domain/statusRemoval.ts` 新增 `canReceiveTransferredStatus`，统一判断目标状态容量。
- `src/games/dicethrone/domain/commandValidation.ts` 在 `TRANSFER_STATUS` 目标已满时直接拒绝并返回 `invalid_status`，不再执行无状态变化命令。
- `src/games/dicethrone/ai.ts` 过滤不可转移状态与已满目标，AI 不再生成该静默 no-op；若没有可行选项则进入已有的交互取消路径。
- `src/engine/ai/types.ts`、`src/engine/ai/snapshots.ts` 与 `src/engine/transport/onlineAiWatchdogFeedbackDiagnostics.ts` 补充诊断语义：自定义 `dt:card-interaction` 未投影 options 时记为 `options-not-projected`，不再误报为真实 `empty-options`。

## 验证

- `npm run typecheck`：通过。
- Dice Throne 基础命令覆盖：166 项通过。
- watchdog diagnostics 定向回归：6 项通过。
- `npm run test:ai:decision-view`：60 个测试文件、649 项通过。
- 定向 ESLint：0 errors。
- 旧现场重放已证明旧逻辑会生成 `targeted -> player 0` no-op；修复后目标容量检查与 AI 过滤共享同一判断源。

## 当前状态与边界

- 本地根因已修复，线上反馈可标记 `resolved`。
- 生产运行中的 bundle 尚未在本轮发布；因此“已解决”表示根因与回归已完成，不表示当前线上旧版本已经生效。发布后仍需回查生产版本与同类 watchdog 是否不再生成该动作。

## 漏审复盘

- 旧逻辑只验证了“来源状态可移除”，没有把目标 stack limit 纳入 AI 候选与命令验证的共享合同，导致合法动作枚举与领域可执行性脱节。
- 现有规则/AI 回归未覆盖“来源有状态、目标同状态已满”的转移组合；本轮补入该边界和 diagnostics 回归，属于测试缺口与共享容量合同执行缺口，不新增第二套真相源。
