# DiceThrone AI afterRollConfirmed 真实响应链 E2E 证据

## 覆盖用例
- Online AI afterRollConfirmed: real confirm should let AI打出响应牌并关闭窗口且不重开

## 运行信息
- 命令：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI afterRollConfirmed: real confirm should let AI打出响应牌并关闭窗口且不重开"`
- 环境：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1`
- 时间：
  - 2026-04-14
- 结果：
  - 1 passed

## 截图与肉眼结论

### 1）响应窗口打开态
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-afterRollConfirmed-real-confirm-should-let-AI打出响应牌并关闭窗口且不重开\04b-online-ai-after-roll-response-open.png`
- 我实际看到什么：
  - 右侧出现了响应卡面浮层，说明真人确认骰面后，`afterRollConfirmed` 响应窗口真实打开。
  - 右下“结束攻击”按钮仍为灰态，不是可推进状态，说明当前仍被响应窗口阻塞。
  - 画面中没有“强制结束失败”类提示弹窗。
- 是否达到验收标准：
  - 达到本截图对应标准：成功证明“问题链路确实进入了 AI 响应窗口打开态”。

### 2）AI 打出响应牌后的收口态
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-afterRollConfirmed-real-confirm-should-let-AI打出响应牌并关闭窗口且不重开\04c-online-ai-after-roll-response-resolved.png`
- 我实际看到什么：
  - 右侧响应浮层已经消失，说明 AI 的响应动作已完成并完成收口。
  - 右下“结束攻击”按钮变为橙色可用态，界面回到可继续推进的正常对局态。
  - 顶部 AI 资源从 `10` 变为 `8`，说明 AI 实际支付了资源，不是单纯把窗口强关。
  - 画面中没有平局弹窗、失败提示或新的异常遮罩。
- 是否达到验收标准：
  - 达到本截图对应标准：证明“AI 真实打出响应牌后，窗口能正常关闭且对局未落入脏态”。

### 3）3 秒稳定态，不重开
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-afterRollConfirmed-real-confirm-should-let-AI打出响应牌并关闭窗口且不重开\04d-online-ai-after-roll-response-stable-no-reopen.png`
- 我实际看到什么：
  - 画面与收口态保持一致，右侧没有重新出现响应窗口。
  - “结束攻击”按钮仍保持可用态，没有再次被阻塞。
  - 没有出现“跳过”“强制结束失败”或其他兜底提示弹窗。
- 是否达到验收标准：
  - 达到本截图对应标准：证明 AI 响应收口后至少在本用例监控窗口内保持稳定，没有立刻重开 `afterRollConfirmed` 响应窗口。

## 最终结论
- 本次 afterRollConfirmed 真实 AI 响应链已满足以下验收点：
  1. 真人确认骰面后，真实打开 `afterRollConfirmed` 响应窗口；
  2. AI 不是“被强关”，而是实际打出响应牌并消耗资源；
  3. 响应窗口关闭后界面回到正常可推进状态；
  4. 关闭后至少 3 秒内未再次重开。
- 本轮之前的“收口截图落到平局弹窗脏态”问题已消失，当前证据可用于本链路收口。
