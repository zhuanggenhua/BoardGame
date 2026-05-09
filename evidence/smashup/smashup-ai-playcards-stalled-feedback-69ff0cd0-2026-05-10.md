# SmashUp 线上反馈 69ff0cd0 AI 出牌阶段卡死收口

## 反馈范围

- 反馈 ID：`69ff0cd0f0a61f28ba0169e9`
- 用户内容：`ai卡死`
- 数据来源：生产 Mongo 真实反馈快照，详见 `temp/feedback-closeout/query-feedback-smashup-remaining-two-20260510.raw.txt`
- 核对时间：`2026-05-10 04:42:47 +08:00`

## 现场结论

生产快照停在 SmashUp `playCards`：

- `currentPlayerIndex=1`，当前行动者为 AI 玩家 `1`
- `flowHalted=false`
- `interaction.current=null`
- `responseWindow.current=null`
- `triggerQueue=[]`
- 玩家 `1` 手牌全为随从，`minionsPlayed=2` 且 `minionLimit=2`
- 玩家 `1` `actionsPlayed=0/actionLimit=1`，但手牌没有可直接打出的行动牌

这不是交互链遗留，也不是 response window 卡住；核心风险是 AI 在普通出牌阶段没有可打牌时必须仍能走结束阶段兜底。

## 当前实现核对

- `src/games/smashup/ai.ts` 的 `buildSmashUpAiLegalActions()` 在 `playCards` 阶段会追加 `buildAdvancePhaseAction()`。
- `src/engine/ai/localRunner.ts` 对单一 `advance-phase` 动作有快速通道，会直接返回 `ADVANCE_PHASE`，不再等待策略模型。
- `src/engine/transport/onlineAiRecovery.ts` 对 active AI 普通阶段保留 `active-turn -> ADVANCE_PHASE` 的 watchdog 兜底。

因此该反馈场景已被当前代码覆盖。本轮补充了以反馈 ID 命名的回归用例，防止后续把 AI 无动作结束阶段路径删掉。

## 验证

命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native --maxWorkers 1 -t "69ff0cd0"
```

结果：`1 passed`。

命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts --configLoader native --maxWorkers 1 -t "69ff0cd0|base_the_mothership"
```

结果：`6 passed`。

命令：

```bash
npx eslint src/games/smashup/__tests__/scoreBases-auto-continue.test.ts e2e/src/games/smashup/__tests__/scoreBases-auto-continue.test.ts
```

结果：`0 errors`。

## 残余风险

本次只覆盖“无交互、无响应窗口、轮到 AI 的普通出牌阶段”。如果后续出现 private overlay stale、隐藏交互或 response window 场景，应按在线 AI 决策视图与 watchdog recovery 另行分诊，不能复用本结论。
