# Summoner Wars 在线 AI 延迟修复证据（2026-08-19）

## 基本信息

- 对象：Summoner Wars 在线房间中由服务端执行的本地 AI。
- 日期：2026-08-19。
- 文档类型：closeout。
- 关联问题：用户反馈 Summoner Wars 在线 AI 不是单纯“卡死”，而是服务端重构后连续可见动作节奏不像重构前；并质疑是否没有用白名单。

## 范围

- 覆盖：在线房间、`seatControllers['1'] = local-ai`、`minimumActionDelayMs = 1000`、空回合快速收口、连续可见召唤。
- 不覆盖：AI 策略强弱、所有派系行动质量、移动端视觉动效、非 Summoner Wars 的完整端到端节奏。

## 结论

- 结论等级：功能实现已验证。
- 服务端确实在用 Summoner Wars runtime 白名单：`summon-unit` 等玩家能看到的动作是 visible；普通空阶段推进是 hidden；draw 阶段交还真人通过 metadata 显式 visible。
- 真正问题不是“没用白名单”，而是服务端连续可见动作的等待起点错了：第二个可见动作被同一自动片段的第一次等待抵扣。
- 修复后真实在线 E2E 通过：空回合 `returnedElapsedMs=2692`；连续两次可见召唤的服务端事件间隔 `1005ms`。

## 根因分层

- 现实故障现象：玩家在 Summoner Wars 在线房间里看到 AI 两次可见召唤几乎同步出现，第二步没有 1 秒节奏。
- 直接触发条件：页面运行权归属是服务端在线 AI 执行器（`AI_RUNTIME_TRUTH.authority = server-online-ai-executor`），连续召唤都发生在同一个自动执行片段内。
- 止血 / 恢复动作：服务端在线 AI 提交命令前等待 visible 动作；等待后复查状态编号和座位控制者，防止旧 AI 命令误提交。
- 根本机制：服务端此前记录的是“本自动片段第一次可见动作开始等待的时间”。第一张召唤等待 1000ms 后，第二张召唤用这个旧起点计算已经等过 1000ms，于是直接执行。重构前本地 AI 则是在可见动作成功执行后记录完成时间，下一次可见动作从这个完成时间重新计时。

## 实现消费

