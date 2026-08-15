# 在线 AI 即时执行器修复证据（2026-08-13）

## 原始症状

- 用户反馈：DiceThrone 在线局里，真人选择角色后，AI 如果还没选择角色，页面表现为没有立刻继续，像是开局卡住。
- 保真范围：这里处理的是“普通 AI 未开启手动前置选择时，应由服务端立刻继续选角 / ready”；开启 `manualSetupSelection` 的 AI 仍应等待房主人工代选。
- 2026-08-14 追加反馈：SmashUp 在线局公开选阵营阶段，本地系统反馈记录显示 `online-ai-watchdog legal-action-recovered active-turn:legal-action:select-faction`。现实含义是 AI 座位没有作为正常即时动作完成选阵营，而是被 watchdog 恢复路径代打。
- 2026-08-14 小黑屋追加反馈：本地人工反馈 `_id=6a7f15a7e07a7bf120e97153`，内容为“ai不选择阵营”，携带 `gameId=betrayal`、路由 `/play/betrayal/match/28R87SSCEpU?playerID=0`。现实含义是小黑屋在线开局的 AI 座位没有在角色 / 剧本确认阶段继续执行。

## 证据链

### 1. 现实故障现象

- 红测 `DiceThrone 在线普通 AI 应在人类选角命令成功后立即由服务端继续选角，不依赖 watchdog 轮询` 首跑失败。
- 失败状态：真人 `0` 已执行 `SELECT_CHARACTER`，`selectedCharacters['0'] === 'tianshi'`；AI `1` 仍为 `unselected`。
- 这证明 DiceThrone AI 没有在真人选角命令成功后被服务端即时触发。

### 2. 直接触发条件

- 服务端单条命令入口 `handleCommand()` 在命令成功后只执行 `executeCommandInternal()`、`drainCommandQueue()`、释放串行锁并返回。
- 批量命令入口 `handleBatch()` 成功后也只广播和确认 batch。
- 玩家同步入口 `handleSync()` 原本只发送当前状态，不会在“房间已停在 AI 可行动作”时触发 AI。

### 3. 既有恢复动作

- `runOnlineAiRecoveryTick()` 可以通过 watchdog 轮询找到 `seat-legal-only` / `active-turn-legal-only` 等候选，再执行合法 AI 动作。
- 这只是周期恢复路径；它能救场，但不是“人类命令成功后立刻接续”的正式执行入口。

### 4. 根本机制

- 在线 AI server-authority 重构删除旧浏览器 AI seat 执行器后，服务端没有在命令生命周期中建立“正常 AI 即时执行入口”。
- 结果是：AI 能生成合法 `setup-select-character`，服务端 watchdog 也能代打，但普通命令成功 / 玩家同步后没有立即调用该合法动作执行链。
- 所以根因不是 DiceThrone AI 策略不会选角，而是在线传输层缺少命令后与同步后的服务端 AI 接续触发点。
- 2026-08-14 追加定位：即时执行入口已经存在后，`runOnlineAiImmediateExecution()` 仍先解析恢复候选，再通过 `tryRecoverOnlineAiWithLegalAction()` 执行动作。SmashUp `factionSelect` 的 AI legal actions 能生成 `select-faction`，但执行链被记录成 watchdog `legal-action-recovered`；根因不是 SmashUp 派系候选生成失败，而是服务端即时 AI 调度顺序仍把公开开局正常动作放进恢复路径。
- 同一机制解释小黑屋反馈：`betrayal` 的 AI legal actions 能生成 `SELECT_EXPLORER`、`CONFIRM_EXPLORER` 和 `CONFIRM_SCENARIO_CARD`；回归点不是小黑屋 AI 不会选角色，而是在线服务端此前没有把这些正常开局动作优先作为即时 AI 命令执行，容易表现为“AI 不选择阵营 / 角色”，或退到 watchdog 才恢复。

## 修复内容

- `src/engine/transport/server.ts`
  - 新增 `buildOnlineAiSeatControllers()`，统一在线 AI 座位控制器解析，避免 watchdog 与正常执行器各自拼一套判断。
  - 新增 `runOnlineAiImmediateExecution(match, trigger)`，在服务端串行锁外启动 AI 接续执行。
  - 2026-08-14 追加：在 `runOnlineAiImmediateExecution()` 中先调用正常 AI dispatch 并直接执行 AI 自己的合法命令；只有正常路径拿不到动作或没有推进时，才落回原 watchdog 恢复候选。
  - `handleCommand()` 成功后触发即时 AI。
  - `handleBatch()` 成功后触发即时 AI。
  - `handleSync()` 在 human seat 同步后触发即时 AI，用于重连 / 进房时房间已停在 AI 可行动作的场景。
  - `runOnlineAiRecoveryTick()` 改为复用同一个座位解析入口。

## AI-only / human guard

