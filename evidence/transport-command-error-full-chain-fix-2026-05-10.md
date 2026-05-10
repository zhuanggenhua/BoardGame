# 命令执行异常全链路修复证据（2026-05-10）

## 范围

- 线上反馈源中与“命令执行异常 / 总是异常”相关的 open / in_progress 反馈。
- 本轮重点修复两类链路缺陷：
  1. 后端命令失败原因在 batch 返回时被折叠成 `command_failed`。
  2. 前端把 `command_failed` 当系统错误静默拦截，玩家看不到真实原因。

## 线上反馈事实

- `6a006a1cd5153682969e5f53`：`smashup`，`open`，用户原文 `总是异常`。
- `6a005f68d5153682969e5c7d`：`smashup`，`in_progress`，用户原文 `总是命令执行异常`，生产 matchId 为 `xtCw4DtXICD`。
- `6a00549bd5153682969e59d3`：用户原文 `维京人地图，长舟，放置随从报错，提示命令执行异常`。经用户澄清“应该是大杀四方”，本条重新归类为 SmashUp 维京基地 `base_drakkar`（德拉卡尔号 / Drakkar）。

## 根因链路

### 后端原因丢失

- `GameTransportServer.executeCommandInternal()` 原本能拿到 `result.error` 或 pipeline throw 的具体 `Error.message`。
- 但 `handleBatch()` / `executeBatchInternal()` 在任一命令失败后固定发送：
  - `socket.emit('batch:rejected', matchID, batchId, 'command_failed')`
- 结果是领域错误码、pipeline contract 错误、具体规则拦截原因全部被折叠成泛化失败。

### 前端过度静默

- `MatchRoom.tsx` 原本把 `command_failed` 放入 `SYSTEM_ERRORS`。
- `GameProvider` 的 batch rejection 回调原本也显式跳过 `command_failed` 的 `onError`。
- 因此在线 batch 命令失败时，玩家可能只看到泛化“命令执行异常”，甚至完全看不到真实拒绝原因。

### SmashUp 生产异常

生产日志中的具体 pipeline 错误不是泛化失败，而是 effect contract 缺失：

- `base_the_asylum@onMinionPlayed` 读取 `state.players.1`，契约缺 `controllerState`。
- `base_ninja_dojo@afterScoring` 读取 `state.suppressedCardsUntilTurnStart`，契约缺 `turnFlags`。
- `base_castle_blood@onMinionPlayed` 读取 `state.suppressedCardsUntilTurnStart`，契约缺 `turnFlags`。

当前工作区已有另一批未提交 SmashUp effect DSL 重构，已大面积移除旧 `effectContract`，本轮未覆盖该重构，避免误回滚用户现有改动。

### SmashUp `base_drakkar`（德拉卡尔号 / Drakkar）误拦截

- `base_drakkar` 的真实链路是：第一位随从打到该基地时，发动者选择另一位玩家，展示其牌库顶牌；若是行动牌或力量不高于 3 的随从，则转移到发动者手牌。
- 该能力合法读取：
  - `players.*.minionsPlayedPerBase` 判断是否为本回合第一位打入该基地的随从；
  - 对手 `deck/discard` 判断是否有可揭示牌，并在牌库空时洗回弃牌堆；
  - 打开 `base_drakkar` 选择玩家交互。
- 回归点在 `a4de3636`（2026-05-08，`修复多项游戏交互并发布0.5.9`）：SmashUp 触发链从原 `orderingFootprint` 切到运行时 `effectContract`，并在 `baseAbilityQueue` 执行基地能力时套上 `wrapTriggerCallbackWithEffectContract()`。
- 但 `base_drakkar` 的声明只写了 `reads: ['deckState']`、`writes: ['deckState', 'handState']`：
  - 缺 `playLimits`，所以读取 `minionsPlayedPerBase` 会被 contract 拦截；
  - 缺 `discardState`，目标牌库为空、需要洗回弃牌堆时也可能被拦截；
  - 缺 `opensInteraction: true`，正常打开选择玩家交互也会被误判为违规。
- 结论：这不是玩家“长舟放置随从”非法，而是 effect contract 把合法能力当成越权副作用拦了；此前传输层又把真实 contract 错误折叠成 `command_failed`，导致线上只显示“命令执行异常”。

## 本轮代码修复

- `src/engine/transport/server.ts`
  - `executeCommandInternal()` 记录最近失败真实原因。
  - pipeline throw 透传为 `pipeline_error: <Error.message>`，并做长度截断。
  - batch 回滚后发送真实 `failureReason`，不再固定 `command_failed`。
- `src/engine/transport/react.tsx`
  - batch rejection 除 `stale_state` 外全部转入 `onError` 展示路径。
  - 自定义领域错误与 `pipeline_error: ...` 也会触发乐观回滚与重同步。
- `src/pages/MatchRoom.tsx`
  - `command_failed` 不再属于静默系统错误。
  - `pipeline_error: ...`、领域错误码、自定义错误都进入 toast 展示。
- `e2e/src/**` 镜像文件
  - 同步了 transport / MatchRoom / 聚焦测试镜像，避免 E2E 源树继续保留旧错误链路。
- SmashUp reaction resource / effect DSL 当前工作区修复
  - 移除旧 `triggerEffectContract.ts` 和基地能力队列中的 `wrapTriggerCallbackWithEffectContract()` 运行时拦截。
  - 旧 `effectContract` 不再挂在 `base_drakkar` 等能力注册上，避免用不完整手写声明拦截真实合法链路。
  - 反应资源排序改走 footprint 推导/DSL 显式资源，不再把排序 hint 当成运行时权限系统。

## 验证

- SmashUp 业务根因聚焦验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "base_the_asylum|effect contract"`：5 passed。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts src/games/smashup/__tests__/baseAbilityIntegration.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "base_ninja_dojo|base_castle_blood"`：7 passed。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "base_drakkar"`：4 passed，覆盖 `PLAY_MINION` 真实触发链打开 `base_drakkar` 交互。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts src/games/smashup/__tests__/baseAbilityIntegration.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "未知结构不靠 legacy contract|effect contract|base_the_asylum|base_ninja_dojo|base_castle_blood|base_drakkar"`：5 files passed，17 tests passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "batch 内命令验证失败时应透传领域错误码|batch 内 pipeline 异常时应透传异常详情|batch expectedStateID"`
  - 3 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --maxWorkers 1 --testNamePattern "online command error visibility|shouldSilentlyRetryOnlineAiBatchRejection"`
  - 3 passed。
- `npm run typecheck`
  - passed。
- `git diff --check -- src/engine/transport/server.ts src/engine/transport/react.tsx src/pages/MatchRoom.tsx src/engine/transport/__tests__/server.test.ts src/pages/__tests__/matchSeatValidation.test.ts`
  - 无空白错误；仅 Git 提示这些文件下次触碰会 LF→CRLF。

## 剩余风险

- 之前把“长舟”归到 SummonerWars 是误分类；已按用户澄清修正为 SmashUp `base_drakkar`。旧 SummonerWars 召唤位置推断不再作为本条反馈结论。
- 反馈采集需要补充 matchId、stateSnapshot、actionLog、最后一次 command payload，否则 route 级反馈无法复盘“该不该拦截”。
