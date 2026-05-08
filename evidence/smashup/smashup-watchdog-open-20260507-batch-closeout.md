# SmashUp watchdog 剩余 open 批次收口（2026-05-07）

## 范围

- 时间：`2026-05-07 20:44 +08`
- 来源口径：生产 `feedbacks` 真源（SSH + `boardgame-mongodb`）
- 目标：`gameId=smashup` 的 6 条 `online-ai-watchdog` `open/in_progress`

## 回写前现场

- 快照：`temp/feedback-closeout/query-smashup-open-inprogress-20260507.raw.txt`
- 我实际看到的剩余系统单全部落在 `force-end-turn-*` 聚合：
  - `active-turn:follow-up-advance`
  - `visible-interaction:follow-up-advance`
  - `active-turn-legal-only:follow-up-advance:command_failed`

## 逐簇判断

### A. 可直接 `resolved`

- `69f8b0669ec13b96d71111cb`
  - `force-end-turn-failed active-turn-legal-only:follow-up-advance:command_failed`
  - 归因：旧的 scoreBases / visible-interaction recovery 失败聚合，已被 SmashUp watchdog / reaction-session 修复链覆盖。

### B. 建议 `closed`

- `69f85fd09ec13b96d7110594`
  - `force-end-turn-success active-turn:follow-up-advance:steps=2`
- `69f861c69ec13b96d71105c6`
  - `force-end-turn-success active-turn:follow-up-advance:steps=1`
- `69f8b1309ec13b96d7111202`
  - `force-end-turn-success visible-interaction:follow-up-advance:steps=1`
- `69f8b0249ec13b96d7111198`
  - `force-end-turn-success visible-interaction:follow-up-advance:steps=1`
- `69f8b0139ec13b96d7111190`
  - `force-end-turn-success active-turn:follow-up-advance:steps=1`

## 结论

- 这批里：
  - `1` 条应回写 `resolved`
  - `5` 条应回写 `closed`
- 验证命令已通过：
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
  - `src/engine/transport/__tests__/server.test.ts`
  - 覆盖 `wizards_arcane_protector / scoreBases / stale reaction / follow-up advance` 相关回归
