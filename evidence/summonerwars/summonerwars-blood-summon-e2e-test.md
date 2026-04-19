# Summoner Wars 事件卡：血契召唤收口链路 E2E 证据（2026-04-12）

## 运行命令
- `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "事件卡：血契召唤收口流程"`

## 复跑记录
- 2026-04-13 05:04（Asia/Shanghai）：复跑通过（收口断言收紧为：服务器权威状态中 `interactionClosed` + 召唤落点单位出现 + 目标伤害 +2；若应致死则目标被移除）。

## 关键截图与观察
1. D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\事件卡：血契召唤收口流程\event-blood-summon-confirm-step.png
   - 横幅提示“血契召唤 1 次，是否继续？”且同时出现“继续/完成”按钮，说明目标选择 → 选卡 → 选落点三步链路已结束并进入确认阶段。
   - 画面未出现遮挡或错位，交互按钮清晰可见（调试面板已关闭；仍有手牌卡面预览悬浮，但不遮挡横幅按钮）。

2. D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\事件卡：血契召唤收口流程\event-blood-summon-finish-state.png
   - “继续/完成”确认横幅已消失，交互已收口（画面仍保留手牌卡面预览悬浮，但无交互横幅残留）。
   - 顶部日志提示“从手牌召唤单位到…”，与血契召唤结算一致。
   - 召唤落点与目标伤害由服务器权威状态断言补证（详见下方结论）。

## 结论
- 血契召唤事件卡在 InteractionSystem 下可完成“确认 → 收口”链路，E2E 断言已覆盖：服务器权威状态中交互已关闭 + 召唤落点单位出现 + 目标伤害 +2（若应致死则移除）。视觉证据显示收口态横幅消失并出现召唤日志，**满足 bloodSummon 人工 E2E 收口要求**。