| 对象 | 原子断言 | 实现消费点 | 最终权威结果 | 验证证据 | 结论 |
| --- | --- | --- | --- | --- | --- |
| Summoner Wars 白名单 | `summon-unit`、`move-unit`、`build-structure`、`declare-attack`、`discard-for-magic`、`activate-ability`、`play-event` 是可见动作；普通非白名单动作为静默 | `src/games/summonerwars/ai.ts` + `src/engine/ai/actionVisibility.ts` | 服务端 delay plan 复用 runtime 判断，不再靠通用默认覆盖白名单 | `server.test.ts` runtime 白名单用例 | 通过 |
| 单次可见动作等待 | visible 动作在 1000ms 前不得提交命令 | `src/engine/transport/onlineAiActionDelay.ts` 的 `waitForOnlineAiActionDelay()` | 999ms 未执行，1000ms 后执行 | `Summoner Wars 即时服务端 AI 可见动作应等待 minimumActionDelayMs 后再执行` | 通过 |
| 连续可见动作间隔 | 第二个 visible 动作必须按上一个 visible 动作完成时间重新等待 | `lastVisibleActionAt` + `markOnlineAiVisibleActionCompleted()` | 两次 `summon-unit` 各自等待 1000ms | `Summoner Wars 即时服务端 AI 同一自动片段里的连续可见动作应按上次可见完成时间重新等待` | 通过 |
| 即时 AI executor 拆分 | 服务端重构后，Summoner Wars 的在线 AI 动作节奏和命令执行语义不能变化 | `src/engine/transport/onlineAiExecutor.ts` + `server.ts` 依赖注入 | `server.ts` 仍掌握锁、队列、恢复 tracker 和广播；executor 只承载即时动作流程 | lint、Summoner Wars 窄单测、真实 E2E | 通过 |
| AI seat controller 解析拆分 | 服务端必须继续把 Summoner Wars 1 号座位识别为 local-ai，并只让 AI seat 进入自动执行链 | `src/engine/transport/onlineAiSeatControllers.ts` + `server.ts` 薄包装 | 页面运行权日志显示 `seatControllerTypes={"0":"human","1":"local-ai"}`，权威执行器仍是 `server-online-ai-executor` | Playwright 真实在线 E2E | 通过 |
| 命令序列事务拆分 | 即时 AI 命令序列失败时必须保留失败原因并回滚已执行副作用，避免下一步玩家看到半提交状态 | `src/engine/transport/onlineAiExecutor.ts` 的 `executeOnlineAiCommandSequence()` | 第二条命令失败时回滚 state/stateID/random cursor/lastCommandPlayerId/cache，并广播恢复态 | `onlineAiExecutor.test.ts` | 通过 |
| recovery ownership 拆分 | watchdog legal-action 多命令执行时，第一条命令后若控制权交回 human，后续 AI 命令必须停止 | `src/engine/transport/onlineAiRecoveryOwnership.ts` + `server.ts` 薄包装 | shared / hidden interaction、response window、当前玩家 fallback 的 AI 归属判断保持；human seat 不继续 recovery | `onlineAiRecoveryOwnership.test.ts`；`server.test.ts` 多命令 legal-action owner changed 回归 | 通过 |
| recovery resolved 拆分 | watchdog 判断“卡点是否已解除”时必须保持 legal-only、visible/hidden interaction、response-window、人类响应窗口强关例外的旧语义 | `src/engine/transport/onlineAiRecoveryResolved.ts` + `server.ts` 薄包装 | `server.ts` 只注入当前状态、候选重算和 playerView；测试入口 `hasOnlineAiRecoveryResolved()` 保持不变 | `server.test.ts` targeted resolved / recovery 回归 | 通过 |
| recovery dispatch 拆分 | watchdog legal-action 应先用 strict 在线决策视图，只有 stale/missing private overlay 且 candidate reason 允许时才用 emergency playerView 重试；response-loop 经 emergency 后仍 blocked 不触发 overlay resync | `src/engine/transport/onlineAiRecoveryDispatch.ts` + `server.ts` 薄包装 | `server.ts` 仍保留执行、延迟、广播、tracker、feedback 和持久化；dispatch 模块只返回 `action / blocked / no-legal-action` | `onlineAiRecoveryDispatch.test.ts`；`server.test.ts` targeted recovery 回归 | 通过 |
| 命令失败原因拆分 | 服务端重构后，命令失败原因格式化和上报判定不能改变 online AI watchdog 的失败现场语义 | `src/engine/transport/commandFailureReason.ts` | 玩家命令仍只自动上报通用 / pipeline 失败；online AI watchdog 失败仍始终允许自动上报；重复原因不重复拼接 | `commandFailureReason.test.ts`；`server.test.ts` 权威预检失败回归 | 通过 |
| legal-action 权威预检拆分 | watchdog legal-action 执行前，普通命令必须用当前权威状态 validate；系统恢复命令不走领域 validate | `src/engine/transport/onlineAiLegalActionCommand.ts` + `server.ts` 薄包装 | `server.ts` 仍负责失败现场记录、circuit 记账、反馈和执行管线；预检模块只返回 `valid / skipped / invalid / deferred` | `onlineAiLegalActionCommand.test.ts`；`server.test.ts` 权威预检失败回归 | 通过 |
| legal-action 执行器拆分 | watchdog legal-action 的等待、命令串行执行、执行后归属复查、无进展判定和最终广播不能改变 Summoner Wars 在线 AI recovery 语义 | `src/engine/transport/onlineAiLegalActionRecoveryExecutor.ts` + `server.ts` hooks | `server.ts` 仍负责 seat controller、playerView、validate、execute、broadcast、tracker、circuit 和 feedback；执行器不拥有第二套房间状态写入口 | `onlineAiLegalActionRecoveryExecutor.test.ts`；`server.test.ts` targeted legal-action 回归 | 通过 |
| repeated recovery 强制解卡拆分 | 同一卡点重复恢复达到上限后，只能在 AI seat 且无响应窗口时取消当前 AI interaction，再按正式 phase advance 规则推进；有 response window 时不得裸推进 | `src/engine/transport/onlineAiRepeatedRecoveryUnblockExecutor.ts` + `server.ts` hooks | `server.ts` 仍负责 circuit、命令执行、tracker、feedback、队列 drain 和房间状态写入；执行器不新增第二套状态真相 | `onlineAiRepeatedRecoveryUnblockExecutor.test.ts`；`server.test.ts` repeated recovery targeted 回归 | 通过 |
| recovery fingerprint 迁移 | 服务端重构后，同一 AI 卡点的 tracker key、feedback blocker fingerprint 和状态 fallback fingerprint 不能漂移，否则会影响去重和诊断定位 | `src/engine/transport/onlineAiWatchdogSequenceFingerprinting.ts` + `server.ts` 薄包装 | `server.ts` 不再本地维护 fingerprint 细节；真实语义归入现有 watchdog sequence fingerprint 模块 | `onlineAiWatchdogSequenceFingerprinting.test.ts`；`server.test.ts` fingerprint targeted 回归 | 通过 |
| feedback 诊断格式迁移 | 服务端重构后，自动反馈里的 action log tail、event stream tail、interaction options、responseWindow、pendingDamage、commandPayload、blockerFingerprint、recovery state snapshot 和 legalActions 摘要不能丢字段或改格式 | `src/engine/transport/onlineAiWatchdogFeedbackDiagnostics.ts` + `server.ts` 薄包装 | `server.ts` 不再本地维护纯诊断 JSON、blocker fingerprint 拼接、recovery state snapshot JSON 和 legalActions 摘要；诊断模块只构造可定位信息，不接管房间状态、tracker 或 feedback 入库权 | `onlineAiWatchdogFeedbackDiagnostics.test.ts`；`server.test.ts` targeted feedback / blocker 回归 | 通过 |
| 真实空回合 | 空阶段推进不应逐段吃 1 秒，但交还真人不应瞬间 | Summoner Wars 在线 E2E | `returnedElapsedMs=2692`，满足 `>=900ms` 且 `<3000ms` | Playwright 真实在线 E2E | 通过 |
| 真实连续召唤 | 两次可见召唤之间应保留约 1 秒 | Summoner Wars 在线 E2E | 服务端事件间隔 `1005ms`；页面轮询采样间隔 `1031ms`，不作为 1 秒节奏断言权威 | Playwright 真实在线 E2E | 通过 |

