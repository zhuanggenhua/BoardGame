# SmashUp 在线 AI 自动恢复 E2E 证据

## 范围
- 在线 AI 持有隐藏交互时自动结算
- 在线 AI 卡在 Hoverbot 隐藏交互时 4 秒 force-skip
- 在线 AI 长时间无进展时 8 秒 force-end-turn
- 在线 AI 在 `meFirst` 响应窗口中持有真实响应牌时自动响应并收口

## 实际执行命令
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 持有隐藏交互时应自动 batch 响应并推进状态"`
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 的盘旋机器人隐藏交互卡住时，应在 4 秒后自动跳过并恢复对局"`
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合"`
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 持有真实响应牌时，应在 meFirst 响应窗口内自动响应而不卡死"`
- `npm run test -- src/pages/__tests__/matchSeatValidation.test.ts`

## 关键改动点
1. `submitOnlineAiResolution` 单命令通路继续使用 `state update` 确认，不再误依赖 batch ack。
2. `resolveForceSkippableHiddenAiInteraction` 改为：**只要隐藏交互里显式存在合法 `skip/pass`，即使同时还有其它可执行选项，也允许 watchdog 走 force-skip**。
3. E2E reject patch 同时覆盖 `sendBatch` 和 `sendCommand`，不再漏掉单命令隐藏交互。
4. Hoverbot / force-end-turn 用例不再依赖“注入后立刻已有可见 prompt”的旧假设，而是按 runtime-owned prompt / 在线恢复真实链路验证。

## 截图与肉眼观察

### 1) 隐藏交互自动完成（before）
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-持有隐藏交互时应自动-batch-响应并推进状态\在线-AI-持有隐藏交互时应自动-batch-响应并推进状态-online-ai-hidden-choice-before-resolve.png`

观察：
- 肉眼看到房主视角只有棋盘与 AI 场上单位，没有暴露“选择要牺牲的随从”隐藏 prompt。
- 左上角仍是“对手 / 出牌阶段”，说明此时仍在 AI 行动链中。
- 该图满足“房主看不到 AI 私有隐藏交互”的验收点。

### 2) 隐藏交互自动完成（after）
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-持有隐藏交互时应自动-batch-响应并推进状态\在线-AI-持有隐藏交互时应自动-batch-响应并推进状态-online-ai-hidden-choice-after-resolve.png`

观察：
- 肉眼看到 `Sacrifice` 已进入“已打出”展示，但画面里仍没有残留的隐藏选择框。
- 左上角仍显示“对手 / 出牌阶段”，说明这是 AI 正常继续推进后的状态，而不是房主被卡住。
- 配合 E2E 断言，服务器态中 `interaction.current` 已清空、基地上的 `ai-sacrifice-target` 已被牺牲、AI 手牌拿到 3 张抽牌；达到验收标准。

### 3) Hoverbot force-skip 完成后
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局\在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局-online-ai-hoverbot-force-skip-after-resolve.png`

观察：
- 左上角已经是“回合 4 / 你自己 / 出牌阶段”，说明房主已经重新拿回回合控制权。
- 棋盘上仍只有 Hoverbot 本体，没有额外打出的 `robot_zapbot`，符合“force-skip 选择跳过额外出牌”的预期结果。
- 画面里没有残留的 Hoverbot 选择 prompt，也没有超时失败提示；达到“4 秒 force-skip 解卡并恢复对局”的验收标准。

### 4) force-end-turn 触发前
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合-online-ai-force-end-turn-before-timeout.png`

观察：
- 左上角是“对手 / 出牌阶段”，AI 仍占据当前回合。
- 中央能看到 `Sacrifice` 的“已打出”展示，说明 AI 已经执行到动作链中段，但房主尚未拿回回合。
- 该图能证明 force-end-turn 前确实处于“AI 卡住、但对局还没收口”的真实链路状态。

