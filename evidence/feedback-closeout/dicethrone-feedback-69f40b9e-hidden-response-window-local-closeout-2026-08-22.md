# DiceThrone 本地反馈收口：我的回合 AI 强制结束失败且无法点击下一阶段

- 反馈 ID：`69f40b9e9efe1f53e1e9c700`
- 本轮口径：本地 Mongo 反馈库，`mongodb://127.0.0.1:27017/boardgame.feedbacks`
- 反馈原文：`在我的回合ai强制结束失败而我无法点击下一阶段，刷新后出现的`
- 目标入口：DiceThrone 在线 AI watchdog / 响应窗口恢复
- 验收口径：玩家已经回到自己的 `main1` 时，若旧响应窗口仍锁在 AI 的隐藏交互上，服务端恢复应先执行当前 AI responder 的隐藏交互并关闭窗口，不能退成 `RESPONSE_PASS` 或裸强推真人阶段。

## 真实反馈状态

保存的反馈快照命中用户原话里的“我的回合但无法点下一阶段”：

- 当前阶段：`sys.phase = main1`
- 当前行动玩家：`core.activePlayerId = "0"`，且 `seatControllers["0"].type = "human"`
- 没有公开交互：`sys.interaction.current = null`
- 没有流程暂停：`sys.flowHalted = false`
- 没有攻击待处理：`core.pendingAttack = null`
- 响应窗口仍残留：`sys.responseWindow.current.id = afterCard-action-poison-tip-1777601347690`
- 窗口队列：`responderQueue = ["2", "3"]`
- 已让过玩家：`passedPlayers = ["2"]`
- 当前 responder：`currentResponderIndex = 1`，即 AI 玩家 `3`
- 窗口锁定的隐藏交互：`pendingInteractionId = card-bye-bye-1777601349600`

事件流尾部显示链路是：

- AI 玩家 `1` 打出 `action-poison-tip`，打开 `afterCardPlayed` 响应窗口。
- AI 玩家 `2` 响应打出 `card-super-double` 后，窗口推进到 AI 玩家 `3`。
- AI 玩家 `3` 打出 `card-bye-bye`，创建 `card-bye-bye-1777601349600` 的状态选择交互。
- 快照里只有 `STATUS_REMOVED`，没有后续 `INTERACTION_COMPLETED` / `RESPONSE_WINDOW_CLOSED`，所以玩家回到 `main1` 后仍被旧响应窗口挡住。

## 分层结论

- 现实故障现象：玩家已经在自己的主要阶段，但下一阶段入口被旧响应窗口阻塞。
- 直接条件：旧 `afterCardPlayed` 响应窗口还挂着 `pendingInteractionId`，当前 responder 是 AI 玩家 `3`。
- 可验证机制：玩家公开视图看不到 AI 玩家 `3` 的私有交互，只看到响应窗口仍锁住；watchdog 必须按当前 responder 读取 AI `3` 的私有视图，先收口 `card-bye-bye` 隐藏交互，再让响应窗口关闭。
- 当前树结论：当前实现已经能按上述机制恢复；本轮没有改业务实现，只把既有 server watchdog 回归测试改成与该反馈一致的四人队列形状，避免以后退回为单 responder happy path。

## 本轮改动

- `src/engine/transport/__tests__/server.test.ts`
  - 将 `pendingInteractionId 锁住 response window` 用例改成真实反馈形状：`responderQueue = ["2", "3"]`、`currentResponderIndex = 1`、`passedPlayers = ["2"]`、当前隐藏交互属于 AI 玩家 `3`。
  - 补齐四座位测试元数据：玩家 `0` 是 human，玩家 `1/2/3` 是 local-ai。
  - 保留断言：第一条恢复命令必须是 `SYS_INTERACTION_RESPOND`，不得退成 `RESPONSE_PASS`；自动反馈落在 AI 玩家 `3`。
  - 补齐旧直接单元测试里的 `passedPlayers` 字段，避免裁判快照在非真实夹具上报错。

## 验证

首跑暴露夹具不足：

```text
node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "pendingInteractionId 锁住 response window"

failed: window.passedPlayers is not iterable
```

补齐 `passedPlayers` 后，四人真实形状继续验证恢复方向：

```text
failed: expected 'SYS_RESPONSE_WINDOW_FORCE_CLOSE' to be 'SYS_INTERACTION_RESPOND'
```

继续补齐四座位元数据后，当前树按真实 responder 收口：

```text
node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "pendingInteractionId 锁住 response window"

1 file passed / 1 passed / 280 skipped
candidateReason = hidden-interaction
playerID = 3
incidentKind = force-end-turn-success
```

相邻验证：

```text
node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "DiceThrone afterCardPlayed 存在 pendingInteractionId"

1 file passed / 1 passed / 280 skipped
```

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts --configLoader native -t "本地 AI 打出拜拜了您嘞后应移除状态"

1 file passed / 1 passed / 24 skipped
```

静态检查：

```text
npx eslint src/engine/transport/__tests__/server.test.ts

passed
```

## 结论

本条反馈按“当前树已恢复 / 已失效”收口：真实快照里的卡住点是旧响应窗口锁在 AI 玩家 `3` 的隐藏状态选择交互上；当前服务端恢复已经能读取 AI `3` 的私有视图并先执行隐藏交互，再关闭窗口，不会直接让玩家回合裸推进或退成响应让过。本轮补强了与真实四人队列一致的回归覆盖。
