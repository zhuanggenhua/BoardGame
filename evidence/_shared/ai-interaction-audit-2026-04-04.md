# AI 交互链专项审计 2026-04-04

## 审计范围

- 共享 AI 决策入口
  - `src/engine/ai/context.ts`
  - `src/engine/ai/localRunner.ts`
- 在线 AI 提交链
  - `src/pages/MatchRoom.tsx`
  - `src/engine/transport/client.ts`
  - `src/engine/transport/server.ts`
- 本地 AI 执行链
  - `src/engine/transport/react.tsx`
- 游戏侧交互枚举
  - `src/games/dicethrone/ai.ts`
  - `src/games/summonerwars/ai.ts`
  - `src/games/smashup/ai.ts`
- 回归测试
  - `src/pages/__tests__/matchSeatValidation.test.ts`
  - `src/engine/transport/__tests__/patch.test.ts`
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
  - `src/games/summonerwars/__tests__/flow.test.ts`
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`

## 权威来源

- `src/engine/systems/InteractionSystem.ts:192-193`
  - `isBlocked` 的契约是“其他玩家有未完成交互时，当前玩家不应发送命令”。
- 当前仓库实现与现有 transport / AI 测试。

## 命中维度

- `D3` 数据流闭环
- `D5` 交互完整
- `D8` 时序正确
- `D39` 流程控制标志清理完整性
- `D47` 回归覆盖完整性

## 逐项结论

### 1. 在线 AI 使用主玩家过滤视角，导致看不到 seat 私有交互

- 结论：`已修复`
- 修复点：
  - `src/engine/ai/localRunner.ts` 已支持 `visibleStateResolver`
  - `src/pages/MatchRoom.tsx:207` 起，在线 AI 优先使用各 seat 自己同步到的 `latestState`
- 回归：
  - `src/pages/__tests__/matchSeatValidation.test.ts:183`

### 2. 共享 AI 不消费 `isBlocked`，多 seat 下会抢跑普通动作

- 结论：`已修复`
- 修复点：
  - `src/engine/ai/context.ts:25-36`
  - 当当前视角 `isBlocked=true` 且没有可见交互时，直接压空 `legalActions`
- 回归：
  - `src/pages/__tests__/matchSeatValidation.test.ts:375`

### 3. 在线 AI 逐条 `sendCommand`，多命令动作存在半提交风险

- 旧结论：`未修复`
- 新结论：`已修复`
- 修复点：
  - `src/pages/MatchRoom.tsx:258`
  - 在线 AI 现在统一走 `client.sendBatch(...)`
  - `src/pages/MatchRoom.tsx:266` 在 `batch:confirmed` 时回写对应 AI seat 的 `latestState`
- 影响：
  - `interaction-multistep` 这类“一次 AI 动作对应多条命令”的场景，不再拆成无确认的多次单发。

### 4. 在线 AI 提交失败后 attemptKey 不回退，会被永久去重

- 旧结论：`未修复`
- 新结论：`已修复`
- 修复点：
  - `src/pages/MatchRoom.tsx:257-274`
  - 仅在真正提交前写入 `lastAiAttemptKeyRef`
  - `batch:rejected` / 断连拒绝后会清空该 attemptKey，并触发一次 retry tick
- 证据：
  - reject 回调链路由 `sendBatch()` 提供
  - transport 侧回归见 `src/engine/transport/__tests__/patch.test.ts:553`

### 5. 本地 AI 命令失败后没有状态推进，也会被 attemptKey 卡死

- 旧结论：`未修复`
- 新结论：`已修复`
- 修复点：
  - `src/engine/transport/react.tsx:91` 新增 `buildAiProgressMarker(...)`
  - `src/engine/transport/react.tsx:123`
  - `src/engine/transport/react.tsx:1017-1028`
  - 本地 AI 发完命令后，如果短时间内状态 marker 没有前进，则清空 `attemptKey` 并触发一次 retry tick
- 回归：
  - `src/pages/__tests__/matchSeatValidation.test.ts:661`
  - `src/pages/__tests__/matchSeatValidation.test.ts:736`
- 说明：
  - 当前已补两层回归：
    - 纯判断回归锁住“无进展才解锁重试”的核心门禁。
    - `LocalGameProvider` 集成回归锁住“命令被领域校验拒绝后，30ms 解锁并自动再跑一轮决策”的真实 effect/timer 链路。
  - 这是本地 provider 层的共享保护，不依赖具体游戏。

### 6. 游戏侧 `simple-choice multi` 只会固定取前几个选项，无法覆盖组合型主动选择

- 旧结论：`未修复`
- 新结论：`已修复`
- 影响范围：
  - `DiceThrone`
  - `SummonerWars`
- 根因：
  - 两个游戏的 AI 都把 `multi` 交互错误降级成“拿前 `minCount` 个选项”，没有枚举合法组合。
  - 这会导致“交叉交互 / 主动多选 / 精确多选”一旦依赖特定组合，AI 表面有响应能力，实际拿不到正确动作。
- 修复点：
  - `src/games/dicethrone/ai.ts`
  - `src/games/summonerwars/ai.ts`
  - 统一补上 `enumerateInteractionOptionCombinations(...)`
  - `min=0` 时显式生成空选动作
- 回归：
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts:507`
  - `src/games/summonerwars/__tests__/flow.test.ts:825`

