# 2026-06-18 可安全回写批次（待授权）

## 时间与口径

- 查询时间：`2026-06-18T03:17:11.7179860+08:00`
- 真相源口径：生产 Mongo `boardgame.feedbacks`
- 当前文档只覆盖**已经锁定结论、但尚未拿到生产 Mongo 直写授权**的条目。

## 可安全回写范围

### 1. Dice Throne `ADVANCE_PHASE:not_active_player`

- 当前仍为 `open`：`86` 条
- 反馈现实含义：
  - 系统自动反馈里记录的是“Dice Throne 在防御结算链路里，服务端把防御方的推进阶段命令拒绝成‘不是当前行动玩家’”
- 结论：`resolved`
- 理由：
  - 当前仓库已有定向回归覆盖该链路。
  - 本轮重新补齐 transport 测试夹具后，回归再次通过。
- 本轮验证：
  - `pnpm vitest run src/engine/transport/__tests__/server.test.ts --configLoader native -t "Dice Throne 服务端在 defensiveRoll 应允许防御方执行 ADVANCE_PHASE，避免把真人/AI 防御方误拒成 not_active_player" -> 1 passed`
- 既有证据：
  - `evidence/feedback-closeout/dicethrone-watchdog-advance-phase-not-active-player-closeout-2026-06-15.md`

### 2. 七大恨 `t is not defined`

- 当前仍为 `open`：`3` 条
- 结论：`resolved`
- 理由：
  - 历史真实前端崩溃已被当前树覆盖。
  - 当前树真实联机 E2E 与结构测试都通过。
- 本轮可复用验证：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen/online-full-round-second-round.e2e.ts "真实联机 match 从局内剧本投票走到第二回合开始" -> 1 passed`
  - `pnpm vitest run src/games/qidahen/__tests__/Board.test.ts --configLoader native -> 171 passed`
- 既有证据：
  - `evidence/feedback-closeout/qidahen-feedback-6a32c96c-t-is-not-defined-current-tree-restored-2026-06-18.md`

### 3. SmashUp《集会场》`addTempPower is not defined`

- 当前仍为 `open`：`2` 条
- 结论：`resolved`
- 理由：
  - 真实业务 bug 已锁定为《集会场》（`base_moot_site`）能力漏导入 `addTempPower`
  - 当前树已修复并通过最窄回归
- 本轮可复用验证：
  - `pnpm vitest run src/games/smashup/__tests__/bases/moot-site-base.test.ts --configLoader native -> 4 passed`
- 既有证据：
  - `evidence/feedback-closeout/smashup-feedback-6a320034-6a320062-moot-site-addtemppower-closeout-2026-06-18.md`

### 4. SmashUp《沉船湾》“积分后发动不了”

- 当前仍为 `open`：`1` 条
- 结论：`closed`
- 理由：
  - 当前树下《沉船湾》仍能在计分后进入统一反应窗。
  - 旧浏览器 E2E 失败暴露的是旧 helper 还在等旧入口，不是“能力没发动”。
- 本轮可复用验证：
  - `pnpm vitest run src/games/smashup/__tests__/abilities/mermaids.test.ts --configLoader native -t "mermaids_shipwreck_cove" -> 2 passed`
  - `pnpm vitest run src/games/smashup/__tests__/reactionQueueSourceRuntimeContext.test.ts --configLoader native -t "mermaids_shipwreck_cove" -> 3 passed`
- 既有证据：
  - `evidence/feedback-closeout/smashup-feedback-6a32b526-shipwreck-cove-current-tree-restored-2026-06-18.md`

### 5. Dice Throne `RESPONSE_PASS:交互处理中，无法跳过响应`

- 当前仍为 `open`：`1` 条
- 反馈现实含义：
  - 系统自动反馈里记录的是“响应窗口已经切到新的窗口实例，但 watchdog 还沿旧窗口尝试跳过响应”
- 结论：`resolved`
- 理由：
  - 这是共享 transport continuity 问题，不是新的 Dice Throne 领域规则 bug。
  - 本轮补齐测试夹具后，`response-loop` 的窗口漂移回归重新通过。
- 本轮验证：
  - `pnpm vitest run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在 response-loop 仅切到新的 window id 且 progress marker 未变时，应继续沿新窗口收口而不是上报 no_progress|online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因" -> 2 passed`
