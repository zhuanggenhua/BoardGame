# 线上待处理反馈批次收口记录（2026-05-17）

## 范围

- 生产库 `boardgame.feedbacks`
- 查询时间：`2026-05-17 22:29:24 +08:00`
- 待处理记录共 4 条：
  - 真人反馈 3 条
    - `6a09bac1a2dfb1b7d690a9ef` `dicethrone`
    - `6a0982c6a2dfb1b7d690a7f5` `smashup`
    - `6a097d11a2dfb1b7d690a7f0` `smashup`
  - 系统单 1 条
    - `6a08b403c4a9fa2139a64121` `splendor`

## 生产真源复核

- 生产 Mongo 查询确认当前 `open / in_progress` 只有上述 4 条。
- 其中 Splendor 这条系统单快照要点：
  - `content = [system][online-ai-watchdog] force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - `matchId = nzwR7SLeYIb`
  - `phase = ""`
  - `turnNumber = 0`
  - `currentPlayerId = "1"`
  - `legalActions.total = 0`
  - `aiDecisionPreview.chosenAction = null`
- 这说明它不是正常 `main1` 行为链，而是 `turn0 / unknown-phase` 的 Splendor 开局前残态被 watchdog 误判成 active AI 卡死。

## 修复结论

### 1. DiceThrone 真人反馈 `6a09bac1a2dfb1b7d690a9ef`

- 结论：是真实伤害链 bug，不是单纯日志文案问题。
- 根因：
  - `src/games/dicethrone/domain/effects.ts` 的通用伤害入口同时启用了护盾自动收集；
  - reducer 侧又再次消费护盾；
  - `Loaded` 奖励伤害在 `Stand Tall` 防御后被双重抵消，最终掉血被吞成 `0`。
- 修复：
  - 把 `autoCollectShields` 改为 `false`，统一交给 reducer 消耗。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/gunslinger-take-cover-loaded-vs-stand-tall.test.ts src/games/dicethrone/__tests__/shield-double-counting-regression.test.ts --configLoader native --maxWorkers 1`
  - 结果：通过。

### 2. SmashUp 真人反馈 `6a0982c6a2dfb1b7d690a7f5` / `6a097d11a2dfb1b7d690a7f0`

- 结论：两条同根因，都是移动端点击语义被错误改成“双击 armed 后再发动”。
- 根因：
  - `src/games/smashup/ui/BaseZone.tsx`
  - 基地上的 ongoing 天赋卡、以及附着在随从上的天赋行动卡，在 coarse pointer 分支被走成了 `armOrActivate`。
  - 用户看到的现象就是“点不开 / 点了只像看牌，不会发动”。
- 修复：
  - 基地 ongoing 天赋卡：移动端单击直接 `USE_TALENT`
  - attached action 天赋卡：移动端单击直接 `USE_TALENT`
- 单测：
  - `src/games/smashup/__tests__/baseZone-mobile-ongoing-actions.test.tsx`
  - 覆盖：
    - 基地上的天赋战术单击一次发动
    - 附着在随从上的天赋战术展开后单击一次发动
- E2E：
  - 命令：
    - `npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大"`
  - 结果：通过。
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\05-mobile-single-tap-expands-attached-actions.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\06-mobile-second-tap-uses-talent.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\06a-mobile-base-ongoing-talent-single-tap-uses-talent.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\06aa-mobile-attached-action-talent-single-tap-uses-talent.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\06ab-mobile-base-ongoing-single-tap-magnify.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大\06b-mobile-attached-action-single-tap-magnify.png`
- 肉眼观察：
  - `05`：第一次点击随从后，附着行动卡展开，但还未发动，说明原有“随从先展开、再发动”的移动端链路仍在。
  - `06`：第二次点击随从后，随从天赋进入已使用态，未弹出放大预览，说明随从自身的双击发动链路未被新改动打坏。
  - `06a`：点击基地上的天赋 ongoing 后，没有出现 magnify overlay，而状态已进入 `talentUsed=true`，说明单击直接走发动而不是放大。
  - `06aa`：点击 attached action 天赋后，没有出现 magnify overlay，而附着卡状态已进入 `talentUsed=true`，说明单击直接走发动而不是放大。
  - `06ab / 06b`：非天赋的 ongoing / attached action 仍然走单击放大，证明这次修复没有把“普通看牌”语义一起改坏。

### 3. Splendor 系统单 `6a08b403c4a9fa2139a64121`

- 结论：这是 watchdog 的边界误报，不是“Splendor 正常进行中确实有一步没做”。
- 根因：
  - `src/engine/transport/onlineAiRecovery.ts`
  - Splendor 的 `turn0 / unknown-phase` 残态虽然已经处于开局前，但 `currentPlayerId` 已写入；
  - 旧 guard 只拦 `hostStarted === false`；
  - 当 `hostStarted` 缺失或未对齐时，这类残态仍会被当成 `active-turn-legal-only`，继续上报 `legal_action_unavailable`。
- 修复：
  - 对 `gameId === 'splendor'` 且 `hostStarted !== true` 且 `(!phase || turnNumber === 0)` 的残态，直接 `return null`，不进入 watchdog active-turn legal-action recovery。
- 回归：
  - `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts`
    - `Splendor turn0 / unknown-phase 残态不得触发 active-turn legal-action watchdog`
  - `src/engine/transport/__tests__/server.test.ts`
    - `online AI watchdog 在 Splendor turn0 / unknown-phase 残态下不得写 legal_action_unavailable 反馈`
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1`
  - 结果：通过。

## 本轮聚焦验证汇总

- Vitest：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseZone-mobile-ongoing-actions.test.tsx src/games/dicethrone/__tests__/gunslinger-take-cover-loaded-vs-stand-tall.test.ts src/games/dicethrone/__tests__/shield-double-counting-regression.test.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1`
  - 结果：`5 files / 142 tests passed`
- E2E：
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大"`
  - 结果：`1 passed`
- TypeScript：
  - `npm run typecheck`
  - 结果：通过
- 生产依赖：
  - `npm run check:prod-deps`
  - 当前在 Windows + CRLF 环境下，bash 入口会先被 `\r` 影响，脚本本体不能直接作为结果依据。
  - 改用等价手工校验：
    - `.tmp/prod-deps-check` 下执行 `npm ci --omit=dev --ignore-scripts`
    - 从 `server.ts` 提取第三方 import，逐个核对 `.tmp/prod-deps-check/node_modules`
  - 结果：
    - 生产依赖安装成功
    - `server.ts` 第三方 import `missingCount = 0`

## 当前边界

- 本轮完成的是：代码修复 + 本地定向验证 + 证据落地。
- 本轮未做：
  - 生产部署
  - 线上 Mongo 反馈状态回写
- 原因：
  - 当前对话没有获得生产部署授权；
  - 根规范也要求不要未经确认直接改线上状态。
