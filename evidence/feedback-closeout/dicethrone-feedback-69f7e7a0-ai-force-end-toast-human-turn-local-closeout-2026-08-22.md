# DiceThrone 本地反馈收口：到了我的回合还弹出 AI 强制结束回合

- 反馈 ID：`69f7e7a0fc95d87e478aa7d7`
- 本轮口径：本地 Mongo 反馈库，`mongodb://127.0.0.1:27017/boardgame.feedbacks`
- 反馈原文：`为什么到了我的回合还弹出ai强制结束回合`
- 目标入口：在线 DiceThrone 对局恢复 / AI 强制收口完成提示
- 验收口径：恢复完成后的权威状态已经交回真人回合时，不应再弹出“AI 强制结束回合”提示；真正无法确认完成态或仍停留在 AI 流程时，原提示保留。

## 真实反馈状态

保存的当前权威状态显示对局已经交回玩家：

- `sys.phase = main1`
- `core.activePlayerId = "0"`
- `seatControllers["0"].type = "human"`
- 没有当前交互：`sys.interaction.current = null`
- 没有响应窗口：`sys.responseWindow = {}`
- 没有待处理攻击：`core.pendingAttack = null`

保存的系统事件流（`sys.eventStream.entries`）尾部同样说明不是业务回合错乱：

- `153`：从玩家 `2` 切到 AI 玩家 `3`
- `158`：AI 玩家 `3` 进入 `main1`
- `169`：AI 玩家 `3` 进入攻击掷骰阶段
- `178`：AI 玩家 `3` 进入 `main2`
- `179`：AI 玩家 `3` 进入弃牌阶段
- `180`：从 AI 玩家 `3` 切到真人玩家 `0`
- `181` / `183` / `186`：真人玩家 `0` 依次进入维持、收入、`main1`
- `187`：一个展示用奖励骰的延迟结算事件，`displayOnly=true`，不改变当前行动方，也没有留下交互阻塞

结论：反馈里的“到了我的回合”属实；保存的对局事实没有显示 AI 仍持有回合，也没有显示 watchdog 继续替 AI 强推真人回合。

## 根因分层

- 现实故障现象：玩家已经回到自己的回合，仍看到“AI 强制结束回合”提示。
- 直接条件：恢复完成提示函数在 `candidateReason === "active-turn"` 时无条件返回 warning 提示。
- 止血动作：让提示函数先读取恢复完成后的当前行动玩家；如果当前行动玩家是真人，就不返回提示。
- 根本机制：`active-turn` 分支没有复用其它恢复类型已有的“恢复后已回到真人回合则抑制提示”判断，导致同类成功提示可能滞后于权威状态，表现成玩家回合里的 AI 强制结束回合误报。

## 改动

- `src/pages/onlineAiForceSkip.ts`
  - `resolveOnlineAiAutoRecoveryCompletionNotice()` 先解析恢复完成后的当前行动玩家。
  - `active-turn` 分支在当前行动玩家已是 human 时返回 `null`，不再显示“AI 强制结束回合”。
  - 无权威状态或仍停留在 AI 流程时，保留原 warning，避免隐藏真正的 AI 强制收口提示。

- `src/pages/__tests__/matchSeatValidation.test.ts`
  - 新增回归用例：`active-turn 恢复完成后如果已经切回人类回合，不再弹强制结束回合提示`。

## 验证

红测：

```text
node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native -t "active-turn 恢复完成后如果已经切回人类回合"

1 failed
AssertionError: expected { tone: 'warning', title: 'AI 强制结束回合', ... } to be null
```

修复后：

```text
node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native -t "active-turn 恢复完成后如果已经切回人类回合"

1 file passed / 1 passed / 152 skipped
```

同组回归：

```text
node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native -t "resolveOnlineAiAutoRecoveryCompletionNotice"

1 file passed / 6 passed / 147 skipped
```

静态检查：

```text
npx eslint src/pages/onlineAiForceSkip.ts src/pages/__tests__/matchSeatValidation.test.ts

passed
```

完整相关测试文件补跑：

```text
node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native

152 passed / 1 failed
```

这条失败是既有 DiceThrone 奖励骰夹具问题，报错为 `奖励骰缺少掷骰者角色：playerId=1`，位置在 `src/games/dicethrone/domain/rollContext.ts:119`，与本次提示函数改动无直接关系；本次新增用例和同组提示判断均已通过。

## 结论

本条反馈按“提示误报”收口：保存的真实对局已经回到玩家回合，不是 AI 仍在强制结束玩家回合；当前修复保证恢复完成后的权威状态若已是真人回合，不再弹“AI 强制结束回合”提示。
