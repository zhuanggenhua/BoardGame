# 线上 open 反馈复核（2026-06-02）

## 范围

- 生产库 `boardgame.feedbacks`
- 仅复核本轮实际抽查并本地实跑的 open 反馈
- 本轮不做生产状态回写；只给出代码归因与当前主线验证结论

## 结论

- 以下 11 条 open 反馈，经当前主线代码 + 定向 Vitest / E2E 复核，均已不再是当前 worktree 的活 bug，更像“当时已修但反馈状态未回写”的遗留：
  - `6a10f99860e79fcbd0ad7281` `smashup` `p4只选了一个派系`
  - `6a104b8a9dcbdc48317ef810` `smashup` `force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - `6a0d029d97171f579fd60e69` `smashup` `force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - `69fa0bafd0456dfb3f04f357` `smashup` `为什么一出来就选择结算顺序，重构没用吗`
  - `69ec47e9c4b1dbdc33cb4703` `smashup` `ai被强制结束回合，好像是因为选择结算顺序`
  - `69eeada6d9cc518203642978` `smashup` `为什么我的回合开始就可以立刻打出一个额外随从`
  - `69ed86efa0adf1cb68601c12` `summonerwars` `神出鬼没的效果无法点击使用啊`
  - `69f40b9e9efe1f53e1e9c700` `dicethrone` `在我的回合ai强制结束失败而我无法点击下一阶段，刷新后出现的`
  - `69f44ba55045b6dda354882d` `dicethrone` `使用了两次装填token，虽然第二次没有效果，但应该只触发一次，是什么重复了`
  - `69ec296b4c94c09036eef0c4` `smashup` `海龟阿凯是什么鬼`
  - `69f7e7a0fc95d87e478aa7d7` `smashup` `为什么到了我的回合还弹出ai强制结束回合`
- 本轮没有修改业务代码；仅把 1 条过时的 DiceThrone E2E 从“单击开预览”改回当前 UI 的真实拖拽出牌动作，用于复核线上反馈现状。

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

### 4. SmashUp `一出来就先弹结算顺序`

- 反馈：
  - `_id = 69fa0bafd0456dfb3f04f357`
  - 内容：`为什么一出来就选择结算顺序，重构没用吗`
- 当前主线验证：
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts Invisible Ninja`
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序"`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/turnCycle.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "蘑菇王国与 Invisible Ninja 同回合开始时应直接进入真实交互，不先弹结算顺序"`
  - 结果：上述 3 条定向验证全部通过
- 现有证据：
  - `evidence/smashup/smashup-mushroom-opponent-sprout-turn-start-e2e-test.md`
  - `evidence/smashup/smashup-reaction-resource-model-e2e-test.md`
- 当前结论：
  - 当前主线下，`蘑菇王国` 与对手 `幼苗` 同回合开始时，已直接进入真实场上选择交互，不会先弹出结算顺序；该反馈未复现。

### 5. SmashUp `AI 被强制结束回合，好像是因为选择结算顺序`

- 反馈：
  - `_id = 69ec47e9c4b1dbdc33cb4703`
  - 内容：`ai被强制结束回合，好像是因为选择结算顺序`
- 当前主线验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "wizards_arcane_protector 已进场后，afterScoring live 反应不应继续暴露其 special|smashup_reaction_choose 从持久化恢复后只剩失效 special 快照时，AI 应按 live session 直接选择 pass|smashup_reaction_choose 构建反应选项时，应去重重复的泰坦 special 候选"`
  - 结果：2 条定向用例全部通过
- 现有证据：
  - `evidence/smashup/smashup-watchdog-69fb3fde-69fc6298-arcane-protector-live-special-closeout-2026-05-07.md`
  - `evidence/smashup/smashup-watchdog-open-20260507-batch-closeout.md`
- 当前结论：
  - 当前主线已覆盖 `afterScoring live reaction`、失效 special 快照恢复、重复 special 去重等关键门禁；这条 `AI 被强制结束回合` 反馈更像既有修复后的遗留 open，不再是当前 worktree 的活 bug。

### 6. SmashUp `神秘花园额外随从时机/基地限制`

- 反馈：
  - `_id = 69eeada6d9cc518203642978`
  - 内容：`为什么我的回合开始就可以立刻打出一个额外随从，看起来是花园效果，但实际上额外随从可以不出在花园，而且额外随从应该给次数，而不是强制某个时机打出`
- 当前主线验证：
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-secret-garden-tenacious-z.e2e.ts "神秘花园回合额度应允许从弃牌堆把顽强丧尸打到花园"`
  - 结果：通过
- 现有证据：
  - `evidence/smashup/smashup-secret-garden-tenacious-z-e2e-test.md`
- 当前结论：
  - 当前主线下，`神秘花园` 提供的是额外随从额度，并且落点仍受 `神秘花园` 限制；`顽强丧尸` 的定向 E2E 未见“强制时机打出”或“可绕开基地限制”现象，该反馈当前不复现。

### 7. DiceThrone `我的回合 AI 强制结束失败后无法点击下一阶段`

- 反馈：
  - `_id = 69f40b9e9efe1f53e1e9c700`
  - 内容：`在我的回合ai强制结束失败而我无法点击下一阶段，刷新后出现的`
- 现有证据：
  - `evidence/dicethrone/dicethrone-online-ai-pending-interaction-hidden-response-fix-2026-05-02.md`
  - `evidence/dicethrone/dicethrone-online-ai-watchdog-human-response-window-fix-2026-05-02.md`
- 当前主线验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "online AI watchdog 在 human 当前响应窗口中不应误判为 AI 卡死|DiceThrone afterRollConfirmed 当前响应者为 human 时，不应回退成 active-turn-legal-only|DiceThrone afterCardPlayed 存在 pendingInteractionId 锁时，应优先检查 hidden interaction 而不是退成 RESPONSE_PASS|online AI watchdog 在 response window 中 responder 不是 activePlayer 时，仍应执行 RESPONSE_PASS|online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口"`
  - 结果：5 条定向用例全部通过