### 5) force-end-turn 完成后
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合-online-ai-force-end-turn-after-resolve.png`

观察：
- 左上角变成“回合 4 / 你自己 / 出牌阶段”，顶部还出现“轮到你了！”，肉眼可确认控制权已切回房主。
- 画面里没有隐藏交互框，也没有 `AI 强制结束失败` 提示。
- 配合 E2E 断言，服务器态中的 `interaction.current` 已清空且 `isBlocked=false`；达到“8 秒 force-end-turn 收口并恢复房主操作”的验收标准。

### 6) `meFirst` 响应窗口：房主先手
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-持有真实响应牌时，应在-meFirst-响应窗口内自动响应而不卡死\在线-AI-持有真实响应牌时，应在-meFirst-响应窗口内自动响应而不卡死-online-ai-response-window-playable-host-first.png`

观察：
- 左上角是“回合 4 / 你自己 / 基地打分阶段”，说明当前先轮到房主处理 `meFirst` 响应。
- 中央反应选择框同时有 `承受压力->基地1` 和 `过`，底部还能直接看到 `Under Pressure` 本体；这证明房主确实持有真实可响应牌，而不是空窗口。
- 该图达到“先手响应窗口已真实打开，且不是旧测试里那种被系统瞬间 auto-pass 的假场景”这一验收点。

### 7) `meFirst` 响应窗口：AI 已响应并轮回给房主
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-持有真实响应牌时，应在-meFirst-响应窗口内自动响应而不卡死\在线-AI-持有真实响应牌时，应在-meFirst-响应窗口内自动响应而不卡死-online-ai-response-window-playable-after-ai-response.png`

观察：
- 反应选择框仍在，说明窗口没有在 AI 响应后错误消失或卡死。
- 右侧基地顶部计数从前一张图的 `4` 变为 `5`，基地下方蓝色计数也从 `2` 变为 `3`，肉眼可见 AI 的 `Under Pressure` 已实际打出并影响局面。
- 左上角仍是“你自己 / 基地打分阶段”，符合 `meFirst` 链路在 AI 响应后又轮回到房主继续决定的真实顺序。

### 8) `meFirst` 响应窗口：整条响应链收口后
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-持有真实响应牌时，应在-meFirst-响应窗口内自动响应而不卡死\在线-AI-持有真实响应牌时，应在-meFirst-响应窗口内自动响应而不卡死-online-ai-response-window-playable-after-resolve.png`

观察：
- 左上角已经变成“对手 / 出牌阶段”，说明 `meFirst` 响应窗口已完全收口，并顺利回到后续 AI 出牌阶段。
- 画面里不再有反应选择框，证明窗口已经关闭，没有残留 `pass` / `trigger` 交互卡住房主。
- 这张图能直接证明：房主先 `pass`、AI 自动响应、再轮回给房主 `pass` 的完整链路已经结束，没有再卡死在 afterScoring / response window 上。

## 结论
- Hoverbot 卡死场景已经不再停在 8 秒 force-end-turn；现在 4 秒 watchdog 可以直接提交合法 `skip` 做 force-skip。
- 没有显式 skip 的隐藏交互（如 `wizard_sacrifice`）仍会走 8 秒 force-end-turn，避免把“必须做选择”的效果伪装成可跳过。
- `meFirst` 响应窗口的真实响应牌链路也已重新通过，说明这轮修复不只覆盖隐藏交互，还覆盖了 `afterScoring -> meFirst -> AI 真实响应 -> 窗口收口` 这条高风险路径。
- 本轮相关单测 + 4 条定向 E2E 已通过，可以作为这条在线 AI 自动恢复链的当前收口证据。

## 额外发现
- 更大范围回归过程中，曾出现一次与 watchdog 无关的 SmashUp 客户端白屏：浏览器报 `ninjaMasterProgram is not defined`。
- 实际根因不是本轮联机 AI 修复直接打坏，而是当前工作区未提交的 `src/games/smashup/abilities/ninjas.ts` 能力重构里残留了重复的 runtime program 定义，导致 Vite / esbuild transform 失败，浏览器端再表现为加载期 `ReferenceError`。
- 该阻塞清掉后，以下两组最贴近 `afterScoring / meFirst / hidden prompt` 的 SmashUp 单测也重新通过：
  - `npm run test -- src/games/smashup/__tests__/afterScoring-rescoring.test.ts`
  - `npm run test -- src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
