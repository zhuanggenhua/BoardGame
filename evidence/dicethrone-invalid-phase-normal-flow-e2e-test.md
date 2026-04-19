# DiceThrone 正常锁骰流程 invalid_phase 回归验证

## 范围

- 用户反馈的核心问题：`dicethrone` 在“正常锁骰 -> 确认 -> 推进流程”里弹出“当前阶段无法执行此操作”。
- 本轮验证拆成两层：
  - 本地真实 UI 链路：确认进入非掷骰阶段后，骰区和普通投掷/确认按钮已经收紧，不再把非法操作送下去。
  - 联机拒绝恢复链路：首轮 batch 被拒后，客户端会自动恢复并重试，不会长期卡在旧的乐观状态。

## 执行命令

```bash
npm run check:encoding
npm run test -- src/engine/transport/__tests__/patch.test.ts
npm run test -- src/games/dicethrone/__tests__/active-modifiers-undo.test.ts
BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- e2e/dicethrone-toggle-die-lock-normal.e2e.ts "正常锁骰后确认并推进到 main1 时应收紧骰区交互"
BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online AI 首轮 batch 被拒后应自动重试并完成隐藏 multistep-choice"
```

## 截图证据

### 1. 正常锁骰后进入非掷骰阶段，右侧骰区已收紧

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-toggle-die-lock-normal.e2e\正常锁骰后确认并推进到-main1-时应收紧骰区交互\lock-confirm-advance-main1-guarded.png`
- 肉眼观察：
  - 最上方骰子仍带有“已锁定”标识，说明截图确实来自“先锁骰再推进”的真实场景，不是重新造的代理画面。
  - 右下角 `投掷` 与 `已确认` 按钮都处于灰态禁用，不再给普通掷骰/确认入口放行。
  - `下一阶段` 仍保留为当前唯一主操作按钮，说明 UI 已把用户从骰区操作收束到正确的阶段推进入口。

### 2. 联机首轮 batch 被拒后，隐藏多步交互会自动恢复并完成重试

- 拒绝前截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-AI-首轮-batch-被拒后应自动重试并完成隐藏-multistep-choice\15-online-ai-hidden-multistep-rejected-before-retry.png`
- 重试后截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-AI-首轮-batch-被拒后应自动重试并完成隐藏-multistep-choice\16-online-ai-hidden-multistep-after-retry.png`
- 肉眼观察：
  - 两张图都停留在同一条联机隐藏交互场景，右侧骰列和中央 “AI 2号位 正在思考中” 提示保持同一上下文，没有跳到别的页面冒充修复结果。
  - 拒绝前右侧前两颗骰子仍是原始结果，重试后前两颗骰子变成新的成功结果，说明客户端没有被首轮拒绝永久卡死。
  - 页面没有出现额外的 `当前阶段无法执行此操作` 覆盖提示，说明拒绝后的恢复没有把用户界面留在持续报错状态。

## 结论

- `invalid_phase` 这次不是“你点错了”，而是正常流程里前端可操作态/联机乐观态与服务端真实阶段短暂失配时，服务端按既有规则拒绝了命令。
- 现有验证显示两层都已收紧：
  - 非掷骰阶段的普通骰区操作已被 UI 门禁拦住。
  - 联机命令被拒绝后，客户端会 reset optimistic engine 并 `resync()`，不会长期停留在旧阶段幻觉里。
