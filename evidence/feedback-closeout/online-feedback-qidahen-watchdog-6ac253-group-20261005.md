# 线上系统反馈分诊：Qidahen online-ai-watchdog 重复组（2026-10-05）

## 反馈原文（线上真实源，逐条保留）

代表事故：`gFcL89L2elS`，`playerId=1`，`appVersion=0.6.47`，创建时间集中在 `2026-10-04T13:25:57.102Z` 至 `2026-10-04T13:26:07.563Z`。5 条为同一 watchdog 事故的不同告警层级，不能分别当成 5 个根因：

1. `6ac253e58e134ec1dfb0dc17`
   `[system][online-ai-watchdog] ADVANCE_PHASE unknownCommand`
2. `6ac253e68e134ec1dfb0dc27`
   `[system][online-ai-watchdog] repeated-recovery-suppressed active-turn:repeat-limit:3/3:force_advance_failed:ADVANCE_PHASE:unknownCommand`
3. `6ac253ef8e134ec1dfb0dc35`
   `[system][online-ai-watchdog] circuit-breaker-tripped unknownCommand`
4. `6ac253ef8e134ec1dfb0dc3d`
   `[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed:ADVANCE_PHASE:unknownCommand`
5. `6ac253ef8e134ec1dfb0dc45`
   `[system][online-ai-watchdog] repeated-recovery-suppressed active-turn:repeat-limit:2/3:force_advance_failed:ADVANCE_PHASE:unknownCommand`

## 发现的问题

根因已确认是恢复策略与游戏命令合同不一致，不是单纯“重复告警”：七大恨 `QIDAHEN_COMMANDS` 没有通用 `ADVANCE_PHASE`；线上事故状态却进入通用 active-turn fallback，watchdog 向七大恨发送 `ADVANCE_PHASE`，服务端返回 `unknownCommand`，随后重复恢复、熔断和压制告警连锁发生。

事故快照还显示 `sys.phase=""`、`core.turnPhase="action-window"`、`currentPlayer="1"`，但 `pendingScenarioCharacterChoices` 仍属于 `jin`（player `0`），且 `legalActions.total=0`。这说明恢复归属也曾被错误地落到当前轮玩家，漏掉了真正拥有剧本前置选择的 AI seat。

## 处理方式 / 修复结果

- 在现有 `src/games/qidahen/game.ts` 的 `onlineAiRecovery` 配置中加入 `disableFallbackAdvancePhase: true`，七大恨不再生成通用裸 `ADVANCE_PHASE`；无合法动作时保持 legal-only 诊断，由游戏自己的合法命令恢复链处理。
- 保留并验证现有 `resolveQidahenOnlineAiCurrentPlayerId`：当剧本人物/军备待选项存在时，恢复 seat 取待选势力对应的 `playerId`，而不是盲用 `core.currentPlayer`。
- 在 `src/games/qidahen/__tests__/ai.test.ts` 增加同态回归：事故快照形状下 watchdog 恢复归属为 player `0`；候选结果为 `active-turn-legal-only`，命令列表为空，明确禁止 `ADVANCE_PHASE`。

验证：

- `npx vitest run src/games/qidahen/__tests__/ai.test.ts` → 5 tests passed。
- `npx vitest run src/engine/transport/__tests__/onlineAiWatchdogPregameAndOffturnRecovery.test.ts` → 15 tests passed。

## 当前状态

本地根因修复与回归已完成；线上 5 条反馈仍待发布并回查生产版本，当前不能写成线上已生效。5 条按同一事故组跟随代表项收口。

## 剩余风险

若不发布包含上述 `qidahen/game.ts` 的版本，生产旧镜像仍可能继续发 `ADVANCE_PHASE`。发布后需用真实 Qidahen AI 入口或同房间回查确认：待选人物/军备由正确 seat 执行合法命令，且不再产生 `unknownCommand`、`force-end-turn-failed`、`circuit-breaker-tripped`。

## 漏审复盘

现有 watchdog 规范覆盖了 legal-only / fallback 分流，但七大恨游戏配置此前未声明“无通用阶段推进命令”，因此通用 fallback 默认值穿透到该游戏；这是单游戏 engine config 合同缺口，已由本次 `disableFallbackAdvancePhase` 配置和回归补上。通用规范暂不新增第二套规则。
