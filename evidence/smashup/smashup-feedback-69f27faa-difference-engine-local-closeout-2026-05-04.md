# Smash Up 反馈 69f27faa 本地验收收口说明（2026-05-04）

## 反馈原文

- `蒸汽朋克卡牌差分机可以无限抽牌`

线上反馈对应：

- feedbackId：`69f27faaab54eadcc2bb2c77`
- gameId：`smashup`
- route：`/play/smashup/match/WWJIlGJSnnt?playerID=0`
- appVersion：`production`

## 线上现场能确认到什么

- `sys.phase = endTurn`
- `sys.flowHalted = true`
- `sys.smashupReactionSession.frameId = turn-end:1:9:0`
- `core.currentPlayerIndex = 1`
- `core.turnOrder = ['0', '1', '2']`
- `core.triggerQueue` 同时存在两条 `onTurnEnd` mandatory trigger：
  - `onTurnEnd:steampunk_difference_engine`
  - `onTurnEnd:tricksters_big_funny_giant`

用户动作日志也直接体现了异常症状：`差分机` 打出后，在同一回合尾连续出现多次“游客6550 抽1张牌”。

## 根因定位

这不是 `steampunk_difference_engine` 自己无限递归，而是 `endTurn` 恢复态被旧逻辑误当成了“新的回合结束入口”：

1. 第一次进入 `endTurn` 时，系统正确收集了本回合尾的 `onTurnEnd` trigger。
2. `Difference Engine` 与 `Big Funny Giant` 的顺序交互结算期间，`flowHalted` 暂停了 phase 推进。
3. 交互收口后，Flow 再次走到 `onPhaseExit(from === 'endTurn')`。
4. 旧逻辑没有识别这是“上一轮 turn-end trigger 已收口后的恢复态”，又重新 `collectTriggers('onTurnEnd')`。
5. 于是同一帧的 `turn-end:1:9:0` trigger 被重复入队，`Difference Engine` 就再次抽牌。

## 事件证据链

现场 `eventStream` 的关键模式是：

1. `SYS_INTERACTION_RESOLVED`
2. `su:trigger_consumed`
3. 紧接着再次出现同一组 `su:trigger_queued`

这说明问题点不在“执行 trigger 结果错误”，而在“已经消费过的同一组 turn-end trigger 被重新排队”。

## 本地修复点

- `src/games/smashup/domain/index.ts`
  - 在 `smashupFlowHooks.onPhaseExit` 的 `from === 'endTurn'` 分支前加入恢复态闸门。
  - 当满足以下条件时，直接视为“上一轮 endTurn trigger/reaction 已经收口”，只发 `SU_EVENTS.TURN_ENDED`，不再重新 `collectTriggers('onTurnEnd')`：
    - `state.sys.flowHalted === true`
    - 当前没有 active interaction
    - 当前没有 `SmashUpReactionSession`
    - `triggerQueue` 中已经没有 `turn-end:` frame
- `src/games/smashup/__tests__/turnCycle.test.ts`
  - 新增最小三人复现用例，锁死“结算完一次 `Difference Engine` 后，不得把同一组 `turn-end:1:9` trigger 再排回队列”。

## 本地验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/turnCycle.test.ts --configLoader native --maxWorkers 1 -t "endTurn 反应交互结算后不会把同一组 onTurnEnd trigger 重新入队|回合结束时额外抽牌超过上限不会停在弃牌，直接进入下一回合"`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionOngoing.test.ts --configLoader native --maxWorkers 1 -t "steampunk_difference_engine"`

结果：

- `turnCycle.test.ts`：`1 file passed / 2 tests passed`
- `expansionOngoing.test.ts`：`1 file passed / 3 tests passed`

## 收口结论

- 当前任务口径下，`resolved` 表示“本地已经修好并完成本地验收”，不代表已上传/已上线。
- 本条已经具备：
  - 线上现场快照；
  - 明确的重复入队根因；
  - 当前代码基线下的最小复现测试与同能力回归测试通过。
- 因此本条可以按本地验收转 `resolved`。
