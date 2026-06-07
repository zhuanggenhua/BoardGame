# DiceThrone watchdog 剩余 open 批次历史收口（2026-05-07）

> 2026-06-06 当前有效口径：本文是 2026-05-07 那一轮 watchdog 剩余 open/in_progress 反馈批量处置的历史收口记录，不代表当前 DiceThrone 全体 watchdog、在线 AI、任一单英雄，或四位新英雄整批已经审计完成。它现在只能说明当时一批生产反馈被按簇判断为 `resolved/closed`，不能外推成 DiceThrone 当前总体收口。

## 范围

- 时间：`2026-05-07 20:44 +08`
- 来源口径：生产 `feedbacks` 真源（SSH + `boardgame-mongodb`）
- 目标：`gameId=dicethrone` 的 15 条 `online-ai-watchdog` `open/in_progress`

## 回写前现场

- 快照：`temp/feedback-closeout/query-dicethrone-open-inprogress-20260507.raw.txt`
- 我实际看到的剩余系统单分成两类：
  - `force-end-turn-failed ... legal_action_unavailable / command_failed`
  - `force-end-turn-success ... steps=0/1/4`
  - `unsatisfiable-interaction-auto-skipped empty-options`

## 逐簇判断

### A. 可直接 `resolved`

- `69f955364590ce09779a706b`
  - `force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - 归因：offensiveRoll legal-only 旧聚合项，已被 DiceThrone roll/hidden-response/watchdog 修复链覆盖。
- `69f9ce714590ce09779a7591`
  - `force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - 归因：defensiveRoll legal-only 旧聚合项，同属已修簇残留。
- `69f84a939ec13b96d7110366`
  - `force-end-turn-failed active-turn-legal-only:follow-up-advance:command_failed`
  - 归因：旧的裸推进命名残留，已被 legal-only 语义收敛取代。
- `69f8c9779ec13b96d71116e1`
  - `unsatisfiable-interaction-auto-skipped empty-options`
  - 归因：无解交互自动跳过已在 `server.ts` 里补成明确 `resolved` 语义。
- `69f8b1489ec13b96d7111210`
  - `unsatisfiable-interaction-auto-skipped empty-options`
  - 同上。
- `69f8a6d39ec13b96d711101c`
  - `unsatisfiable-interaction-auto-skipped empty-options`
  - 同上。
- `69f8a50b9ec13b96d7110f87`
  - `unsatisfiable-interaction-auto-skipped empty-options`
  - 同上。
- `69f898f19ec13b96d7110d61`
  - `unsatisfiable-interaction-auto-skipped empty-options`
  - 同上。

### B. 建议 `closed`

- `69f863329ec13b96d71105f8`
  - `force-end-turn-success active-turn:follow-up-advance:steps=4`
- `69f8c9779ec13b96d71116e9`
  - `force-end-turn-success visible-interaction:recover-interaction:steps=0`
- `69f8b1489ec13b96d7111218`
  - `force-end-turn-success visible-interaction:recover-interaction:steps=0`
- `69f8a6d39ec13b96d7111024`
  - `force-end-turn-success visible-interaction:follow-up-advance:steps=1`
- `69f8a50b9ec13b96d7110f8f`
  - `force-end-turn-success visible-interaction:recover-interaction:steps=0`
- `69f898fa9ec13b96d7110d71`
  - `force-end-turn-success seat-legal-only:follow-up-advance:steps=0`
- `69f898f19ec13b96d7110d69`
  - `force-end-turn-success visible-interaction:follow-up-advance:steps=1`

## 结论

- 这批里：
  - `8` 条应回写 `resolved`
  - `7` 条应回写 `closed`
- 验证命令已通过：
  - `src/engine/transport/__tests__/server.test.ts`
  - 覆盖 `legal-only / displayOnly / human response window / hidden interaction / emergency skip` 相关回归

## 当前阅读说明

- 本文是历史 watchdog 批量 closeout 记录，不是 DiceThrone 当前总审计出口。
- 文中的 `resolved/closed` 只代表 2026-05-07 当时批量处置判断，不能替代当前新英雄默认全面审计留档所需的对象级矩阵、批次级 `L4` 判等与现行 evidence 入口。
