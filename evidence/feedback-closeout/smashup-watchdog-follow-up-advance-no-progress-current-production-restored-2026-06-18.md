# SmashUp 系统反馈待回写（active-turn:follow-up-advance:no_progress，5 条）

## 范围

- 游戏：`smashup`
- 反馈原文：
  - `[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:no_progress`
- 本轮确认的 5 条反馈：
  - `6a3000fcc1f9d45aea62ba94`
  - `6a3000ffc1f9d45aea62ba9c`
  - `6a311637e7db65695ded8020`
  - `6a3117b1e7db65695ded8028`
  - `6a314d02e7db65695ded8179`

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet` -> `boardgame.feedbacks`
- 当前线上部署镜像标签：
  - `boardgame-game-server`
  - `org.opencontainers.image.revision = b1257224dc08bdb02095c85eb40c4b40b2e14228`
  - `org.opencontainers.image.created = 2026-06-17T17:47:35.734Z`

## 当前生产现场

- 5 条反馈共同特征已经锁到：
  - 全部 `gameId = smashup`
  - 全部 `phase = scoreBases`
  - 全部 `playerId = 1`
  - 全部 `reason = active-turn`
  - 全部 `responseWindow = null`
  - 全部只剩 1 个合法动作：
    - `ADVANCE_PHASE`
  - AI 决策预览也一致选择：
    - `ADVANCE_PHASE`
- 对应牌局分布：
  - `M2KbAHQ7hix`：`2` 条
  - `icdPwXododM`：`2` 条
  - `juCY7nJBlpQ`：`1` 条
- 现实含义：
  - 这 5 条都不是“可见交互仍在眼前但没人点”
  - 而是“交互恢复后，现场已经切到只剩自然过阶段；watchdog 当时没有顺势补最后一步 ADVANCE_PHASE，于是把 incident 记成 no_progress”

## 与当前部署的时间关系

- 这 5 条反馈的 `updatedAt` 全都早于当前线上镜像创建时间：
  - 最早：`2026-06-15T13:41:16.532Z`
  - 最晚：`2026-06-16T13:17:54.499Z`
  - 当前线上镜像创建：`2026-06-17T17:47:35.734Z`
- 本轮继续复核：
  - 在 `updatedAt >= 2026-06-17T17:47:35.734Z` 的范围内，再查询同文案
    - `[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:no_progress`
  - 结果：`0` 条
- 现实含义：
  - 当前线上部署后，没有继续产生同类新单
  - 这 5 条更像旧部署阶段遗留的历史系统反馈，而不是当前线上仍在持续复现

## 当前树验证

- 本地当前工作区 `HEAD`：
  - `419e723f930a3ac0135356f9128c94411d82f0cb`
- `b1257224dc08bdb02095c85eb40c4b40b2e14228..HEAD` 在以下关键文件上**没有差异**：
  - `src/engine/transport/__tests__/server.test.ts`
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
  - `src/games/smashup/abilities/titans.ts`
- 现实含义：
  - 本轮本地 focused 回归结果可以直接用于说明**当前线上部署所携带的 recovery 代码**，不是“本地新修但线上没带上”

## 本轮 focused 回归

- transport / watchdog：
  - `pnpm vitest run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 遇到同一 AI 的链式可见交互时，应在单次恢复序列内持续消费直到收口|online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败|smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted"`
  - 结果：`3 passed`
- SmashUp scoreBases auto-continue：
  - `pnpm vitest run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native -t "smashup_reaction_choose 从持久化恢复后只剩失效 special 快照时，AI 应按 live session 直接选择 pass|wizards_arcane_protector 已进场后，afterScoring live 反应不应继续暴露其 special"`
  - 结果：`2 passed`

## 本轮附带修补

- 文件：
  - `src/engine/transport/__tests__/server.test.ts`
- 改动现实含义：
  - 给 `transport` 测试夹具补了 SmashUp 最小 `factions`
  - 作用是避免 `persisted stale reaction` focused 回归先被测试夹具缺字段打断
- 边界：
  - 仅测试夹具修补，不触碰业务实现

## 当前状态

- 反馈本体结论：`resolved（待正式回写）`
- 理由：
  - 5 条现场都落在“交互恢复后只剩自然 ADVANCE_PHASE”的 follow-up family
  - 当前线上部署后的同类新单查询结果为 `0`
  - 当前线上部署携带的相关 recovery 代码与本地 focused 回归所验证代码一致
  - focused transport / scoreBases auto-continue 回归均通过

## 收口结论

- 这 5 条不应继续按“当前线上仍在持续复现的 open bug”推进。
- 更准确的口径是：
  - `当前生产已恢复`
  - `这 5 条是旧部署阶段残留的系统反馈`
  - `可以按 resolved 正式回写，但仍需用户明确授权生产 Mongo 直写`