### 7. DiceThrone 多骰 `multistep-choice` 只会生成“单骰 + confirm”，无法完成真实多步主动选择

- 旧结论：`未修复`
- 新结论：`已修复`
- 影响范围：
  - `DiceThrone`
- 根因：
  - AI 对 `selectDie` / `modifyDie` 的 `multistep-choice` 只生成单颗骰子的命令序列，然后立刻 `SYS_INTERACTION_CONFIRM`。
  - 这会让 `selectCount=2/5` 的重掷、复制、改骰交互退化成半套动作；复杂情况下不是“选得差”，而是根本没把协议走完。
- 修复点：
  - `src/games/dicethrone/ai.ts`
  - `selectDie` 现在会枚举 `1..selectCount` 的合法骰子组合，并生成批量 `REROLL_DIE + SYS_INTERACTION_CONFIRM`
  - `modifyDie` 的 `set` / `any` / `adjust` 现在会生成多骰批量 `MODIFY_DIE + SYS_INTERACTION_CONFIRM`
  - `modifyDie copy` 现在按“源骰 → 目标骰”有序生成两步复制动作
  - 本地评分器同步支持多骰 metadata，避免 AI 退回只选第一颗
- 回归：
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts:507`
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts:549`
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts:585`

### 8. 在线 AI 隐藏 `simple-choice` 缺少真实房间 E2E 证据

- 旧结论：`未修复`
- 新结论：`已修复`
- 回归：
  - `e2e/smashup/smashup-phase-transition-simple.e2e.ts:1589`
- 证据截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-持有隐藏交互时应自动-batch-响应并推进状态\在线-AI-持有隐藏交互时应自动-batch-响应并推进状态-online-ai-hidden-choice-before-resolve.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-持有隐藏交互时应自动-batch-响应并推进状态\在线-AI-持有隐藏交互时应自动-batch-响应并推进状态-online-ai-hidden-choice-after-resolve.png`
- 人工观察：
  - `before-resolve` 图里左上角明确显示“对手 / 出牌阶段”，基地上仍能看到 AI 的 `影舞者`，但人类视角没有出现“选择要牺牲的随从”提示框，符合“隐藏交互只属于 AI seat”的预期。
  - `after-resolve` 图里同一基地的 AI 随从已经消失，只剩空槽；人类界面仍没有弹出错误提示或遗留交互，说明 AI 已在真实在线房间里自动消费该 hidden interaction。
  - 同一条 E2E 还断言了服务端权威状态：`sys.interaction.current` 清空、基地随从为空、AI 手牌新增 3 张、牌库归零，证明不是“提示框自己消失”，而是交互 handler 已真正执行完成。

### 9. SmashUp 链式 `simple-choice` 在候选集刷新与交叉交互下，AI 必须继续基于最新 remaining 决策

- 旧结论：`未覆盖`
- 新结论：`已补 AI 层回归覆盖`
- 影响范围：
  - `SmashUp`
- 根因：
  - `SmashUp` 虽然没有 `multistep-choice`，但大量能力链是多个 `simple-choice` 串行排队；前一步常常会修改下一步的候选集，且可能与 `reaction_queue_choose_next`、`responseWindow` 交叉。
  - 如果 AI 仍沿用旧的静态 `options`，就会重复选择已失效项，或者在窗口打开时错误退回 `response-pass`。
