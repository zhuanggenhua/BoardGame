# 在线反馈收口（2026-04-19）

## 收口目标
- `69e31a8779d1f631af8a223b`（DiceThrone）：`防御投掷卡死`
- `69e32b6159cdf8918cf62f85`（SummonerWars）：`ai强制结束回合了，而且召唤也没有，移动好像也卡好几秒`

## 本轮验证命令（2026-04-19）
1. `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "在线 AI 回合起始若 seatState 落后上一拍 draw，不得在 8 秒兜底中直接跳过 summon，且后续应由 watchdog 真正召唤单位"`
2. `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI afterRollConfirmed: real confirm should let AI打出响应牌并关闭窗口且不重开"`

> 运行参数一致：`PW_E2E_SERVICE_REUSE=shared-single`，`PW_E2E_FRONTEND_PORT=37774`，`PW_E2E_GAME_SERVER_PORT=32000`，`PW_E2E_API_SERVER_PORT=32100`。

## 截图证据（绝对路径）
### SummonerWars（对应 69e32b6159cdf8918cf62f85）
- 触发前：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-回合起始若-seatState-落后上一拍-draw，不得在-8-秒兜底中直接跳过-summon，且后续应由-watchdog-真正召唤单位\online-ai-stale-seat-before-guard.png`
- watchdog 检查中：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-回合起始若-seatState-落后上一拍-draw，不得在-8-秒兜底中直接跳过-summon，且后续应由-watchdog-真正召唤单位\online-ai-stale-seat-after-guard.png`
- watchdog 召唤后：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-回合起始若-seatState-落后上一拍-draw，不得在-8-秒兜底中直接跳过-summon，且后续应由-watchdog-真正召唤单位\online-ai-stale-seat-watchdog-summoned.png`

我实际看到：
1. 前两张图上方敌方单位数量一致，仍处于 `summon` 阶段，属于“卡住待恢复”状态。
2. 第三张图顶部多出一张新单位卡（与前两张相比新增），说明 watchdog 后续确实执行了召唤，而不是直接跳过。
3. 全程未出现“强制结束回合失败”类报错提示，流程仍可继续。

### DiceThrone（对应 69e31a8779d1f631af8a223b）
- 响应窗口打开：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-afterRollConfirmed-real-confirm-should-let-AI打出响应牌并关闭窗口且不重开\04b-online-ai-after-roll-response-open.png`
- 响应收口：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-afterRollConfirmed-real-confirm-should-let-AI打出响应牌并关闭窗口且不重开\04c-online-ai-after-roll-response-resolved.png`
- 收口后稳定：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-afterRollConfirmed-real-confirm-should-let-AI打出响应牌并关闭窗口且不重开\04d-online-ai-after-roll-response-stable-no-reopen.png`

我实际看到：
1. `04b` 时右侧响应/控制区域处于处理中状态，链路已进入响应窗口。
2. `04c` 出现“AI 强制结束回合 / 已强制结束回合”提示，且主流程仍保持可见，没有白屏或死锁。
3. `04d` 与 `04c` 相比未出现响应窗口回弹，说明“收口后重开卡死”未复现。

## 收口结论
- 两条 open 反馈在当前实现 + 本轮真实在线 E2E 复跑下均已达到“可复查收口”条件。
- 建议数据库状态：
  - `69e31a8779d1f631af8a223b` → `resolved`
  - `69e32b6159cdf8918cf62f85` → `resolved`
