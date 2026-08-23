# 线上反馈收口 - Smash Up watchdog 后续批次（2026-08-24）

## 口径

- 口径：线上真实反馈。
- 真相源：`https://api.easyboardgame.top/admin-api/feedback` 拉取包 `temp/feedback-closeout/2026-08-23T16-29-05-453Z/summary.json`。
- 抓取时间：`2026-08-23T16:29:06.845Z`。
- 本轮未执行部署；状态回写只表示当前代码树已经修复并通过定向验证。

## 反馈组

| 反馈 | 游戏 | 现实症状 | 结论 |
| --- | --- | --- | --- |
| `6a8ae7d0446de293e25ff7db` | Smash Up | 在线 AI 在公开选派系阶段恢复失败，无法通过合法动作继续选派系 | 已修复 |
| `6a8ae7d1446de293e25ff7e3` | Smash Up | 同一卡点重复恢复 3 次后，系统裸发阶段推进命令，把仍处在选派系进度的对局强推到出牌阶段 | 已修复 |

## 真实证据

- 第一条诊断包显示现实阶段是 `factionSelect`，当前玩家是 AI 座位 `1`，进度标记显示 AI 已选 `samurai,shapeshifters`，真人座位 `0` 仍未选，合法动作列表为空。
- 第二条诊断包显示状态快照已经到 `playCards`，但进度标记仍保留 `factionSelect` 的选派系进度；合法动作只剩 `ADVANCE_PHASE`，说明重复恢复的强制兜底已经把预开局公开选择阶段错误推走。
- 这两条是同一条在线 AI 恢复链路的前后表现：先在选派系阶段没有安全恢复动作，随后重复恢复达到上限后用了裸阶段推进止血。

## 根因分层

- 现实故障现象：公开选派系阶段没有让 AI 继续通过 `SELECT_FACTION` 这类合法选派系动作恢复，最后把未完成的选派系流程推到了出牌阶段。
- 直接触发条件：自动恢复链路把 `factionSelect` 识别成 active-turn legal-action-only 卡点，但重复恢复兜底仍允许补 `ADVANCE_PHASE`。
- 止血动作为什么发生：旧逻辑在重复失败达到上限后尝试用阶段推进命令打破卡点；这能让监控不再停在原阶段，但会跳过公开预开局选择流程。
- 根本机制：`resolveForceAdvancePhaseAfterRecovery` 只把普通 active-turn legal-action-only 阶段纳入禁止裸推进门禁，没有把公开预开局合法动作阶段一起纳入；因此 `publicPregameLegalActionPhases` 配置下的 `factionSelect` 仍可能在 repeat-limit 兜底里被裸 `ADVANCE_PHASE` 推走。

## 修复

- `src/engine/transport/onlineAiRecovery.ts`：`resolveForceAdvancePhaseAfterRecovery` 现在同时检查 `isOnlineAiWatchdogActiveTurnLegalActionOnlyPhase` 和 `isOnlineAiWatchdogPublicPregameLegalActionPhase`。
- 对公开预开局合法动作阶段，如果游戏配置没有显式允许 `allowForceCommandAfterLegalActionExhausted`，重复恢复时返回空，不再补裸 `ADVANCE_PHASE`。
- 普通出牌阶段仍保留原兜底：Smash Up `playCards` 中合法动作执行后没有进展时，仍可用 `ADVANCE_PHASE` 收口，避免误伤正常在线 AI 恢复。

## 验证

- `node scripts\infra\vitest-cli-safe.mjs run src\engine\transport\__tests__\onlineAiRecovery-gameover.test.ts src\engine\transport\__tests__\onlineAiRepeatedRecoveryUnblockExecutor.test.ts src\engine\transport\__tests__\onlineAiRepeatedRecoveryCoordinator.test.ts --configLoader native`
  - 3 files passed / 66 tests passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\smashup\__tests__\factionSelection.test.ts --configLoader native`
  - 1 file passed / 49 tests passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\engine\transport\__tests__\server.test.ts --configLoader native -t "online AI watchdog 在 factionSelect 阶段应走 legal-action recovery，而不是 fallback ADVANCE_PHASE"`
  - passed，确认公开选派系阶段执行 `SELECT_FACTION`，不执行 `ADVANCE_PHASE`。
- `node scripts\infra\vitest-cli-safe.mjs run src\engine\transport\__tests__\server.test.ts --configLoader native -t "online AI watchdog 在 SmashUp playCards 的合法动作无进展时，应 fallback 到 ADVANCE_PHASE 收口"`
  - passed，确认普通出牌阶段兜底未被误关。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 1 file passed / 281 tests passed，确认 pre-push 暴露的在线 AI watchdog / recovery tracker 指纹兼容问题已收口。

## 状态回写建议

- `6a8ae7d0446de293e25ff7db`、`6a8ae7d1446de293e25ff7e3`：`resolved`，说明“已修复在线 AI 在 Smash Up 派系选择阶段的恢复兜底：公开预开局选派系阶段只允许通过合法选派系动作恢复，不再在重复失败后裸发阶段推进命令强推到出牌阶段；本次未部署。”