- 回归：
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts:643`
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts:764`
- 覆盖内容：
  - `wizard_portal_order` 风格链式选择中，第二步即使保留旧 `options`，AI 也会通过 `optionsGenerator + continuationContext.remaining` 刷新到 `deck-a2/deck-a3`，不再重复选 `deck-a1`。
  - `responseWindow` 打开时，AI 在 `reaction_queue_choose_next -> wizard_portal_order -> wizard_portal_order -> reaction_queue_choose_next` 的三段主动选择链里，会持续优先消费当前交互，而不是退回窗口动作。

### 10. DiceThrone 在线 AI 隐藏 `multistep-choice` 缺少“多命令 batch”真实房间证据

- 旧结论：`未修复`
- 新结论：`已修复`
- 回归：
  - `e2e/dicethrone/dicethrone-simple-start.e2e.ts:1465`
- 证据文档：
  - `evidence/dicethrone/dicethrone-online-ai-hidden-multistep-e2e-test.md`
- 证据截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-持有隐藏-multistep-choice-时应-batch-提交多条-MODIFY_DIE-并完成私有结算\13-online-ai-hidden-multistep-before-resolve.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-持有隐藏-multistep-choice-时应-batch-提交多条-MODIFY_DIE-并完成私有结算\14-online-ai-hidden-after.png`
- 人工观察：
  - `before-resolve` 图里房主视角已经进入 `强掷攻击阶段`，右侧骰列是混合结果，但界面上没有任何属于房主的选择面板或确认层，符合“隐藏交互只属于 AI seat”。
  - `after` 图里房主界面仍没有被弹出交互，但右侧骰列已经整体切换为统一结果，说明 AI 的多条 `MODIFY_DIE` 已通过在线 batch 实际落到权威状态。
  - 同一条 E2E 还直接断言了服务端原始状态：注入后交互属于 `playerId='1'` 且 `selectCount=2`，处理后 `sys.interaction.current` 清空、前两颗骰子值变成 `[6, 6]`，不是单纯 UI 自己收口。

### 11. DiceThrone 在线 AI `batch:rejected` 后缺少真实联机 retry 证据

- 旧结论：`未修复`
- 新结论：`已修复`
- 回归：
  - `e2e/dicethrone/dicethrone-simple-start.e2e.ts:1572`
- 证据文档：
  - `evidence/dicethrone/dicethrone-online-ai-batch-retry-e2e-test.md`
- 证据截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-首轮-batch-被拒后应自动重试并完成隐藏-multistep-choice\15-online-ai-hidden-multistep-rejected-before-retry.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-首轮-batch-被拒后应自动重试并完成隐藏-multistep-choice\16-online-ai-hidden-multistep-after-retry.png`
- 人工观察：
  - `before-retry` 图里房主界面仍停在 `4. 强掷攻击阶段`，右侧前两颗骰子还是 `1 / 2`，同时没有弹出任何属于房主的选择层，说明“首轮 batch 被拒”后权威状态没有半提交，隐藏交互仍由 AI seat 持有。
  - `after-retry` 图里界面依旧没有把交互泄漏给房主，但右侧前两颗骰子已经明显不再是重试前的旧结果，说明第二轮 retry 已把改骰动作真正落到了权威状态，而且不是靠人类补点确认。
  - 同一条 E2E 还直接断言了补丁状态：首轮 `rejectedCount=1`、中间 `delegatedCount=0`、retry 成功后 `delegatedCount=1`、`lastCommandCount=3`，并验证服务端交互清空、房主过滤视角从 `isBlocked=true` 回到 `false`。

### 12. DiceThrone 在线 AI 连续两轮 `batch:rejected` 后仍缺少真实联机 retry 证据

- 旧结论：`未修复`
- 新结论：`已修复`
- 回归：
  - `e2e/dicethrone/dicethrone-simple-start.e2e.ts:1699`
- 证据文档：
  - `evidence/dicethrone/dicethrone-online-ai-double-batch-retry-e2e-test.md`
