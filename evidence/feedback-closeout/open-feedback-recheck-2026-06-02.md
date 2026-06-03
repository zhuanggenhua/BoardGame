# 线上 open 反馈复核（2026-06-02）

## 范围

- 生产库 `boardgame.feedbacks`
- 仅复核本轮实际抽查并本地实跑的 open 反馈
- 本轮不做生产状态回写；只给出代码归因与当前主线验证结论

## 结论

- 以下 4 条 open 反馈，经当前主线代码 + 定向 Vitest / E2E 复核，均已不再是当前 worktree 的活 bug，更像“当时已修但反馈状态未回写”的遗留：
  - `6a10f99860e79fcbd0ad7281` `smashup` `p4只选了一个派系`
  - `6a104b8a9dcbdc48317ef810` `smashup` `force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - `6a0d029d97171f579fd60e69` `smashup` `force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - `69ed86efa0adf1cb68601c12` `summonerwars` `神出鬼没的效果无法点击使用啊`
- 本轮没有修改业务代码；当前动作是“确认现状 + 落证据”，不是再次修同一缺陷。

## 逐条复核

### 1. SmashUp 四人房 `p4只选了一个派系`

- 反馈：
  - `_id = 6a10f99860e79fcbd0ad7281`
  - `createdAt = 2026-05-23T00:49:28.196Z`
  - `matchId = GcvyjdAqRwO`
  - 内容：`p4只选了一个派系`
- 提交归因：
  - `1ef513cb` `2026-05-23 15:05:21 +0800`：修复 `SmashUp 联机选派系`
  - `d3f9f300` `2026-05-23 17:46:50 +0800`：补强 `SmashUp 选秀链路与房间 AI 顺序占座`
- 当前主线验证：
  - `npm run test:e2e:ci:file -- e2e/manual-ai-setup-selection.e2e.ts "SmashUp 四人房房主可依次为 3 个 AI 完成派系选择并进入对局"`
  - 结果：通过
- 当前结论：
  - 当前主线下，房主可依次为 `P1/P2/P3` 三个 AI 完成双派系蛇形选秀，并最终进入对局；`P4 只拿到 1 个派系` 的问题未复现。

### 2. SmashUp watchdog `active-turn-legal-only:legal_action_unavailable`

- 反馈：
  - `_id = 6a104b8a9dcbdc48317ef810`
  - `_id = 6a0d029d97171f579fd60e69`
  - `createdAt = 2026-05-22 / 2026-05-20`
  - 内容：`[system][online-ai-watchdog] force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
- 提交归因：
  - `fd5026b8` `2026-05-23 08:05:04 +0800`
  - 关键修复：`server.ts` 增加 `shouldSuppressOnlineAiWatchdogForManualFactionSelection(...)`，避免手动代选派系阶段继续把合法动作缺失写成 watchdog 噪音失败。
- 当前主线验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在手动代 AI 选派系阶段不应上报 legal_action_unavailable 噪音反馈|SmashUp factionSelect 同一玩家连续选派系时，playerSelections/takenFactions 变化也应被视为进展|online AI watchdog 在 factionSelect 阶段应走 legal-action recovery，而不是 fallback ADVANCE_PHASE"`
  - 结果：3 条定向用例全部通过
- 当前结论：
  - 当前主线已覆盖 `factionSelect` / `manualFactionSelection` / `legal-action recovery` 的直接门禁；这两条 open system feedback 更像修复前遗留。

### 3. SummonerWars `神出鬼没` 无法点击使用

- 反馈：
  - `_id = 69ed86efa0adf1cb68601c12`
  - `createdAt = 2026-04-26T03:30:55.896Z`
  - `matchId = Qpg3Xp6NtLA`
  - 内容：`神出鬼没的效果无法点击使用啊`
- 生产快照要点：
  - `actionLog` 已出现 `发动技能：神出鬼没 来源：思尼克斯`
  - 说明当时至少走到了 `ACTIVATE_ABILITY(vanish)` 的启动入口
- 当前主线验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "神出鬼没|\\[vanish\\]"`
  - 结果：8 条定向测试通过
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-goblin-abilities.e2e.ts "神出鬼没：与0费友方单位交换位置"`
  - 结果：通过
- 当前结论：
  - 当前主线下，`神出鬼没` 的真实入口可点击、可进入目标选择，并可完成交换位置；该反馈未在当前代码复现。

## 当前边界

- 本轮未做：
  - 生产部署
  - `feedbacks` 集合状态回写
  - 批量关闭 open 反馈
- 原因：
  - 当前对话只完成了“代码真相复核 + 本地实跑验证”
  - 根规范要求未经确认不要直接改线上状态

## 建议

- 若下一步目标是清线上工单，可优先把本文件覆盖的 4 条 open 反馈做状态回写。
- 若下一步目标是继续找“当前仍活着的线上 bug”，应从尚未复核的 open 反馈继续逐条抽查，而不是重复修这 4 条。
