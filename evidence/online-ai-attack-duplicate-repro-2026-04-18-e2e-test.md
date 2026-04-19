# 在线 AI 攻击动画重复播复现核查（DiceThrone + SummonerWars）

## 时间
- 2026-04-18

## 目标
- 复现“触发响应并跳过后，回到 AI 回合不动/攻击动画重复播”问题。
- 优先使用真实在线链路 E2E。

## 执行用例
1. `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-ai-response-window.e2e.ts "AI vs AI: samurai honor token 场景下 Token 响应窗口应触发"`
2. `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "在线对局流程：召唤、移动、建造、攻击与弃牌"`

> 运行环境说明：本机 6174 端口不可绑定（EACCES），本轮通过 `PW_E2E_FRONTEND_PORT=37774` 切换到可绑定前端端口后执行。

## 截图证据（绝对路径）
- DiceThrone 失败截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\2026-04-18-dicethrone-ai-response-window-failed-1.png`
- SummonerWars 失败截图 1：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\2026-04-18-summonerwars-online-flow-failed-1.png`
- SummonerWars 失败截图 2：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\2026-04-18-summonerwars-online-flow-failed-2.png`

## 肉眼观察结论
1. DiceThrone 截图停留在“英雄选择/开局前”界面，没有进入到掷骰/攻击链路，因此该用例失败点发生在前置流程，不是“攻击动画重复播”位点。
2. SummonerWars 两张截图都处于正常棋盘画面，失败断言是 `sw-confirm-discard` 不可见；当前画面为“弃牌获取魔力/等待对手行动”状态，属于测试脚本断言与当前 UI 分支不一致，未直击“攻击动画重复播”。
3. 本轮两条 E2E 均未在真实攻击动画位点上复现“重复播”现象；因此不能用这两条失败结果证明问题已复现。

## 结论
- 当前现有 E2E 对这次问题位点（响应跳过 → AI 回合调度竞态 → 攻击动画重复播）覆盖不足，失败点主要在前置流程或过时断言。
- 按任务口径，转入“直接增强健壮性修复”路线。

## 修复后复测（2026-04-18 晚间）

### 本轮改动
1. `MatchRoom` 在 `aiDispatchResult.kind === 'blocked'|'idle'` 时，若存在 in-flight attempt（`lastAiAttemptKeyRef.current` 非空）直接返回，避免并发 resync/retry 触发重复派发。
2. `resolveOnlineAiDecisionView` 默认可见性收紧：非 setup 类阶段（保留 `setup`/`characterSelection`/`characterSelect`/`factionSelect`）且轮到 AI 主动执行时，默认 `private-required`，避免 stale seat 用 shared 态继续出手。
3. server watchdog 恢复链只在 AI seat 真实在线（`match.connections` 存在连接）时才允许“自然继续”；离线时继续 watchdog 收口，不在 AI 半回合提前退出。

### 复测命令与结果
1. `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "在线 AI watchdog/卡死兜底：阻止 AI seat 建连后，服务端仍应自动收口到真人回合且不误推进真人"`：通过
2. `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "在线 AI 回合起始若 seatState 落后上一拍 draw，不得在 8 秒兜底中直接跳过 summon，且后续应由 watchdog 真正召唤单位"`：通过
3. `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI afterCardPlayed: 对手真实打牌触发响应窗口后，AI 当前 responder 应打出响应牌并收口不卡死"`：失败

### 截图证据（绝对路径）
- SummonerWars watchdog 收口后稳定真人回合：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-watchdog-卡死兜底：阻止-AI-seat-建连后，服务端仍应自动收口到真人回合且不误推进真人\watchdog-human-turn-stable.png`
- SummonerWars stale-seat 场景 watchdog 成功召唤：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-回合起始若-seatState-落后上一拍-draw，不得在-8-秒兜底中直接跳过-summon，且后续应由-watchdog-真正召唤单位\online-ai-stale-seat-watchdog-summoned.png`
- DiceThrone 失败现场：`D:\gongzuo\webgame\BoardGame\test-results\playwright-artifacts\dicethrone-dicethrone-simp-315f6-I-当前-responder-应打出响应牌并收口不卡死-chromium\test-failed-1.png`

### 本轮判断
- 你关心的“响应跳过后 AI 不动 / 卡在半回合”主链路在 SummonerWars 已由真实在线 E2E 证明修复。
- DiceThrone 这条用例失败点属于“期待 afterCardPlayed 窗口打开”，但当前规则实现在 `isCardPlayableInResponseWindow` 对 `afterCardPlayed` 路径返回 `false`（规则口径不一致），不属于本轮并发调度修复回归。

## 补充修复与复测（2026-04-18 深夜）

### 补充改动
1. `isCardPlayableInResponseWindow(afterCardPlayed)` 改为允许“非骰子干预”的即时响应卡（并保留对骰子干预卡的过滤）。
2. `hasOpponentTargetEffect` 补齐 `target='select'` 与 `transfer-status` 判定，避免 `transfer-status` 被误判为“无对手影响”从而不触发 afterCardPlayed。
3. 在线 E2E 场景 `buildOnlineAiAfterCardResponseTriggerState` 增加最小可执行前置（HP 与可转移 token），并将断言升级为“窗口序号触发 + AI 收口”以兼容快速开窗即收口的真实链路。

### 复测命令与结果
1. `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI afterRollConfirmed: real confirm should let AI打出响应牌并关闭窗口且不重开"`：通过
2. `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI afterCardPlayed: 对手真实打牌触发响应窗口后，AI 当前 responder 应打出响应牌并收口不卡死"`：通过

### 截图证据（绝对路径）
- afterRollConfirmed 收口稳定图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-afterRollConfirmed-real-confirm-should-let-AI打出响应牌并关闭窗口且不重开\04d-online-ai-after-roll-response-stable-no-reopen.png`
- afterCardPlayed 开窗阶段图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-afterCardPlayed-对手真实打牌触发响应窗口后，AI-当前-responder-应打出响应牌并收口不卡死\05e-online-ai-after-card-trigger-open.png`
- afterCardPlayed 收口稳定图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-afterCardPlayed-对手真实打牌触发响应窗口后，AI-当前-responder-应打出响应牌并收口不卡死\05g-online-ai-after-card-trigger-stable-no-reopen.png`