- 证据截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-连续两轮-batch-被拒后仍应自动重试并完成隐藏-multistep-choice\17-online-ai-hidden-multistep-rejected-twice-before-retry.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-连续两轮-batch-被拒后仍应自动重试并完成隐藏-multistep-choice\18-online-ai-hidden-multistep-after-third-attempt.png`
- 人工观察：
  - `before-third-attempt` 图里房主视角仍停在同一阶段，右侧骰列还保持旧结果，没有出现“两轮拒绝后只落下一半”的残留态。
  - `after-third-attempt` 图里房主界面仍没有出现 AI 私有交互 UI，但右侧骰列已明显变化，说明第三次尝试已实际推进权威状态，而不是单纯把阻塞标记清空。
  - 同一条 E2E 还直接断言了补丁状态：`rejectLimit=2`、中间 `rejectedCount=2 delegatedCount=0`，最终 `delegatedCount=1 lastCommandCount=3`，并验证服务端交互清空、房主过滤视角恢复可交互。

### 13. 联机 AI 超时兜底仍停留在“手动按钮”口径，缺少自动收口真实房间证据

- 旧结论：`未修复`
- 新结论：`已修复`
- 影响范围：
  - `SmashUp`
  - `MatchRoom` 在线 AI 桥接层
- 回归：
  - `e2e/smashup/smashup-phase-transition-simple.e2e.ts:1644`
  - `e2e/smashup/smashup-phase-transition-simple.e2e.ts:1751`
- 证据文档：
  - `evidence/smashup/smashup-online-ai-timeout-recovery-e2e-test.md`
- 证据截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局\在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局-online-ai-hoverbot-force-skip-toast.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局\在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局-online-ai-hoverbot-force-skip-after-resolve.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合-online-ai-force-end-turn-before-timeout.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合-online-ai-force-end-turn-after-resolve.png`
- 人工观察：
  - `4 秒自动跳过` 的真实房间截图里，房主依然看不到 AI 私有 prompt，但右上角只出现提示性 toast，没有“继续等待 / 强制跳过”按钮残留，说明收口已经从“人点按钮”升级成系统自动提交。
  - `4 秒自动跳过完成后`，基地上的 `盘旋机器人` 保留在场、牌库顶仍是 `robot_zapbot`，说明系统只是跳过当前隐藏可选效果，没有错误结束 AI 整个回合。
  - `8 秒强制结束回合` 的真实房间截图里，控制权从 `回合3 / 对手 / 出牌阶段` 切到 `回合4 / 你自己 / 出牌阶段`，同时 `影舞者` 仍在场上，证明系统走的是“取消卡住交互并直接收掉 AI 当前回合”，不是伪造一次原始选择。

## 仍然保留的风险

### 风险 1

- 旧表述失效：
  - `SmashUp` 的“AI seat 持有隐藏 simple-choice 后自动 batch 响应并推进状态”现已由 `e2e/smashup/smashup-phase-transition-simple.e2e.ts:998` 覆盖。
  - `DiceThrone` 的“AI seat 持有隐藏 multistep-choice 后 batch 提交多条命令”现已由 `e2e/dicethrone/dicethrone-simple-start.e2e.ts:1465` 覆盖。
  - `DiceThrone` 的“第一轮 batch 被拒后，AI 自动解锁并在第二轮 retry 成功”现已由 `e2e/dicethrone/dicethrone-simple-start.e2e.ts:1572` 覆盖。
  - `DiceThrone` 的“连续两轮 batch 被拒后，AI 仍能在第三轮 retry 成功”现已由 `e2e/dicethrone/dicethrone-simple-start.e2e.ts:1699` 覆盖。
- 新风险：
  - 目前仍缺“连续三次及以上 `batch:rejected` / 网络抖动伴随 socket 断连重连 / runtime attach-detach 期间 retry 连续触发”的真实联机证据。
  - 现有覆盖已经能证明“单次和双次拒绝都不会永久卡死”，但还没有把更长时间抖动下的退避与收口稳定性锁死。

### 风险 2

- 旧表述失效：本地 AI 的“无进展才解锁重试”核心判定与 `LocalGameProvider` 的自动重试链路，现已由 `src/pages/__tests__/matchSeatValidation.test.ts:783`、`src/pages/__tests__/matchSeatValidation.test.ts:1018` 与 `src/pages/__tests__/matchSeatValidation.test.ts:1169` 覆盖。
- 新风险：
  - 目前还没有单独回归去覆盖“连续多轮 rejection / unmount 取消 / attemptKey 在不同 seat 间切换”这类更长的本地共享链路。
  - 这已经不是“第一次失败后直接卡死”的 blocker，而是更靠近资源清理与多轮重试稳定性的剩余风险。

### 风险 3

