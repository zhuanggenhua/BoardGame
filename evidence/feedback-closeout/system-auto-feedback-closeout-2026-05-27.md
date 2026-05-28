# 系统自动反馈收口（2026-05-27）

## 范围

- 生产真源：`boardgame.feedbacks`
- 查询时间：`2026-05-27 23:23:16 +08:00`
- 正式写入口：生产 Mongo
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh --quiet boardgame`
- 本轮目标：清掉当前全部 `reporterType=system && status in [open,in_progress]`

## 线上现状

本轮最小分诊拉到 7 条系统单：

- `online-ai-watchdog = 3`
- `player-command-failure = 4`

具体 ID：

- `6a1530c1ce7f290e28539b24` `summonerwars`
- `6a15757bce7f290e28539d58` `smashup`
- `6a15ecebce7f290e2853a321` `smashup`
- `6a15d18ace7f290e2853a2e7` `smashup`
- `6a15d19fce7f290e2853a2eb` `smashup`
- `6a15d1e2ce7f290e2853a2f8` `smashup`
- `6a15d225ce7f290e2853a2fc` `smashup`

## 分组结论

### 1. SummonerWars pregame 等 host 噪音反馈

- 反馈：`6a1530c1ce7f290e28539b24`
- 内容：`active-turn-legal-only:follow-up-advance:legal_action_unavailable`
- 结论：不是新的线上根因，而是已知 pregame waiting-host 噪音口径。
- 依据：
  - `stateSnapshot` 显示：
    - `gameId = summonerwars`
    - `phase = summon`
    - `turnNumber = 0`
    - `hostStarted = false`
    - AI 座位 `selectedFactions['1']='trickster'`
    - `readyPlayers['1']=true`
    - 当前只是等待 human host。
  - 现有回归已覆盖：
    - `online AI watchdog 在 summonerwars pregame 已 ready 但仍等待 human host 时，不应上报 legal_action_unavailable 噪音反馈`
- 状态结论：`resolved`

### 2. SmashUp Haunted House live drift 导致 watchdog 无效选择

- 反馈：
  - `6a15757bce7f290e28539d58`
  - `6a15ecebce7f290e2853a321`
- 内容：
  - `visible-interaction:recover-interaction:legal_action_command_failed:SYS_INTERACTION_RESPOND:无效的选择`
- 共同形状：
  - shared 交互仍保留 `鬼屋：选择要弃掉的卡牌` 的旧手牌选项；
  - seat-view 已退化成只剩 `__emergency_skip__`；
  - watchdog 选中了 emergency skip，但服务端按 authoritative old options 校验，最终报 `无效的选择`。
- 本轮修复：
  - `src/engine/transport/server.ts`
  - 当 AI seat 提交的 `RESPOND` 实际是 `__emergency_skip__` 时，服务端先按 seat-view 识别为“无解交互收口”，再翻译成 `SYS_INTERACTION_CANCEL` 执行，避免继续撞 shared 旧选项校验。
- 状态结论：`resolved`

### 3. SmashUp ADVANCE_PHASE 因 legacy null 崩溃

- 反馈：
  - `6a15d18ace7f290e2853a2e7`
  - `6a15d19fce7f290e2853a2eb`
  - `6a15d1e2ce7f290e2853a2f8`
  - `6a15d225ce7f290e2853a2fc`
- 内容：
  - `[system][command-failed] ADVANCE_PHASE pipeline_error: indices is not iterable`
- 共同根因：
  - 线上快照里 `core.scoringEligibleBaseIndices = null`
  - `getScoringEligibleBaseIndices()` 只检查了 `!== undefined`，直接把 `null` 喂给 `normalizeScoringEligibleBaseIndices()`，在 `for (const index of indices)` 处崩溃。
- 本轮修复：
  - `src/games/smashup/domain/ongoingModifiers.ts`
  - 只有真实数组才走锁定值；`null` / 旧脏值统一回退到实时计算。
- 复现与验证：
  - 先把 `6a15d18a...` 的 `stateSnapshot` 拉到本地；
  - 修复前直接复放该快照执行 `ADVANCE_PHASE`，可稳定打到：
    - `ongoingModifiers.ts: normalizeScoringEligibleBaseIndices`
    - `TypeError: indices is not iterable`
  - 修复后同一快照复放结果：
    - `success = true`
    - `eventCount = 4`
- 状态结论：`resolved`

## 代码改动

- `src/engine/transport/server.ts`
  - AI `__emergency_skip__` 先翻译成 `SYS_INTERACTION_CANCEL`，保留无解交互诊断 reason。
- `src/games/smashup/domain/ongoingModifiers.ts`
  - `scoringEligibleBaseIndices` 仅在为数组时直接使用；旧 `null` 脏值改为安全回退。

## 回归测试

### Transport / watchdog

```bash
node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts src/games/smashup/__tests__/scoring-eligible-base-indices-regression.test.ts --configLoader native --maxWorkers 1 --testNamePattern "summonerwars pregame 已 ready 但仍等待 human host|AI 走无解交互 emergency skip 时，服务端应立即自动反馈|AI seat-view 只剩 emergency skip、但 authoritative interaction 仍保留旧选项时，应翻译成 CANCEL 收口|旧快照把 scoringEligibleBaseIndices 写成 null 时，应回退到实时计算而不是崩溃"
```

结果：

- `2 files passed`
- `4 passed`

### Haunted House 领域回归

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/bases/haunted-house-al9000-base.test.ts src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts --configLoader native --maxWorkers 1 --testNamePattern "响应前若手牌已被清空，应允许 emergency skip 且不再弃牌|鬼屋交互在旧快照仍保留手牌、但 live 手牌已空时，AI 应改发 emergency skip"
```

结果：

- `2 files passed`
- `2 passed`

### 线上快照直重复放

```bash
npx tsx - < temp replay script for feedback 6a15d18a stateSnapshot >
```

关键结果：

- 修复后 `ADVANCE_PHASE -> success=true`
- `eventCount=4`

## 本轮回写口径

- `resolved`
  - `6a1530c1ce7f290e28539b24`
  - `6a15757bce7f290e28539d58`
  - `6a15ecebce7f290e2853a321`
  - `6a15d18ace7f290e2853a2e7`
  - `6a15d19fce7f290e2853a2eb`
  - `6a15d1e2ce7f290e2853a2f8`
  - `6a15d225ce7f290e2853a2fc`

## 结论

- 本轮 7 条系统自动反馈可按“已有修复链 + 本轮新增修复 + 定向验证”统一收口。
- 其中：
  - 1 条是已知 SummonerWars pregame waiting-host 噪音；
  - 2 条是 Haunted House live drift 的 watchdog 恢复缺口；
  - 4 条是 `scoringEligibleBaseIndices=null` 的旧快照兼容缺口。
