# SmashUp 线上反馈 6a0fd77e / 6a101997 watchdog 复核

## 范围

- 游戏：SmashUp
- 线上只读复核时间：2026-05-25T15:26:27.579Z
- 反馈来源：生产机 `admin@8.148.71.102`，Mongo 容器 `boardgame-mongodb`，数据库 `boardgame`，集合 `feedbacks`
- 本轮未执行：生产反馈状态回写、部署、提交、push

## 覆盖反馈

### `6a0fd77e54110b2c54a26677`

- 状态：`open`
- 创建：2026-05-22T04:11:42.036Z
- 最后更新：2026-05-23T02:40:00.163Z
- occurrenceCount：1261
- 内容：`[system][online-ai-watchdog] force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
- 快照要点：
  - `phase=factionSelect`
  - `playerId=3`
  - `seatControllerType=local-ai`
  - `legalActions.total=55`
  - AI preview 选择 `select-faction:tricksters_pod`

### `6a10199754110b2c54a26ddd`

- 状态：`open`
- 创建：2026-05-22T08:53:43.484Z
- 最后更新：2026-05-22T08:55:16.021Z
- occurrenceCount：2
- 内容：`[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:legal_action_command_failed`
- 快照要点：
  - `phase=playCards`
  - `playerId=1`
  - `seatControllerType=local-ai`
  - `legalActions.total=10`
  - AI preview 选择 `activate-special:c69:0`，目标 `ninja_acolyte`

## 分诊结论

这两条与本轮新修的 `minionDefId is not defined`、`cardia:play_card:already_played_card_this_turn` 不是同一根因。

本轮没有从反馈文档中拿到 `legal_action_command_failed` 的具体领域拒绝文本，不能直接把某个 SmashUp 卡牌逻辑改动升格为根因修复。当前本地代码已有以下门禁：

- `buildSmashUpAiLegalActions` 对 `select-faction` 使用 `validate()` 过滤，并会避开已选普通版/POD 同身份派系。
- `online AI watchdog` 在 `factionSelect` legal-action-only 场景走合法动作恢复，不走裸 `ADVANCE_PHASE`。
- `online AI watchdog` 对 active-turn follow-up 有持续推进测试，避免首步成功后仍卡在同一 AI 时提前收口或误报 unavailable。

因此这两条目前按“当前代码已有覆盖 / 待部署或待状态回写复核”的旧 watchdog 反馈处理；本轮不新增业务逻辑补丁，避免把缺少具体拒绝原因的系统单误改成卡牌规则变更。

## 验证

SmashUp AI 派系选择与普通版/POD 去重：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1 -t "AI legal actions 支持四人局派系选择|Smash Up AI 选派系会避开已被拿走的派系|Smash Up AI 第二次选派系时不会把自己已拿的普通版/POD 别名再次列为候选|Smash Up AI 的 select-faction 应走隐式交互"
```

结果：4 passed。

factionSelect watchdog legal-action recovery：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 factionSelect legal-action-only 遇到 private overlay stale 时，也应使用 emergency playerView 重试合法动作|online AI watchdog 在 factionSelect legal-action-only 遇到 missing private overlay 时，也应使用 emergency playerView 重试合法动作|online AI watchdog 在 factionSelect 阶段应走 legal-action recovery，而不是 fallback ADVANCE_PHASE"
```

结果：3 passed。

active-turn follow-up：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 active-turn 卡死时应持续推进直到交还给真人回合|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且允许 force fallback 时，应继续执行 ADVANCE_PHASE"
```

结果：2 passed。

## 后续口径

- 若允许回写生产 Mongo，可将这两条按“当前代码已覆盖，需部署后观察/或作为旧单关闭”处理。
- 若后续线上再次出现同签名并带有具体 `command_failed:<command>:<error>`，应按新的拒绝文本重新分诊，不应直接复用本次结论。
