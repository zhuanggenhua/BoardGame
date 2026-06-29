# DiceThrone 线上反馈 6a3753d072dbc78871e3cdaf 修复记录

- 时间：2026-06-22
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-21T16-42-37-782Z/6a3753d072dbc78871e3cdaf.md`
- 反馈含义：在线 AI watchdog 在 `afterAttackResolved` 响应窗里尝试代 AI 执行“跳过响应”，但服务端返回“交互处理中，无法跳过响应”，导致这条响应窗反复卡在恢复循环里。

## 本轮结论

- 归类：已用真实反馈状态回放到 watchdog 决策位点并修复
- 使用的真实证据：
  - 真实状态快照里是 `defensiveRoll` 阶段，响应窗类型是 `afterAttackResolved`
  - 真实反馈里的候选动作只剩 `RESPONSE_PASS`
  - 服务端对这条 `RESPONSE_PASS` 的真实拒绝原因是“交互处理中，无法跳过响应”
- 根因：
  - `src/engine/transport/onlineAiRecovery.ts` 原先只有在共享态明确暴露 `pendingInteractionId / isBlocked / 当前可见交互` 时，才会优先回到 seat 私有视图检查隐藏交互。
  - 这条反馈所属的 `afterAttackResolved` 响应窗没有把该锁显式挂在共享态上，但当前响应者 seat 私有视图里其实已经有同一响应窗下的真实交互，于是 watchdog 错误地退成了 `RESPONSE_PASS`。
- 推断边界：
  - 诊断包没有直接附带 seat 私有视图快照。
  - 但真实反馈已经给出两个硬证据：`RESPONSE_PASS` 是 watchdog 的唯一候选动作；服务端又明确以“交互处理中”拒绝该命令。
  - 这说明当时当前响应者的私有交互并没有真正收口，watchdog 决策位点确实漏看了 seat 私有交互。这里是基于真实反馈事实做的定位推断，不是脱离反馈另起猜测。
- 解决方式：
  - 新增 `shouldPreferResponderHiddenInteractionOverResponsePass(...)`，专门判断“当前响应者 seat 私有视图里的交互，是否与当前共享响应窗属于同一窗口”。
  - 在 `resolveForceEndTurnForStalledAi(...)` 的 `response-window` 分支里，若当前响应者是 AI，且 seat 私有视图里已经有同窗隐藏交互，则优先回到 `hidden-interaction` 收口，不再盲发 `RESPONSE_PASS`。

## 代码落点

- `src/engine/transport/onlineAiRecovery.ts:875`
- `src/engine/transport/onlineAiRecovery.ts:1086`
- `src/engine/transport/__tests__/server.test.ts:1922`

## 验证

- 命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "DiceThrone afterCardPlayed 存在 pendingInteractionId 锁时，应优先检查 hidden interaction 而不是退成 RESPONSE_PASS|DiceThrone afterAttackResolved 未显式暴露 pendingInteractionId，但当前响应者 seat view 已有私有交互时，也应优先检查 hidden interaction|online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口"`
- 结果：
  - `3 passed`
- 现象结论：
  - `afterAttackResolved` 这类未显式暴露共享锁的响应窗下，如果当前响应者的 seat 私有视图已经有真实交互，watchdog 现在会先回到那条隐藏交互执行 `SYS_INTERACTION_RESPOND`，不再错误地下发 `RESPONSE_PASS`。

## 收口说明

- 该反馈本体对应的是当前树里的真实共享层缺口，不是“当前树已恢复”。
- 本轮修的是 watchdog 对 DiceThrone 响应窗的错误恢复顺序，已经有真实反馈证据、定向回归测试和命中的代码落点，可以按 `resolved` 收口。