## AI-only guard

- 修复只作用于 AI seat；human seat 不会被服务端 AI 执行入口接管。
- 等待期间若状态变化、对局卸载或座位改成人类，当前 AI 动作会被丢弃。
- hidden 动作、执行失败、状态变化中断和 human 接管不会更新时间；只有成功执行的 visible 动作才会记录下一次等待起点。

## 验证证据

- `npx eslint src/engine/transport/server.ts src/engine/transport/commandFailureReason.ts src/engine/transport/onlineAiLegalActionCommand.ts src/engine/transport/onlineAiLegalActionRecoveryExecutor.ts src/engine/transport/onlineAiRepeatedRecoveryUnblockExecutor.ts src/engine/transport/onlineAiWatchdogSequenceHelpers.ts src/engine/transport/onlineAiWatchdogSequenceFingerprinting.ts src/engine/transport/onlineAiWatchdogFeedbackDiagnostics.ts src/engine/transport/__tests__/commandFailureReason.test.ts src/engine/transport/__tests__/onlineAiLegalActionCommand.test.ts src/engine/transport/__tests__/onlineAiLegalActionRecoveryExecutor.test.ts src/engine/transport/__tests__/onlineAiRepeatedRecoveryUnblockExecutor.test.ts src/engine/transport/__tests__/onlineAiWatchdogSequenceFingerprinting.test.ts src/engine/transport/__tests__/onlineAiWatchdogFeedbackDiagnostics.test.ts`
  - 结果：通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/commandFailureReason.test.ts src/engine/transport/__tests__/onlineAiLegalActionCommand.test.ts --configLoader native`
  - 结果：通过；2 files passed，10 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiLegalActionRecoveryExecutor.test.ts --configLoader native`
  - 结果：通过；1 file passed，2 passed。
  - 关键结果：第一条命令后归属变化时停止后续命令并按已恢复返回；权威预检拒绝时不进入执行管线并返回命令失败合同。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecoveryDispatch.test.ts --configLoader native`
  - 结果：通过；1 file passed，4 passed。
  - 关键结果：human/manual guard 不进 dispatch；emergency 第二次拿 raw playerView；response-loop 经 emergency 后仍 stale 不触发 overlay resync。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiWatchdogFeedbackDiagnostics.test.ts src/engine/transport/__tests__/onlineAiWatchdogSequenceFingerprinting.test.ts src/engine/transport/__tests__/onlineAiRepeatedRecoveryUnblockExecutor.test.ts src/engine/transport/__tests__/onlineAiLegalActionRecoveryExecutor.test.ts src/engine/transport/__tests__/commandFailureReason.test.ts src/engine/transport/__tests__/onlineAiLegalActionCommand.test.ts src/engine/transport/__tests__/onlineAiRecoveryDispatch.test.ts src/engine/transport/__tests__/onlineAiRecoveryOwnership.test.ts src/engine/transport/__tests__/onlineAiExecutor.test.ts --configLoader native`
  - 结果：通过；9 files passed，29 passed。
  - 关键结果：feedback diagnostics、dispatch、ownership、executor、命令失败原因、legal-action 权威预检、legal-action recovery 执行器、repeated recovery 强制解卡执行器、recovery fingerprint 九个拆分模块的直接合同均通过；recovery state snapshot 保留卡点现场、seat 视角、交互可解性和 AI 摘要。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "buildOnlineAiRecoveryFingerprint|blockerFingerprint|在线 AI watchdog 选出的动作若被权威领域状态拒绝|同一卡点重复恢复三次|同一合法动作连续命令失败达到上限" --configLoader native`
  - 结果：通过；1 file passed，15 passed，266 skipped。
  - 关键日志：server 兼容入口委托到 fingerprint / diagnostics 模块后，fingerprint 与 blocker fingerprint 漂移断言仍通过；权威预检失败不进 execute；repeated recovery 上限后能强制解卡，存在 response window 时不裸 `ADVANCE_PHASE`；同一合法动作连续失败达到上限后不无限重试。
- `npm run test:e2e:file -- e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`
  - 结果：通过；2 passed。
  - 空回合：match `xUrpB_oYmt1`，`returnedElapsedMs=2692`。
  - 连续召唤：match `RSzRvcwwwdk`，`firstToSecondSummonEventGapMs=1005`，`firstToSecondSummonGapMs=1031`（页面轮询采样值，不作为 1 秒节奏断言权威）。
- `npm run test:ai:decision-view`
  - 结果：未作为通过项；脚本当前失败。当前统计为 4 个测试文件中 3 个通过、1 个失败；477 个用例中 476 个通过、1 个失败。
  - 当前失败：1 个测试失败，`src/pages/__tests__/matchSeatValidation.test.ts > resolveNextAiAction 在线视角 > DiceThrone 右侧奖励骰普通确认应允许在线 AI 基于共享状态收口`。
  - 失败原因：DiceThrone 奖励骰测试夹具缺掷骰者角色，错误为 `奖励骰缺少掷骰者角色：playerId=1`。这是 DiceThrone 测试夹具问题，不回代为 Summoner Wars 真实 E2E 通过证据。

## 证据边界

- 本 evidence 证明 Summoner Wars 当前反馈的服务端在线 AI 可见动作节奏问题已用真实入口验证。
- 本 evidence 不证明所有 Summoner Wars 策略动作都符合最佳打法，也不证明所有游戏的视觉节奏都已完成产品级调优。
