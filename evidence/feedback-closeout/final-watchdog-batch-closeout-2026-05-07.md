# 最后 21 条 watchdog 系统反馈批量收口（2026-05-07）

## 范围

- 时间口径：线上真实反馈源
- 任务时间窗：
  - 回写前快照：`2026-05-07 20:44 +08`
  - 批量回写时间：`2026-05-07 21:08:22 +08`
  - 最终复核时间：`2026-05-07 21:25 +08`
- 正式写入口：生产 Mongo
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh --quiet boardgame`

## 回写前盘面

- 快照：`temp/feedback-closeout/query-all-open-inprogress-latest-before-writeback-20260507.raw.txt`
- 我实际核对到：
  - 全量 `open/in_progress = 23`
  - 其中 `69fb3fde...`、`69fc6298...` 两条 SmashUp stale `arcane protector` 单已在本轮更早一拍单独回写
- 扣除这 2 条后，最后待清批次是 `21` 条：
  - `dicethrone = 15`
  - `smashup = 6`
  - 全部为 `reporterType=system`、`source=online-ai-watchdog`
  - 同时 `reporterType=user && status in [open,in_progress] = 0`

## 本轮判定口径

### `resolved`

- 历史失败聚合项，但当前根因已经由既有修复簇覆盖，属于“已修未回写”
- 本批命中的两类：
  - `force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - `force-end-turn-failed active-turn-legal-only:follow-up-advance:command_failed`
  - `unsatisfiable-interaction-auto-skipped empty-options`

### `closed`

- 历史成功诊断留痕，不代表仍有未修复故障
- 本批命中的两类：
  - `force-end-turn-success active-turn:follow-up-advance:*`
  - `force-end-turn-success visible-interaction:*`
  - `force-end-turn-success seat-legal-only:*`

## 分游戏依据

### SmashUp 6 条

- 证据文档：`evidence/smashup/smashup-watchdog-open-20260507-batch-closeout.md`
- 结论：
  - `resolved = 1`
  - `closed = 5`
- 关键复用链：
  - `evidence/smashup/smashup-online-ai-faction-select-watchdog-feedback-fix-2026-04-15.md`
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
  - `src/engine/transport/__tests__/server.test.ts`

### DiceThrone 15 条

- 证据文档：`evidence/dicethrone/dicethrone-watchdog-open-20260507-batch-closeout.md`
- 结论：
  - `resolved = 8`
  - `closed = 7`
- 关键复用链：
  - `evidence/dicethrone/dicethrone-watchdog-69f471da-69f73be4-legal-only-followup-local-closeout-2026-05-04.md`
  - `evidence/transport/online-ai-watchdog-targetingroll-legal-only-fix-2026-04-30.md`
  - `evidence/dicethrone/dicethrone-online-ai-watchdog-human-response-window-fix-2026-05-02.md`
  - `evidence/dicethrone/dicethrone-online-ai-orphan-displayonly-bonus-settlement-fix-2026-05-02.md`
  - `evidence/dicethrone/dicethrone-online-ai-pending-interaction-hidden-response-fix-2026-05-02.md`

## 远端正式回写

- 回写回显：`temp/feedback-closeout/update-feedback-status-20260507-final-watchdog-batch.raw.txt`
- 我实际看到：
  - `resolved.matchedCount = 9`
  - `resolved.modifiedCount = 9`
  - `closed.matchedCount = 12`
  - `closed.modifiedCount = 12`

说明：

- 这 `9 + 12 = 21` 条，正好覆盖本轮最后批次
- 其中包含：
  - SmashUp `resolved 1 + closed 5`
  - DiceThrone `resolved 8 + closed 7`

## 回写后复核

- 逐条状态快照：`temp/feedback-closeout/query-feedback-after-final-watchdog-batch-20260507.raw.txt`
- 全量未收口快照：`temp/feedback-closeout/query-all-open-inprogress-after-final-watchdog-batch-20260507.raw.txt`
- 人类未收口快照：`temp/feedback-closeout/query-human-open-inprogress-after-final-watchdog-batch-20260507.raw.txt`
- 最新再次直查快照：`temp/feedback-closeout/query-all-open-inprogress-current-20260507.raw.txt`

我实际核对到：

- 这 21 条目标单都已变成目标状态：
  - 失败类 / auto-skipped 类为 `resolved`
  - success telemetry 类为 `closed`
- 截至 `2026-05-07 21:25 +08`：
  - 全量 `open/in_progress = 0`
  - `byReporterType = []`
  - `humanOpen = 0`

## Fresh verification

命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts --configLoader native --maxWorkers 1 --testNamePattern "online AI watchdog 在 factionSelect 阶段应走 legal-action recovery，而不是 fallback ADVANCE_PHASE|online AI watchdog 在 AI active 的 targetingRoll 且 legalActions 为空时，不得 fallback 到裸 ADVANCE_PHASE|online AI watchdog 在 human 当前响应窗口中不应误判为 AI 卡死|online AI watchdog 在 legal-only 恢复前若现场切到 human afterRollConfirmed，应丢弃旧 candidate 而不是继续上报失败|DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留|dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口|online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口|Splendor 即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback"
```

结果：

- `2 files passed`
- `8 passed`

## 审计补记

- 本轮还顺手补了审计口径：
  - `.spec/knowledge/standards/testing-audit.md`
- 新增明确点：
  - `D40` 继续负责“批内副作用未串行推进”的问题，例如“远古之物同时杀俩小鬼只结算一次”
  - 本轮新漏口属于 `D37`：动态刷新不等于可激活性校验完整，validator 仍必须把 `zone/location` 前置条件写全

## 结论

- 按线上真实反馈口径，截至 `2026-05-07 21:25 +08`：
  - 人类未收口：`0`
  - 系统未收口：`0`
  - 全量未收口：`0`
- 本轮最后 21 条 watchdog 系统单已经完成正式回写与最终清零复核。
