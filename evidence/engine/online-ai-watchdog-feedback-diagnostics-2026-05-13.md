# 线上 AI 自动反馈诊断链补强（2026-05-13）

## 范围

- 生产真源：`boardgame.feedbacks`
- 查询时间：`2026-05-13T15:52:27.278Z`
- 筛选：`status in ["open", "in_progress"]` 且来源为 `online-ai-watchdog` / `reporterType=system`

## 线上现状

- 未收口反馈总数：7
- 系统 AI 自动反馈未收口：6
- 人类 / feedback-modal 未收口：1
- 6 条系统反馈全部为 `smashup` 的 `force-end-turn-failed`

| feedbackId | matchId | sourceId / 阶段 | 失败摘要 | occurrenceCount | lastOccurredAt |
| --- | --- | --- | --- | ---: | --- |
| `69fec628f0a61f28ba015cfc` | `AB9ffvZadzd` | `smashup_reaction_choose` / `scoreBases` | `blocker_persisted`，选项含 `base_ninja_dojo` + `pass` | 2347 | `2026-05-10T23:51:50.763Z` |
| `6a003755d5153682969e5371` | `pJsrzfZoKyb` | `elder_thing_elder_thing_choice` / `playCards` | `command_failed`，唯一可用项 `deckbottom` | 894 | `2026-05-10T23:51:27.124Z` |
| `69ff12e4f0a61f28ba016b1f` | `QTx8apMwJsZ` | `smashup_reaction_choose` / `playCards` | `blocker_persisted`，选项含 `base_castle_blood` + `pass` | 1653 | `2026-05-10T23:51:13.277Z` |
| `6a00bed2d5153682969e7b39` | `x3YDzQcshCe` | `elder_thing_mi_go` / `playCards` | `command_failed`，选项含 `draw_madness` + `decline` | 1 | `2026-05-10T17:22:26.936Z` |
| `6a00bcfbd5153682969e7aa6` | `lU7L2PRfJQG` | active turn / `playCards` | `follow-up-advance:command_failed`，尝试结束阶段 | 1 | `2026-05-10T17:14:35.305Z` |
| `6a00948ed5153682969e6e2d` | `VNtU5gSm2LS` | `wizard_neophyte` / `playCards` | `command_failed`，选项含 `to_hand` + `play_extra` | 2 | `2026-05-10T14:23:11.877Z` |

## 判断

- 当前反馈足以归类：问题集中在 watchdog 对 AI visible interaction / active turn 的恢复链路。
- 但旧反馈的 `command_failed` 不足以继续定位具体业务根因：只能看到交互 sourceId 和候选项，不能看到最后失败的是 `SYS_INTERACTION_RESPOND`、`SYS_INTERACTION_CANCEL` 还是 `ADVANCE_PHASE`，也看不到领域层真实拒绝原因。
- 本轮按“信息不足则重构”处理：不猜具体单卡逻辑，先补强自动反馈诊断合同。

## 修改

- `src/engine/transport/server.ts`
  - watchdog 失败原因从泛化 `command_failed` 升级为 `command_failed:<commandType>:<真实失败原因>`。
  - legal-action recovery 命令失败时也会记录 `legal_action_command_failed:<commandType>:<真实失败原因>`。
  - pipeline 抛错后即使触发自动取消 interaction，也会恢复原始 `lastCommandFailureReason`，避免被取消命令覆盖。
- `src/engine/transport/__tests__/server.test.ts`
  - 新增回归：强制恢复命令失败时，自动反馈必须携带命令类型和真实失败原因。

## 验证

- `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts` -> 0 errors
- `npx eslint e2e/src/engine/transport/server.ts e2e/src/engine/transport/__tests__/server.test.ts` -> 0 errors
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 -t "watchdog.*命令类型|stale reaction choice|reaction pass 后仍停在同一交互|batch 内命令验证失败"` -> 4 passed
- `npm run typecheck` -> passed

## 后续状态

- 本轮未执行生产状态回写、部署、重启或数据修改。
- 生产仍有 6 条旧 `open` 系统反馈；本地已补强后续同类反馈的可定位性。

## 2026-08-16 补记：SmashUp 旧响应窗口镜像清理

- 现实现象：SmashUp 旧持久化局面里，AI 已通过真实 `smashup_reaction_choose` 交互让过并进入 `playCards`，但历史保存下来的通用 `sys.responseWindow.current` 镜像仍残留；watchdog 会把它误当成正式通用响应窗口，继续尝试 `RESPONSE_PASS`，在 SmashUp 当前系统列表没有 `ResponseWindowSystem` 时落成失败。
- 根本机制：SmashUp 当前反应轮权威在游戏自己的 reaction session / interaction 链；`smashup_reaction_choose` 对应的 `responseWindow` 只是历史镜像残留，不是当前正式执行入口。恢复链如果不区分“真实响应窗口”和“历史镜像”，就会把已完成的真实恢复重新导向通用 `RESPONSE_PASS`。
- 修复边界：服务端新增 `onlineAiRecovery.legacyResponseWindowMirrorSourceIds` 配置，只在游戏显式声明的 `sourceId` 命中时清理旧镜像；SmashUp 声明 `smashup_reaction_choose`。这不改变 DiceThrone / SummonerWars 等真正启用通用 ResponseWindow 的恢复口径。
- AI-only / human guard：清理只发生在 online AI watchdog 成功执行恢复命令之后；它不替真人选择、不替真人 pass，也不关闭未声明为 legacy mirror 的正式窗口。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted"` -> `1 file passed, 1 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "smashup AI reaction pass 后仍停在同一交互时，应升级为硬取消而不是 blocker_persisted"` -> `1 file passed, 1 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 响应循环时应强制关闭响应窗口"` -> `1 file passed, 1 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "resolveOnlineAiRecoveryCandidate 在 tracker 已进入同一 incident 的 response-loop key 后，仍应继续返回 response-loop，而不是退回 response-window"` -> `1 file passed, 1 passed`
