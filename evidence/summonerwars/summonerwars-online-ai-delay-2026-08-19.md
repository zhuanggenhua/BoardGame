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
- 修复后真实在线 E2E 通过：空回合 `returnedElapsedMs=2215`；连续两次可见召唤的服务端事件间隔 `1011ms`。

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
| 真实空回合 | 空阶段推进不应逐段吃 1 秒，但交还真人不应瞬间 | Summoner Wars 在线 E2E | `returnedElapsedMs=2215`，满足 `>=900ms` 且 `<3000ms` | Playwright 真实在线 E2E | 通过 |
| 真实连续召唤 | 两次可见召唤之间应保留约 1 秒 | Summoner Wars 在线 E2E | 服务端事件间隔 `1011ms`；页面轮询采样间隔 `1058ms`，不作为节奏断言权威 | Playwright 真实在线 E2E | 通过 |

## AI-only guard

- 修复只作用于 AI seat；human seat 不会被服务端 AI 执行入口接管。
- 等待期间若状态变化、对局卸载或座位改成人类，当前 AI 动作会被丢弃。
- hidden 动作、执行失败、状态变化中断和 human 接管不会更新时间；只有成功执行的 visible 动作才会记录下一次等待起点。

## 验证证据

- `npx eslint src/engine/transport/server.ts src/engine/transport/onlineAiExecutor.ts src/engine/transport/onlineAiSeatControllers.ts src/engine/transport/onlineAiActionDelay.ts src/engine/transport/__tests__/onlineAiExecutor.test.ts`
  - 结果：通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiExecutor.test.ts --configLoader native`
  - 结果：通过；1 file passed，1 passed。
  - 关键结果：AI 命令序列第二条失败时，第一条命令副作用回滚，失败原因保留。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "Summoner Wars 即时服务端 AI 可见动作应等待|Summoner Wars 即时服务端 AI 同一自动片段里的连续可见动作|runtime 白名单存在时|resolveLocalAiActionDelayPlan" --configLoader native`
  - 结果：通过；1 file passed，9 passed，272 skipped。
  - 关键日志：两次 Summoner Wars `summon-unit` 分别在 08:00:01 和 08:00:02 执行，说明同一自动片段里的两个可见动作各自等待。
- `npx cross-env PW_E2E_SERVICE_REUSE=isolated npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-ai-delay-diagnostic.e2e.ts`
  - 结果：通过；2 passed。
  - 空回合：match `BEmNJvukf7A`，`returnedElapsedMs=2215`。
  - 连续召唤：match `Oj0l5m1JHKU`，`firstToSecondSummonEventGapMs=1011`，`firstToSecondSummonGapMs=1058`（页面轮询采样值，不作为 1 秒节奏断言权威）。

## 证据边界

- 本 evidence 证明 Summoner Wars 当前反馈的服务端在线 AI 可见动作节奏问题已用真实入口验证。
- 本 evidence 不证明所有 Summoner Wars 策略动作都符合最佳打法，也不证明所有游戏的视觉节奏都已完成产品级调优。