- 既有证据：
  - `evidence/feedback-closeout/system-auto-feedback-closeout-2026-06-04-remaining-watchdogs.md`

### 6. SmashUp `SYS_INTERACTION_RESPOND:无效的选择`

- 当前仍为 `open`：`1` 条
- 反馈现实含义：
  - 系统自动反馈里记录的是“SmashUp 在积分后的统一反应窗里，可见选项已经刷新成《时空旅行者跳跃者》（`time_travelers_jumper`）/ `pass`，但 watchdog 还沿旧候选去点，最终被系统拒成‘无效的选择’”
- 结论：`resolved`
- 理由：
  - 这是 shared transport / tracker continuity 问题，不是《时空旅行者跳跃者》业务链本体坏了。
  - 本轮生产现场已经锁到：当前 prompt 真实可见的是 `time_travelers_jumper` 与 `pass`，但 AI 决策预览仍拿旧候选 `base_wizard_academy`。
  - 当前树的 visible simple-choice 候选漂移回归已经覆盖这类场景，SmashUp 领域链本体回归也通过。
- 本轮验证：
  - `pnpm vitest run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在 visible simple-choice 的 option value 漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress|tryRecoverOnlineAiWithLegalAction 在 visible simple-choice 仅 option value 漂移且 progress marker 不变时，也应视为已推进|online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因" -> 3 passed`
  - `pnpm vitest run src/games/smashup/__tests__/reactionQueueEventPlayerContext.test.ts --configLoader native -t "sourceController queued onCardReturnedToHand trigger 仍应把 Time Box 的第 5 枚计数 prompt 交给拥有者" -> 1 passed`
- 既有证据：
  - `evidence/feedback-closeout/system-auto-feedback-closeout-2026-06-04-remaining-watchdogs.md`
  - `evidence/feedback-closeout/smashup-watchdog-6a327ea0-stale-option-current-tree-restored-2026-06-18.md`

### 7. SmashUp `active-turn:follow-up-advance:no_progress`

- 当前仍为 `open`：`5` 条
- 反馈现实含义：
  - 系统自动反馈里记录的是“SmashUp 在计分链路里，交互恢复后现场已经只剩自然推进阶段，但 watchdog 当时没有顺势补最后一步 `ADVANCE_PHASE`，最终把 incident 记成 `no_progress`”
- 结论：`resolved`
- 理由：
  - 这 5 条全部锁到同一类现场：`scoreBases`、`playerId=1`、只剩 `ADVANCE_PHASE`、AI 决策预览也同样选择 `ADVANCE_PHASE`。
  - 这 5 条反馈都早于当前线上镜像创建时间 `2026-06-17T17:47:35.734Z`。
  - 继续查询发现：当前线上部署后，没有再出现同文案的新条目。
  - 当前线上部署携带的 recovery 关键文件与本地 focused 回归验证文件一致，没有额外代码差异。
  - 本轮 focused transport / scoreBases auto-continue 回归都通过，能直接覆盖“交互恢复后只剩自然过阶段”“持久化 stale reaction 只剩 pass 后应自动收口”这条 family。
- 本轮验证：
  - `pnpm vitest run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 遇到同一 AI 的链式可见交互时，应在单次恢复序列内持续消费直到收口|online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败|smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted" -> 3 passed`
  - `pnpm vitest run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native -t "smashup_reaction_choose 从持久化恢复后只剩失效 special 快照时，AI 应按 live session 直接选择 pass|wizards_arcane_protector 已进场后，afterScoring live 反应不应继续暴露其 special" -> 2 passed`
- 既有证据：
  - `evidence/smashup/smashup-watchdog-open-20260507-batch-closeout.md`
  - `evidence/feedback-closeout/smashup-watchdog-follow-up-advance-no-progress-current-production-restored-2026-06-18.md`

## 本轮新增验证门禁修补

- 文件：
  - `src/engine/transport/__tests__/server.test.ts`
- 改动现实含义：
  - 给 transport 测试用的通用玩家状态补了最小 `resources / statusEffects / abilities / factions`
  - 作用是避免 `response-loop` 与 SmashUp `persisted stale reaction` 相关回归，在进入真实 recovery 逻辑前因为测试夹具缺字段先崩掉
- 本轮 diff：
  - 仅测试夹具改动，不触碰业务实现