- 当前结论：
  - 当前主线已覆盖 `human responder` 误判、`pendingInteractionId` 锁住 hidden interaction、`RESPONSE_PASS` 恢复链等直接门禁；这条 watchdog 类 open 反馈当前更像已修后的遗留，不再是当前 worktree 的活 bug。

### 8. DiceThrone `装填 token 重复触发`

- 反馈：
  - `_id = 69f44ba55045b6dda354882d`
  - 内容：`使用了两次装填token，虽然第二次没有效果，但应该只触发一次，是什么重复了`
- 当前主线验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/flow.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "4 人模式 targetingRoll 手选目标后的 Loaded reroll 不应再次 reopen 同一 token 选择"`
  - `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-die-reroll.e2e.ts "card-wild-west 应触发弹药特写奖励骰，不改攻击骰盘"`
  - `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-die-reroll.e2e.ts "card-wild-west 无装填时应被出牌门禁阻止（requireLoaded）"`
  - 结果：3 条定向验证全部通过
- 复核备注：
  - 本轮浏览器级红灯最初来自测试动作过时：旧用例把单击手牌当成真实出牌，但当前 UI 下单击只会打开预览，页面快照可见 `关闭预览 ✕`。
  - 将 E2E 调整为与同仓 DiceThrone 其它成功用例一致的“拖拽出牌”后，成功链路与无装填门禁链路都通过；因此本轮红灯不构成“当前业务仍重复触发 Loaded”的证据。
- 当前结论：
  - 目前没有证据表明 `Loaded` 仍会重复 reopen 同一 token 选择或重复触发效果；这条反馈在当前主线下未复现。

### 9. SmashUp `海龟阿凯是什么鬼`

- 反馈：
  - `_id = 69ec296b4c94c09036eef0c4`
  - 内容：`海龟阿凯是什么鬼`
- 现有证据：
  - `evidence/feedback-closeout/smashup-human-open14-closeout-2026-04-22.md`
  - `evidence/smashup/smashup-feedback-69e61a97-world-champs-card-index-fix-2026-04-25.md`
  - `evidence/smashup/smashup-world-champs-akye-the-turtle-e2e-2026-04-26.md`
  - `evidence/smashup/smashup-world-champs-samurai-chan-no-akye-e2e-2026-04-26.md`
- 当前主线验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "世界冠军 cards7 图集索引应与 wangling 图集中的实际卡面一致|世界冠军关键中文卡名应与当前卡图重录口径一致"`
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "海龟阿凯打出后应先选玩家再交牌并抽两张"`
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "武士 陈打出后不应触发海龟阿凯的交牌抽二交互"`
  - 结果：3 条定向验证全部通过
- 当前结论：
  - 这条反馈与历史 `世界冠军 cards7` 卡面索引错位链路高度一致：用户当时很可能看到的是别的世界冠军卡面，却触发了《海龟阿凯》的真实 onPlay。
  - 当前主线下，《海龟阿凯》真实入口链路正常，《武士 陈》也不会再误触发《海龟阿凯》交牌抽二交互；因此这条反馈当前更像既有修复后的遗留 open，不再是当前 worktree 的活 bug。

### 10. SmashUp `到了我的回合还弹出 AI 强制结束回合`

- 反馈：
  - `_id = 69f7e7a0fc95d87e478aa7d7`
  - 内容：`为什么到了我的回合还弹出ai强制结束回合`
- 现有证据：
  - `evidence/smashup/smashup-online-ai-timeout-recovery-e2e-test.md`
- 当前主线验证：
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合"`
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "真正的 active-turn 强制推进仍保留强制结束回合提示"`
  - 结果：2 条定向验证全部通过
- 复核备注：
  - 当前 8 秒兜底 E2E 明确证明：系统先把控制权切回人类玩家，再显示 `AI 强制结束回合 / AI 已强制结束回合。` toast，提示的是“刚刚发生的 AI 回合收口事件”，不是“现在还在继续强制结束你的回合”。
  - 前端门禁测试也明确锁定：只要 recovery 原因是真实 `active-turn` 强制推进，就应该保留这条 warning toast；这属于当前预期提示文案，不是桥接层误报。
- 当前结论：
  - 这条反馈在当前主线下更像提示时序带来的观感疑问，而不是功能错误；当前代码未见“回到我的回合后仍继续错误强制结束”或“把我方回合也一起推进掉”的活 bug 证据。

## 当前边界

- 本轮未做：
  - 生产部署
  - `feedbacks` 集合状态回写
  - 批量关闭 open 反馈
- 原因：
  - 当前对话只完成了“代码真相复核 + 本地实跑验证”
  - 根规范要求未经确认不要直接改线上状态

## 建议

- 若下一步目标是清线上工单，可优先把本文件覆盖的 11 条 open 反馈做状态回写。
- 若下一步目标是继续找“当前仍活着的线上 bug”，应从尚未复核的 open 反馈继续逐条抽查，而不是重复修这 11 条。