- 只有 `seatControllers` 判定为非 human 的 seat 会被执行。
- 人类 socket 命令仍被 `resolveOnlineAiSeatControllerType(match, info.playerID) !== 'human'` 拦截，旧浏览器 AI seat 不能提交正式命令。
- 同步触发只在人类座位 `handleSync()` 后启动；旁观者同步不改变对局。
- 即时执行器只尝试 AI legal action；如果正常路径没有合法动作或没有推进，才进入已有恢复候选。强制关窗、裸推进阶段和系统恢复反馈仍只属于 watchdog 路径。
- 2026-08-14 SmashUp 回归断言：AI seat `1` 执行 `su:select_faction` 后，`tryRecoverOnlineAiWithLegalAction()` 不应被调用，且不写 `legal-action-recovered` 系统反馈。
- 2026-08-14 Betrayal 回归断言：真人 seat `0` 执行 `SELECT_EXPLORER` 后，AI seat `1` / `2` 必须通过正常即时链路连续执行 `SELECT_EXPLORER`、`CONFIRM_EXPLORER`、`CONFIRM_SCENARIO_CARD`；该用例同时断言不调用 `tryRecoverOnlineAiWithLegalAction()`，且不写 `legal-action-recovered` 系统反馈。
- `manualSetupSelection` 仍由 `shouldSuppressOnlineAiWatchdogForManualFactionSelection()` 和服务端 `manual-setup-selection` 通路控制，普通 AI 自动选角不覆盖手动代选语义。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "DiceThrone 在线普通 AI 应在人类选角命令成功后立即|DiceThrone 在线普通 AI 应在人类同步进房后继续|房主只能请求服务端执行当前权威的 AI 准备选择|非房主不能请求服务端替 AI 执行准备选择|服务端拒绝不属于人工准备选择"`  
  - 5 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在 DiceThrone 普通 setup 阶段应代普通 AI 选择角色|DiceThrone 在线普通 AI 应在人类选角命令成功后立即|DiceThrone 在线普通 AI 应在人类同步进房后继续"`  
  - 3 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchManualSetup.test.ts --configLoader native`  
  - 3 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native -t "DiceThrone|manual setup|角色选择|manualSetupSelection"`  
  - 6 passed / 145 skipped。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native -t "setup-select-character|角色|选角|setup"`  
  - 9 passed / 115 skipped。
- `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts`  
  - passed。
- 2026-08-14 追加命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "即时服务端 AI 在 SmashUp 公开选阵营阶段应走正常 AI 动作" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 1 file passed，1 test passed。日志显示 `candidateReason:"immediate-ai"`、`commandTypes:["su:select_faction"]`。
- 2026-08-14 追加命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "factionSelect 阶段应走 legal-action recovery|即时服务端 AI 执行拿不到合法动作且游戏允许强制恢复" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 1 file passed，2 tests passed。旧 watchdog legal-action 恢复链路与“正常路径无动作后回落恢复序列”均保持可用。
- 2026-08-14 追加命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "即时服务端 AI|在线普通 AI 应在人类" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 1 file passed，6 tests passed。覆盖 DiceThrone、SmashUp、Betrayal 的即时 AI 接续；小黑屋日志显示 `candidateReason:"immediate-ai"`，命令包含 `SELECT_EXPLORER`、`CONFIRM_EXPLORER`、`CONFIRM_SCENARIO_CARD`。
- 2026-08-14 小黑屋追加命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "Betrayal|betrayal|小黑屋|characterSelect" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 1 file passed，2 tests passed。覆盖 watchdog 救场旧路径与正常即时 AI 路径；正常即时路径新增断言“不走恢复反馈”。
- 2026-08-14 小黑屋追加命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/ai.test.ts -t "选角阶段只生成未被占用的探索者" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 1 file passed，1 test passed。确认小黑屋 AI 角色选择合法动作本身仍可生成。
- 2026-08-14 追加命令：`npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts`
  - passed。
- 2026-08-14 追加命令：`npm run typecheck`
  - passed。
- 2026-08-14 本地反馈状态回写：本地 Mongo `boardgame.feedbacks` 中 `_id=6a7f15a7e07a7bf120e97153` 已从 `open` 更新为 `resolved`，`resolvedMethod` 写明小黑屋在线开局 AI 会自动选择探索者、确认探索者并确认剧本卡。

## 残余说明

- DiceThrone 历史部分没有关闭线上 / 本地反馈记录：当时排查没有重新命中一条可唯一对应“DiceThrone AI 未选角”的 open 反馈对象，不能把 CPU watchdog 或旧系统反馈误关成本问题。
- 测试期间 `matchSeatValidation` 命令结束后仍出现若干 `ECONNRESET` 噪声；对应测试进程 exit code 为 0，断言均已通过，本轮不把该噪声当作 DiceThrone AI 选角问题处理。
- 2026-08-14 这次没有执行生产部署，也没有回写线上反馈状态；当前可宣称的是“本地代码已修、本地小黑屋反馈已标记 resolved，并通过定向验证”，不能宣称“线上已部署生效”。
- 2026-08-14 本地 Mongo `boardgame.feedbacks` 已命中小黑屋人工反馈，但只在 `feedbacks` 集合找到该 matchId，未找到对局状态快照。因此小黑屋验收使用同阶段在线服务端测试复现和锁定，而不是基于原始对局恢复现场。
- 2026-08-14 22:33 +08:00 复跑 `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/ai.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`：22 passed / 12 failed。红项集中在魔法相机、灰尘、巨魔手、中后期攻击 / 终局 runner 等测试构造或策略断言；本轮只把“角色 / 阵营选择阶段 AI 不执行”收口，不能据此宣称小黑屋全 AI 策略套件全绿。