- 本轮复跑结果：
  - `pnpm vitest run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 在 response-loop 仅切到新的 window id 且 progress marker 未变时，应继续沿新窗口收口而不是上报 no_progress|Dice Throne 服务端在 defensiveRoll 应允许防御方执行 ADVANCE_PHASE，避免把真人/AI 防御方误拒成 not_active_player|online AI watchdog 强制恢复命令失败时，自动反馈应携带命令类型和真实失败原因|online AI watchdog 在交互合法动作后若切到同一 AI 的 active-turn legal-only 且 force fallback 后进入 seat-legal-only 时，应继续 watchdog 收口而不是吞成 no_progress" -> 4 passed`
  - `pnpm vitest run src/engine/transport/__tests__/server.test.ts --configLoader native -t "online AI watchdog 遇到同一 AI 的链式可见交互时，应在单次恢复序列内持续消费直到收口|online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败|smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted" -> 3 passed`

### 8. client `好友请求不存在`

- 当前仍为 `open`：`1` 条
- 结论：`closed`
- 理由：
  - 生产真源锁到经典主页好友请求 modal 中点击“接受”后，旧前端把“请求已失效”冒成了全局未处理拒绝。
  - 当前 `FriendList` 按钮入口已经显式 catch 接受/拒绝失败，不再冒成全局 `unhandledrejection`。
  - 当前线上镜像时间之后没有新的同文案。
- 本轮验证：
  - `pnpm vitest run src/components/social/__tests__/FriendList.test.tsx --configLoader native -> 2 passed`
- 既有证据：
  - `evidence/feedback-closeout/client-feedback-6a2bf962-stale-friend-request-current-tree-restored-2026-06-18.md`

### 9. SmashUp `Maximum call stack size exceeded`

- 当前仍为 `open`：`1` 条
- 结论：`closed`
- 理由：
  - 真实前端栈命中的是 `buildLegalActions` family，不是 Howler 音频递归簇。
  - 仓库已有同根因真实快照回放与 continuity 回归证据。
  - 当前线上镜像之后没有新的同文案继续出现。
- 可复用验证：
  - `npx tsx - < SmashUp 同根因真实快照回放 -> legalActionCount=0，无栈溢出>`
  - `pnpm vitest run src/engine/transport/__tests__/server.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native -t "online AI watchdog 在 visible simple-choice 的 option value 漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress|tryRecoverOnlineAiWithLegalAction 在 visible simple-choice 仅 option value 漂移且 progress marker 不变时，也应视为已推进|buildOnlineAiRecoveryFingerprint 在 visible simple-choice 的 option id/disabled 相同但 value 漂移时，也必须变化|极客的力量链式反制会为下一位响应者刷新新的维尔候选" -> 3 passed`
- 既有证据：
  - `evidence/feedback-closeout/feedback-closeout-2026-06-10-smashup-unhandledrejection-maximum-call-stack-old-bundle-closed.md`
  - `evidence/feedback-closeout/smashup-feedback-6a2e12e8-buildlegalactions-current-production-restored-2026-06-18.md`

### 10. client `React 520`

- 当前仍为 `open`：`2` 条
- 结论：`resolved`
- 理由：
  - 真实生产记录锁到七大恨从局内 `replaceState` 回 `/?game=qidahen` 的同一跳，且页面上仍有 modal。
  - 主页会按 `?game=qidahen` 立刻打开详情 modal；旧局内 modal 若未先清理，会和主页 modal 同跳重挂。
  - 本轮已统一把“游戏页返回大厅”入口改成先 `closeAll({ skipOnClose: true })`，再 `replace` 到大厅。
  - 这组反馈里至少有 `1` 条发生在当前线上镜像之后，因此不能按“历史残留已自然恢复”直接 `closed`。
- 本轮验证：
  - `pnpm vitest run src/lib/navigation/__tests__/navigateBackToLobbyWithModalCleanup.test.ts --configLoader native -> 2 passed`
  - `pnpm vitest run src/pages/__tests__/matchMissingConfirmation.test.tsx --configLoader native -> 3 passed`
- 既有证据：
  - `evidence/feedback-closeout/qidahen-react-520-game-to-home-modal-cleanup-closeout-2026-06-18.md`

## 对应待授权回写脚本

- `temp/feedback-closeout/update-feedback-status-20260618-safe-open-batch-if-authorized.js`

## 当前阻塞

- HTTP 正式回写接口仍是 `404`
- 本轮还没有拿到“允许直写生产 Mongo”的明确授权
