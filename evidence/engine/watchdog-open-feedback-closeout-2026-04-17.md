# Online AI Watchdog 开放反馈收口（2026-04-17）

## 本轮目标
- 收敛当前数据库里仍为 `open/in_progress` 的 watchdog 相关非测试反馈
- 优先处理最高严重度的 Smash Up 失败反馈
- 同时降低 Dice Throne / Summoner Wars 成功恢复反馈继续污染 open backlog 的噪音

## 对应反馈
- `69d8391967274dd3f5abf5ac`
  - game: `smashup`
  - severity: `high`
  - content: `[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed`
- 同源成功恢复噪音：
  - `69db2e348f5a99adb0e6849e`（Dice Throne）
  - `69da8401fde1c16ac1e7ebb8`（Summoner Wars）
  - 以及同类 `force-end-turn-success` 的其余开放项

## 根因结论
1. Smash Up 高严重度失败项的根因不是“AI 当前没有动作”，而是 watchdog 把“AI 回合里已经轮到 human 的可见交互”误判成了 `active-turn` 卡死。
2. 当 shared interaction 已属于 human 时，watchdog 继续发送 `ADVANCE_PHASE` 会被交互门禁拒绝，最终上报 `command_failed`。
3. `force-end-turn-success` 自动反馈本质上是“系统已经恢复成功”的诊断事件；此前默认不带 `status`，会按普通 open bug 落库，持续污染反馈 backlog。

## 代码修改
- `src/engine/transport/onlineAiRecovery.ts`
- `e2e/src/engine/transport/onlineAiRecovery.ts`
  - 若当前 shared visible interaction 已属于 human，`resolveForceEndTurnForStalledAi()` 直接返回 `null`，不再把它误当成 AI active-turn 卡死去推进。
- `src/engine/transport/server.ts`
- `e2e/src/engine/transport/server.ts`
  - watchdog 成功恢复反馈新增 `status: 'resolved'`
  - 默认系统反馈 reporter 在请求体里透传 `status`
- `src/engine/transport/__tests__/server.test.ts`
- `e2e/src/engine/transport/__tests__/server.test.ts`
  - 新增“AI 当前阶段卡在 human 可见交互时不得误发 ADVANCE_PHASE”回归
  - 现有成功恢复断言同步要求 `status: 'resolved'`
- `apps/api/src/modules/feedback/dto.ts`
  - `CreateSystemFeedbackDto` 新增 `status`
- `apps/api/test/feedback.e2e-spec.ts`
  - internal system feedback e2e 覆盖 `status` 可写入

## 验证
- `npx vitest run src/engine/transport/__tests__/server.test.ts apps/api/test/feedback.e2e-spec.ts`
  - 结果：`2` 个测试文件通过，`51` 个测试通过，`0` 失败
- `npm run typecheck`
  - 结果：通过
- `npx eslint src/engine/transport/server.ts src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/server.test.ts e2e/src/engine/transport/server.ts e2e/src/engine/transport/onlineAiRecovery.ts e2e/src/engine/transport/__tests__/server.test.ts apps/api/src/modules/feedback/dto.ts apps/api/test/feedback.e2e-spec.ts`
  - 结果：`0` error，剩余 `4` 条 warning
  - 说明：warning 位于 `src/e2e src/engine/transport/server.ts` 现有 `event as any` 日志段，不是本轮新增逻辑
- `node -`（inline mongoose 查询：统计 open watchdog 数量并列出剩余非测试 open）
  - 结果：`watchdogOpen = 0`
  - 剩余非测试 open 仅 `3` 条，均为 Dice Throne 的人工/真实业务反馈

## 证据说明
- 这轮是引擎/接口逻辑修复，没有前端 UI 改动，因此无截图证据。
- `e2e/src/engine/transport/__tests__/server.test.ts` 已同步改动，但当前仓库默认 `vitest` include 不包含 `e2e/src/**`，无法直接通过现有测试入口运行；本轮用主 `src/engine/transport/__tests__/server.test.ts` 作为真实门禁。

## 状态回写
- 已于 `2026-04-17T13:15:28Z` 将历史遗留的 `15` 条非测试 watchdog open 反馈统一回写为 `resolved`
  - Dice Throne `13` 条 `force-end-turn-success`
  - Summoner Wars `1` 条 `force-end-turn-success`
  - Smash Up `1` 条 `force-end-turn-failed`
- 本地 `temp/feedback-closeout/status-board.json` 已同步补记这些反馈项，避免对话收口与状态板脱节。
- 当前数据库里剩余未收口的非测试 open 反馈只剩 `3` 条，且都不是 watchdog 自动反馈：
  - `69d9ff5a7bee880f344af235`（Dice Throne）`ai卡死`
  - `69d311af73bdf3d33ce99714`（Dice Throne）`打出死亡之眼，日志是执法者，没有触发升级，映射或者配置有问题`
  - `69d3054689362375dcb13890`（Dice Throne）`左轮连射打出了没升级`

## 剩余风险
- 当前修改只阻止“human visible interaction 被误推进”。如果将来出现“human seat 被错误标记成 AI”，watchdog 仍可能误动作，这仍属于 seat controller 真相源问题。
- 剩余 `3` 条 open 都是 Dice Throne 的真实业务/规则反馈，需要单独排查实现或数据，不属于本轮 watchdog 噪音清理范围。