- 当前已覆盖 `simple-choice multi` 的组合枚举，但还没有针对“多步交互里每一步都带主动选择、且前一步会改变后一步可选集”的跨游戏回归。
- 这类问题更像游戏侧策略/合法动作生成耦合风险，不再是共享 AI 框架卡死，但仍建议后续按高风险游戏补 1 条真实链路回归。

### 风险 4

- `SmashUp` 目前虽然没有 `multistep-choice`，但大量能力链是“多个 `simple-choice` 连续排队 + 中间刷新选项 + 可能穿插 responseWindow”。
- 当前已补两条 AI 层回归：
  - `wizard_portal_order` 的 remaining 刷新链
  - `responseWindow` 穿插 `reaction_queue_choose_next` 的三段主动选择链
- 仍未覆盖的是更接近真实联机场景的长链集成：例如 3 个以上真实能力 handler 串起来、过程中既有 `reaction_queue_choose_next` 又有 `responseWindow` 重开/关闭的完整在线房间证据。

## 本轮验证

- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native`
  - 结果：`42 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/patch.test.ts --configLoader native`
  - 结果：`24 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native`
  - 结果：`43 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/flow.test.ts --configLoader native`
  - 结果：`30 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native`
  - 结果：`15 passed`
- `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 持有隐藏交互时应自动 batch 响应并推进状态"`
  - 结果：`1 passed`
- `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 持有隐藏 multistep-choice 时应 batch 提交多条 MODIFY_DIE 并完成私有结算"`
  - 结果：`1 passed`
- `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 首轮 batch 被拒后应自动重试并完成隐藏 multistep-choice"`
  - 结果：`1 passed`
- `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 连续两轮 batch 被拒后仍应自动重试并完成隐藏 multistep-choice"`
  - 结果：`1 passed`
- `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 的盘旋机器人隐藏交互卡住时，应在 4 秒后自动跳过并恢复对局"`
  - 结果：`1 passed`
- `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合"`
  - 结果：`1 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native`
  - 结果：`40 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native`
  - 结果：`42 passed`
- `npm run typecheck`
  - 结果：通过

## 修订记录

- 2026-04-04 初版：确认在线 seat 私有视角与 `isBlocked` 共享问题。
- 2026-04-04 修订：补齐在线 batch 提交、在线 attemptKey 回退、本地 attemptKey 无进展回退，并同步更新结论为已修复。
- 2026-04-04 修订：补齐 `DiceThrone` / `SummonerWars` 的 `simple-choice multi` 组合枚举修复，并补对应回归测试。
- 2026-04-04 修订：补齐 `DiceThrone` 多骰 `multistep-choice` 的批动作生成与评分，覆盖 `selectDie(2)` 和 `modifyDie copy(2)`。
- 2026-04-05 修订：补齐 `SmashUp` 联机 AI 的 `4 秒自动跳过隐藏可选交互` 与 `8 秒无真实进展自动强制结束回合` 的真实房间 E2E，并把旧的“手动强制跳过”口径收敛为自动兜底。
- 2026-04-04 修订：补齐 `SmashUp` 在线 AI 隐藏交互的真实房间 E2E，并用截图确认“人类不可见、AI 自动处理、基地状态已推进”。
- 2026-04-04 修订：补齐 `SmashUp` 链式 `simple-choice` 的 remaining 刷新回归，以及 `responseWindow` 穿插三段主动选择链的 AI 决策回归。
- 2026-04-04 修订：补齐 `LocalGameProvider` 的本地 AI 自动重试集成回归，确认命令被领域拒绝后仍会在 30ms 解锁后自动再跑一轮。
- 2026-04-04 修订：补齐 `DiceThrone` 在线 AI 隐藏 `multistep-choice` 的真实房间 E2E，确认私有多步交互会通过 batch 提交两条 `MODIFY_DIE` 并在房主视角无泄漏地完成结算。
- 2026-04-05 修订：补齐 `DiceThrone` 在线 AI `batch:rejected -> retry` 的真实房间 E2E，确认首轮拒绝后不会半提交、不会永久卡死，并能在下一轮以 3 条命令批量完成隐藏多步交互。
- 2026-04-05 修订：补齐 `DiceThrone` 在线 AI “连续两轮 `batch:rejected` 后第三轮 retry 成功”的真实房间 E2E，确认多轮拒绝下仍不会半提交、不会把隐藏交互泄漏给人类。
