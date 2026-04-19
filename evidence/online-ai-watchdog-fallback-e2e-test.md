# online-ai-watchdog-fallback E2E 验证

## 验证目标

- 验证在线 AI 卡死恢复现在由服务端 watchdog 权威兜底，而不是只靠房主前端桥接。
- 验证 DiceThrone 的 `main2` 卡死场景不会只跳过一个阶段停在 AI 侧，而是会真正交还到真人回合链路。
- 验证用户侧不再反复弹出“强制结束失败”类提示。

## 本轮执行

- Vitest：
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1`
  - 结果：`67 passed`
- OpenSpec：
  - `openspec validate add-online-ai-watchdog-fallback --strict --no-interactive`
  - 结果：通过
- E2E：
  - `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online AI 在 DiceThrone main2 阶段持续卡死时，服务端 watchdog 应自动多步收口到我方回合且不再弹失败提示"`
  - 结果：`1 passed`

## 关键截图

### 1. 卡死前（AI 停在 main2）

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-AI-在-DiceThrone-main2-阶段持续卡死时，服务端-watchdog-应自动多步收口到我方回合且不再弹失败提示\19-online-ai-main2-stalled-before-watchdog.png`
- 我实际看到：
  1. 左侧回合顺序高亮停在 `6. 主阶段(2)`，说明场景确实卡在 AI 的 `main2`。
  2. 画面中央有明显的 `AI 2 号位 / 正在思考中` 覆层，说明当前仍处于 AI 卡住前的等待态。
  3. 右侧只看到 `下一阶段`，看不到真人已接管后的正常主阶段手牌操作状态。
- 是否达到验收标准：
  - **否**。这张图是问题起点证据，不是修复完成态。

### 2. watchdog 收口后（回到真人 main1）

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-AI-在-DiceThrone-main2-阶段持续卡死时，服务端-watchdog-应自动多步收口到我方回合且不再弹失败提示\20-online-ai-main2-stalled-after-watchdog.png`
- 我实际看到：
  1. 左侧回合顺序高亮已经切到 `3. 主阶段(1)`，不再停在 AI 的 `main2 / discard`。
  2. 左下角真人资源区显示 `生命 50 / CP 2`，下方手牌已经展开，说明已经回到真人可继续操作的正常主阶段链路。
  3. 画面中没有出现“强制结束 AI 回合未成功”“recover-interaction 失败”“follow-up-advance 失败”等失败提示。
  4. 右侧 `下一阶段` 按钮可见，说明链路没有被 watchdog 收口后再卡死。
- 是否达到验收标准：
  - **是**。这张图证明服务端 watchdog 没有只跳过一个 AI 阶段，而是把流程真正交还给了真人回合，并且用户侧没有再被失败 toast 轰炸。

## 额外结论

- 本轮 E2E 在第一次失败时暴露过一个**测试注入态的 `sys.currentPlayerIndex` 元数据陈旧**现象，但它不影响本次真实验收标准：
  - 服务端 watchdog / human 门禁判断走的是当前权威玩家 ID；
  - 最终 UI 已实际回到真人 `main1`，且可以继续操作。
- 因此，本轮结论以“是否真正回到真人可继续操作的回合链路 + 是否不再弹失败提示”为准，已达标。
