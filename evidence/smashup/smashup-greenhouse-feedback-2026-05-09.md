# SmashUp 温室反馈收口证据

## 范围

- 反馈：`69fec94df0a61f28ba015d49`
- 游戏：`smashup`
- 线上局：`7IdDUKULSt9`
- 问题：`base_greenhouse` afterScoring 触发后反馈为“温室 bug 无法执行”。

## 线上现场

生产 Mongo 快照显示：

- 当前阶段：`scoreBases`
- 当前交互：无
- `triggerQueue`：存在 `afterScoring:base_greenhouse:0:0`
- 触发排名：玩家 2 第一，玩家 2 牌库中有多个随从
- 该线上快照的 `effectContract.reads` 仍只有 `deckState`

本地当前实现中，温室的 effect contract 已覆盖 `deckState` 与 `controllerState`，并且 afterScoring 选择、替换基地后落地、收口链路已有回归覆盖。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterScoring-rescoring.test.ts --configLoader native --maxWorkers 1 -t "base_greenhouse"`
  - 结果：1 passed。
  - 肉眼核对：覆盖温室 afterScoring 选牌落地后正常收口，不会卡在 `scoreBases`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native --maxWorkers 1 -t "base_greenhouse"`
  - 结果：4 passed。
  - 肉眼核对：覆盖温室生成交互、过期牌不再打出、replacement follow-up 写入 scoring session、queued reaction 选择温室不被 effect contract 拦截。

## 结论

该反馈对应的线上快照仍处在旧 contract/待推进状态；当前本地实现与回归测试已覆盖温室可执行与收口链路，可回写为 `resolved`。
