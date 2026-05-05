# Splendor watchdog `69f6c4bc` 本地验收收口说明（2026-05-04）

## 反馈对象

- `69f6c4bc9ec13b96d710e10d`
- 来源：`online-ai-watchdog`
- 文案：
  - `[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed`

## 线上当前还能确认到什么

- 当前这条系统单也只剩 watchdog 聚合摘要：
  - `route = server-watchdog`
  - `mode = online`
  - `errorName = force-end-turn-failed`
  - `errorMessage = active-turn:follow-up-advance:command_failed`
- 最新聚合计数已经停住：
  - `occurrenceCount = 686`
  - `lastOccurredAt = 2026-05-03T23:49:50.740Z`
- 这与本轮生产热补后的复核结论一致：
  - 当前 open 盘面里它还没被人工回写
  - 但 watchdog 已不再继续增长

## 根因与现有证据

- 这条正是本轮最早优先止血的 Splendor watchdog 聚合项。
- 已有根因与修复证据：
  - `findings.md`
    - 已明确根因 1：`src/engine/transport/onlineAiRecovery.ts` 旧逻辑会给 Splendor 这类不支持阶段推进命令的游戏生成裸 `ADVANCE_PHASE` recovery
    - 已明确根因 2：`src/engine/transport/server.ts` 旧逻辑只信残留 `seatControllers`，没有按 manifest 过滤 `localAi=false`
  - `progress.md`
    - 已记录生产环境晚间再次复发后，如何用 Node 24 容器编出热补 bundle 并覆盖 `boardgame-game-server:/app/server.mjs`
    - 已记录热补后 `70s` 日志窗口内不再出现 `cWGQSaUXt1B` 或 `online-ai-watchdog failed`
- 当前本地 transport 修复点：
  - `src/engine/transport/onlineAiRecovery.ts`
    - Splendor 不再生成/执行裸 `ADVANCE_PHASE` watchdog fallback / follow-up
  - `src/engine/transport/server.ts`
    - watchdog 会按 manifest 过滤 AI 能力；`localAi=false` 的 Splendor 不再因残留 seat metadata 被当成 AI 房间

## 本轮 fresh 复核

- 本轮重新跑通底层单测：
  - `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts`
    - `Splendor 即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback`
- 本轮重新跑通 server 侧聚焦回归：
  - `src/engine/transport/__tests__/server.test.ts`
    - `online AI watchdog 对 manifest 明确禁用 AI 的 splendor 应忽略残留 seatControllers`

## 结论

- `69f6c4bc...` 当前不是“仍在持续产生的新 open 现场”，而是本轮 Splendor watchdog 热补止血完成后，**状态尚未人工回写** 的旧聚合项。
- 在本地 transport 修复、fresh 聚焦回归、以及生产热补后日志静默三层证据同时成立的前提下，本条按“已修未回写的系统单”处理，可直接转 `resolved`。

## 收口口径

- 当前任务口径下，`resolved` 表示“本地已经确认并完成本地验收”，不代表已上传/已上线。
- 本条可以直接按当前本地验收结论回写 `resolved`。
