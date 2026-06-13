# SmashUp 自动反馈 7 条：计分后延迟清场 frame 所有权误判收口（2026-06-07）

## 范围

- 目标反馈：
  - `6a24e7496586220765eb6832`
  - `6a24e7806586220765eb6836`
  - `6a24e7446586220765eb682c`
  - `6a24e6e96586220765eb682a`
  - `6a24e6626586220765eb6814`
  - `6a24e6ac6586220765eb6822`
  - `6a24e6546586220765eb680e`
- 游戏：`smashup`
- 目标环境：生产 `boardgame.feedbacks`
- 原始生产包：
  - `temp/feedback-closeout/query-smashup-deferred-postscoring-cluster-20260607.raw.txt`

## 线上真实症状

- 这 7 条都是自动反馈，不是用户手填反馈。
- 表面上分成两类：
  - 自动托管收口失败：`online-ai-watchdog`
  - 玩家指令失败：`player-command-failure`
- 但真实报错一致，都是：
  - `SmashUp deferred post-scoring payload 丢失 scoreBases frame 所有权`
- 同一批反馈都落在同一个线上对局：
  - `matchId = 9Le6o2A5G_a`
- 同一条业务链：
  - `scoreBases` 计分后延迟清场
  - 当前交互是“立刻打出一个额外随从，或放弃这次机会”
  - 交互来源是 `smashup_immediate_extra_minion`

## 真相源与定位

- 真实线上快照显示：
  - 当前计分 frame `smashup:score-bases` 仍然存在
  - 该 frame 仍持有延迟清场数据 `deferredEvents`
  - frame 当前步骤已经进入 `awaiting-post-scoring-delay`
- 抛错点：
  - `src/games/smashup/domain/systems.ts`
- 根因锁定：
  - `src/games/smashup/domain/scoringSession.ts`
  - `isScoringSessionAwaitingDeferredResolution(...)` 之前只承认：
    - `awaiting-interactions`
    - `awaiting-response-window`
  - 没把真实线上会出现的 `awaiting-post-scoring-delay` 当作合法持有态。
- 结果：
  - 明明还是同一个合法的计分后延迟清场 frame，却被误判成“frame 所有权丢失”。

## 修复

- 修复文件：
  - `src/games/smashup/domain/scoringSession.ts`
- 修复内容：
  - `isScoringSessionAwaitingDeferredResolution(...)` 现在额外接受 `awaiting-post-scoring-delay`
- 回归测试：
  - `src/games/smashup/__tests__/scoreBases-deferred-finalization.test.ts`
  - 新增最窄回归：
    - 当延迟清场已进入 `awaiting-post-scoring-delay` 时，解决“立即额外随从”交互不应再误报 frame 所有权丢失

## 验证

- 已跑定向测试：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-deferred-finalization.test.ts --configLoader native -t "awaiting-post-scoring-delay|afterScoring 已完成清场换基地后"`
- 结果：
  - `2 passed | 13 skipped`

## 收口结论

- 这 7 条自动反馈指向的是同一个真实线上 bug，不是噪音。
- 当前树已补上 `awaiting-post-scoring-delay` 合法持有态，根因与线上快照一致。
- 因此这 7 条应按 `resolved` 收口，而不是 `closed`。
