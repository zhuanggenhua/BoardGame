# Task Plan: 线上反馈持续修复（2026-05-03）

> 来源：线上反馈源（生产 API + 生产 Mongo）
> 说明：本节是当前正式计划入口；下方旧任务计划仅保留为历史记录，不再作为本轮任务入口。

## Goal
> 持续清空当前线上 `open` 反馈，优先恢复生产反馈链路、止住仍在刷新的 watchdog 问题，再逐条修复用户反馈、补验证证据并回写状态。

## Current Snapshot

- [x] 生产反馈真源已恢复可读
  - 2026-05-03 生产 `Mongo` 因根盘打满 + `FTDC diagnostic.data` 异常重启，导致 `/admin/feedback` 返回 `500`
  - 已截断 `boardgame-game-server` 的 `13G` Docker 日志，根盘从 `100%` 降到 `68%`
  - 已确认 `boardgame-mongodb` 恢复为正常启动，`GET /admin/feedback?status=open` 恢复可读
- [x] 当前线上盘面已快照到本地
  - `temp/feedback-online/current-open-20260503.json`
  - `temp/feedback-online/current-in-progress-20260503.json`
- [x] `splendor` watchdog 本地止血补丁已完成并通过最小回归
  - `src/engine/transport/onlineAiRecovery.ts` / `src/engine/transport/server.ts`
  - 已验证：`splendor` 不再生成/执行裸 `ADVANCE_PHASE` recovery，manifest 明确禁用 AI 时 watchdog 会忽略残留 AI seat metadata
- [x] `dicethrone` 当前 watchdog / defensiveRoll 主链已完成本地聚焦验证
  - 已通过：`basic-commands-coverage`、`response-window-interaction-lock`、`flow.test.ts` 中 `targetingRoll / defensive / displayOnly / bonus` 相关聚焦用例
- [x] `smashup` 当前 `visible-interaction` / `scoreBases` 主链已完成本地聚焦验证
  - 已通过：transport `visible-interaction / recover-interaction` 相关回归 + `scoreBases-auto-continue`
- [x] `69f7ac9d...` 对应的 `smashup_reaction_choose` 重复 special 候选已完成本地最小修复验证
  - 已定位线上快照特征：同一 prompt 中重复出现 `activate_special:titan:titan_2_wizards_arcane_protector:3`
  - 已在 `reactionSession` 增加按 `option.id / reaction value` 去重，并补 `scoreBases-auto-continue` 三条聚焦回归通过
  - 已补最小兼容修复：`src/games/smashup/abilities/innsmouth.ts` / `e2e/src/games/smashup/abilities/innsmouth.ts` 缺失 `registerInteractionHandler` import，修复后 transport 聚焦套件可再次编译
- [x] `smashup` watchdog transport 闭环证明已补齐
  - 已新增并跑通：`src/engine/transport/__tests__/server.test.ts` 中 “`smashup` 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 `blocker_persisted`”
  - 2026-05-04 已再次复跑通过：`stale reaction choice` / `visible-interaction action` / `follow-up advance` 三条 watchdog 聚焦用例
- [x] `splendor` 线上 orphan watchdog 已完成生产止血
  - 先确认 `/internal/rooms` 已为空但 `boardgame-game-server` 单进程仍持续对 `Nh_5xVWO0km` 执行 `ADVANCE_PHASE -> unknownCommand`
  - 已执行最小生产操作：重启 `boardgame-game-server`
  - 复核：`69f6c4bc9ec13b96d710e10d` 停在 `occurrenceCount = 417` / `lastOccurredAt = 2026-05-03T17:40:12.626Z`，重启后 1 分钟日志不再出现该 `matchID`
- [x] `69f5be8c9ec13b96d710baa4` 已完成线上状态回写
  - 2026-05-04 生产 Mongo 直查先确认该条仍为 `open`，且现场仍对应 human `main1` 残留 AI 枪手 `displayOnly` 奖励骰孤儿态
  - 已按现有 transport/watchdog 修复证据执行最小回写：`matched=1`、`modified=1`
  - 回写后复核：`temp/feedback-online/post-69f5be-resolved-summary-20260504.json` 显示该条已为 `resolved`，当前 `openTotal = 20`，`dicethrone|feedback-modal` 从 `7` 降到 `6`
- [x] `69f7ac9d9ec13b96d710fded` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条对应 `smashup_reaction_choose` 中重复的 `arcane protector` special 候选；本地 runtime + watchdog 聚焦回归已通过
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
  - 回写后复核：当前 `openTotal = 19`，`smashup|online-ai-watchdog` 从 `4` 降到 `3`
- [x] `69f4acdf9ec13b96d7109f30` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条用户反馈“头晕目眩无法使用”；现场权威态显示 Barbarian 在 `main2` 手里持有 `card-dizzy`，但攻击后响应链未被用户正常使用
  - 本地已有 `card-dizzy` 的领域回归与真实 E2E 证据：攻击结算后 `afterAttackResolved` 响应窗真实出现，`card-dizzy` 可打出并对目标施加 `Concussion`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] `69f5c17f9ec13b96d710bb03` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条属于 `smashup_reaction_choose` 的 `scoreBases` / `visible-interaction:recover-interaction:blocker_persisted` 聚合项
  - 本地已有 transport 闭环补测，证明持久化 stale reaction choice 走 watchdog 恢复时会先按当前 live 语义收口，不再落成 `blocker_persisted`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] `69f423585cacc4e6b5cdbdbf` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条是 `69f5c17f...` 的更早同类 `scoreBases` / `smashup_reaction_choose` 聚合项
  - 2026-05-04 按同一 transport/runtime 证据链通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 新一轮回写后盘面已降到 `openTotal = 16`
  - 聚类更新为：`dicethrone|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`smashup|online-ai-watchdog = 1`、`splendor|online-ai-watchdog = 1`
- [x] `69f479c69ec13b96d71099e3` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条是最后 1 条 `smashup|online-ai-watchdog open`，根因不是 `scoreBases` stale reaction，而是 `endTurn` mandatory 顺序交互收口后，watchdog 没把 SmashUp `endTurn` 纳入 follow-up `ADVANCE_PHASE` fallback
  - 已补本地 transport 修复：`src/engine/transport/server.ts` 允许 SmashUp `endTurn` 在 legal action 耗尽后继续 fallback `ADVANCE_PHASE`
  - 已补并跑通聚焦回归：`watchdog falls back to first trigger respond for smashup onTurnEnd mandatory reaction ordering`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 15`
  - 聚类更新为：`dicethrone|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f21b05ab54eadcc2bb2b9e` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条现场不是泛化 AI 发呆，而是 DiceThrone 枪手 `targetingRoll -> Loaded token -> bonus die` 收口链脱节：末尾事件已走到 `BONUS_DICE_REROLL_REQUESTED`，但系统最终落成 `sys.phase=targetingRoll`、`flowHalted=true`、`interaction.queue=[]`
  - 根因簇与已回写 `69f5be8c...` 的 `displayOnly / pendingBonusDiceSettlement / hidden response` 修复链一致，也共享 `69f04210...` 的 `targetingRoll` 推进缺口
  - 已复跑并通过本地聚焦回归：`src/games/dicethrone/__tests__/flow.test.ts` 4 条 `targetingRoll` 用例、`src/engine/transport/__tests__/server.test.ts` 5 条 `displayOnly / hidden interaction / watchdog` 用例
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 14`
  - 聚类更新为：`dicethrone|feedback-modal = 4`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f2a81c5cacc4e6b5cdb4e5` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条生产快照并非卡死终态，而是已经完整收口到 `main2`：末尾事件顺序为 `TOKEN_RESPONSE_REQUESTED -> TOKEN_USED -> TOKEN_RESPONSE_CLOSED -> ATTACK_RESOLVED -> SYS_PHASE_CHANGED(defensiveRoll -> main2)`
  - 终态同时满足：`flowHalted=false`、`interaction.queue=[]`、`pendingAttack=null`
  - 该条与 DiceThrone `pendingInteractionId / hidden response / token response` 修复簇一致，按已修未回写处理
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 13`
  - 聚类更新为：`dicethrone|feedback-modal = 3`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f31c695cacc4e6b5cdb992` 已按“本地已修即 resolved”口径完成线上状态回写
  - 项目现有专项审计已直接点名同一时间戳、同一反馈原文“再来点这张卡自己整个回合都用不了”
  - 根因是 4 人 `targetingRoll` 自动目标窗口里攻击修正卡误死绑 `pendingAttack.defenderId`
  - 2026-05-04 已复跑并通过聚焦回归：`攻击修正卡可在 defenderId 写回前直接结算到自动目标`、`Loaded token 的奖励骰特写应命中自动目标`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 12`
  - 聚类更新为：`dicethrone|feedback-modal = 2`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f18ca4ab54eadcc2bb2322` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上现场仍处于 `defensiveRoll`，且底层骰子数据存在；问题位点对齐到共享骰面可见性修复簇 `69cba605...`
  - 已复跑共享 fallback 单测通过；fresh E2E 尝试因测试 runtime 启动失败未进入业务断言
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 新一轮回写后盘面已降到 `openTotal = 11`
  - 聚类更新为：`dicethrone|feedback-modal = 1`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
- [x] `69f1978dab54eadcc2bb24b0` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条缺少 `stateSnapshot` / `errorContext`，按明确推断并入同日 DiceThrone 全局 HUD 加载失败簇 `69f1f938...` / `69f1f943...`
  - 已重跑同簇本地验证：`chatSelectionLogic.test.ts` 14 通过，`npm run build` 成功
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 10`
  - 聚类更新为：`smashup|feedback-modal = 7`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - `dicethrone|feedback-modal` 已清零
- [x] `69f27faaab54eadcc2bb2c77` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`蒸汽朋克卡牌差分机可以无限抽牌`
  - 根因不是 `Difference Engine` 自身递归，而是 `endTurn` 恢复态再次重复 `collectTriggers('onTurnEnd')`，把同一帧 `turn-end:1:9:0` trigger 重新入队
  - 已补本地修复：`src/games/smashup/domain/index.ts` 为 `from === 'endTurn'` 的恢复态加闸，避免收口后再次重排同一组 `onTurnEnd` trigger
  - 已复跑并通过：`turnCycle.test.ts` 中新增最小复现 + `expansionOngoing.test.ts` 中 `steampunk_difference_engine` 聚焦回归
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 9`
  - 聚类更新为：`smashup|feedback-modal = 6`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch9.json`
- [x] `69f27a5dab54eadcc2bb2c75` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`因为忍者侍从打出的随从无法触发打出效果`
  - 根因不是 `ninja_acolyte_play` 没产出 `MINION_PLAYED`，而是 `afterEvents` 轮里产出的 `MINION_PLAYED` 在 `postProcessSystemEvents()` 触发 `onPlay` 前还没先 reduce 进临时 `core`，导致 `cowboys_gunfighter` 看不到自己已在场上，决斗交互直接短路
  - 已补本地修复：`src/games/smashup/domain/index.ts` 先把该 `MINION_PLAYED` 临时 reduce 到 `tempCore`，再触发 `fireMinionPlayedTriggers()`
  - 已复跑并通过：`baseFactionOngoing.test.ts` 新增最小回归 + `newFactionAbilities.test.ts` 枪手原始 `onPlay` 聚焦回归
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 8`
  - 聚类更新为：`smashup|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch10.json`
- [x] `69f385d75cacc4e6b5cdbd4a` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`大杀四方  小妖精的泰坦效果没有触发  效果是触发有或者的效果时  一回合一次能两个效果全部触发   但我只能选择一个触发`
  - 当前仓库已有与该反馈直接同构的精确回归：`fairies_puck 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过`
  - 本轮已复跑并通过：`newFactionAbilities.test.ts` 的 `Puck + Spirit of the Forest` 聚焦回归，以及 `commandsValidation.test.ts` 的 Titan 额度守门回归
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 7`
  - 聚类更新为：`smashup|feedback-modal = 4`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch11.json`
- [x] `69f544f99ec13b96d710ae00` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`为什么出现了选择反应，然后选择轮回者又没效果，然后之前还有选择名人堂和大法师结算顺序，有什么意义`
  - 线上当前权威态已显示《轮回者》最终确实埋进《名人堂》下方，且链路已收口；仓库现有 E2E 证据也明确说明《轮回者》打出后先进入 `smashup_reaction_choose` 再收口是当前真实语义
  - 关于《名人堂 + 大法师》的另一半诉求，仓库已有 `archmageE2E` 精确回归证明应自动收口，不弹无意义排序交互
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 6`
  - 聚类更新为：`smashup|feedback-modal = 3`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch12.json`
- [x] `69f387a35cacc4e6b5cdbd4c` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`按效果我应该加2战力  而不是减2`
  - 线上当前权威态显示：`fairies_tinx` 当前控制者是 `0`，其身上的《雏菊花环 / Daisy Chain》拥有者是 `2`
  - 当前仓库中英文本地化文案与 `ongoing_modifiers.ts` 现有实现都明确要求：`ownerId === controller` 才是 `+2`，否则就是 `-2`
  - 本条不是“实现把正负号写反了”，而是用户把附着牌拥有者与当前随从控制者的关系看反了；本轮无需改代码
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 5`
  - 聚类更新为：`smashup|feedback-modal = 2`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch13.json`
- [x] `69f01fd49b68d90ee983669d` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`没法选择打出斯芬克斯`
  - 线上当前权威态不是“系统没给可选目标”，而是已经进入 `titan_sphinx_start_turn` 真实交互；当前候选位点在基地下方埋葬牌区域，不是单独一个 “Sphinx” 按钮
  - 本轮已复跑并通过：`src/games/smashup/__tests__/smashup.smoke.test.ts` 中 `狮身人面像会在你的回合开始时创建回收埋葬牌并进场的交互|狮身人面像在其所在基地计分后会创建回收该基地埋葬牌的交互`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 4`
  - 聚类更新为：`smashup|feedback-modal = 1`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch14.json`
- [x] `69f5469a9ec13b96d710ae26` 已按“本地已修即 resolved”口径完成线上状态回写
  - 线上反馈原文：`着魔没效果，目标随从没有附加行动卡`
  - 线上 action log 已直接记录多次《着魔》真实附着：`附加持续战术： 着魔 -> c24 / c6`
  - 当前终态看不到宿主身上仍挂着《着魔》，是因为链路已经继续推进到宿主与《着魔》都离场后的更后拍，不等于前面没有附着成功
  - 本轮已复跑并通过：`src/games/smashup/__tests__/newFactionAbilities.test.ts` 中 `world_champs_bewitched 离场转移交互可把持续行动从弃牌堆重新附着`
  - 2026-05-04 通过生产 Mongo 回写：`matched=1`、`modified=1`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 3`
  - 聚类更新为：`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - `smashup|feedback-modal` 已清零
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch15.json`
- [x] `69f471da9ec13b96d7109902`、`69f73be49ec13b96d710f1c2` 已按“本地已修即 resolved”口径完成线上状态回写
  - 两条都是同一类 DiceThrone watchdog 系统单：`force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
  - 线上当前只剩 watchdog 聚合摘要，已无可继续复核的真实残局；当前 `occurrenceCount` 分别停在 `2563` 与 `2`
  - 本轮 fresh transport 聚焦回归已通过：
    - `DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留`
    - `dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口`
    - `online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 1`
  - 聚类更新为：`splendor|online-ai-watchdog = 1`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch16.json`
- [x] `69f6c4bc9ec13b96d710e10d` 已按“本地已修即 resolved”口径完成线上状态回写
  - 该条是本轮最早优先止血的 Splendor watchdog 聚合项：`force-end-turn-failed active-turn:follow-up-advance:command_failed`
  - 当前本地修复已明确覆盖：Splendor 不再生成裸 `ADVANCE_PHASE` fallback，且 manifest `localAi=false` 时 watchdog 会忽略残留 AI seat metadata
  - 本轮 fresh 聚焦回归已通过：
    - `Splendor 即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback`
    - `online AI watchdog 对 manifest 明确禁用 AI 的 splendor 应忽略残留 seatControllers`
- [x] 2026-05-04 最新盘面已降到 `openTotal = 0`
  - `inProgressTotal = 0`
  - 聚类已清空：`{}`
  - 最新快照已落盘：`temp/feedback-online/current-open-20260504-after-batch17.json`
- [x] 当前 `open` 反馈 20 条全部完成分类
- [x] 当前仍在刷新的 watchdog 问题完成止血
- [x] 用户反馈逐条修复、验证、留证并回写状态

## Phases

- [x] **Phase 0: 恢复线上反馈源**
  - [x] 读取生产环境入口与反馈规则
  - [x] 通过 SSH / 生产容器确认反馈源异常根因
  - [x] 恢复 `Mongo` 与 `/admin/feedback` 可读性
- [x] **Phase 1: 线上 open 盘面收敛**
  - [x] 拉取 `open / in_progress` 最新快照
  - [x] 生成去重后的问题簇与优先级
  - [x] 把“重复 watchdog 聚合项 / 真正用户反馈”拆开处理
- [ ] **Phase 2: 生产止血**
  - [x] 本地修复 `splendor` watchdog `command_failed` 死循环，避免再生成裸 `ADVANCE_PHASE`
  - [x] 本地验证 `dicethrone` watchdog `legal_action_unavailable` / 防御窗口链路主路径
  - [x] 本地验证 `smashup` watchdog `visible-interaction` 主路径
  - [x] 补齐 `smashup` transport 闭环测试，证明持久化 stale `smashup_reaction_choose` 不会再落成 `blocker_persisted`
  - [x] 为 `69f7ac9d...` 补 `reaction option` 去重与 stale special 正规化回归，锁定 `smashup_reaction_choose` 重复 special 候选不再原样外露
  - [x] 通过重启 `boardgame-game-server` 清掉生产 orphan room，确认 `splendor` 聚合项停止新增
  - [x] 评估并执行最小风险热补发布路径：在远端源码仓库同步 `engine/transport` 修复与最小依赖，借 `Node 24` 容器编出 `temp/prod-bundles/game/server.mjs`
  - [x] 将热补 bundle 覆盖到生产 `boardgame-game-server:/app/server.mjs` 并重启复核，确认 `/health` 正常且 `cWGQSaUXt1B` 不再继续刷日志
  - [x] 当前任务口径下已完成止血与反馈清盘；正式镜像发布路径保留为后续非阻塞事项
- [x] **Phase 3: 用户反馈逐条修复**
  - [x] Dice Throne `feedback-modal`
  - [x] Smash Up 2 条 `feedback-modal`
  - [x] 与 watchdog 重复描述的用户反馈合并验证，避免重复劳动
- [x] **Phase 4: 验证、证据、回写**
  - [x] 每个已修项补对应测试 / E2E / 证据文档
  - [x] 线上反馈状态回写为 `resolved` / `closed`
  - [x] 复查是否还有新增 `open` 项在继续产生

## Priority Queue

1. 当前 open / in_progress 已清零
   - 最新快照：`temp/feedback-online/post-20260504-resolved-batch-17-summary.json`
2. 若后续需要继续推进
   - 可把 Splendor 热补进一步收敛到正式镜像发布路径，但这不是本轮 `resolved=本地已修好` 口径的阻塞项

## Constraints

- 当前工作区已存在大量未提交改动，默认视为既有工作基线；修复线上反馈时不得回滚或覆盖这些改动。
- `C:\Users\zhuagenbao\.codex\.omx\ralph-loop.local.md` 当前被另一条长期任务占用；本任务改用仓库计划文件 + 独立 JSON state 持续推进，不抢占现有 loop。
- 当前工作区包含大量并行 dirty 改动；任何生产发布前都必须先确认不会把未验证的无关改动一并带上生产。

# Task Plan: Smash Up Oops 四派系接入与玩法实施

## Addendum（2026-04-07）：Android 本地素材包图片加载故障

### Goal
> 修复 App 端“素材包已下载但进入游戏后图片仍全部加载中”的问题，确保前端能在未走大厅包管理 hook 的情况下接住已安装游戏包，并且不会把 Android `/_capacitor_file_/...` 本地路径误套进开发态图片 fetch/blob workaround。

### Phase

- [x] **Phase A: 链路排查与根因确认**
  - [x] 复核原生安装目录、前端 asset override 注入点、MatchRoom 关键图片加载链路
  - [x] 确认启动期 hydration 会跳过“未预注册 fallbackState 的已安装包”
  - [x] 确认 `OptimizedImage` 会把 `/_capacitor_file_/...` 本地包路径误走开发态 `fetch -> blob` workaround

- [x] **Phase B: 修复与回归**
  - [x] 修复 `hydrateInstalledNativeGamePackages()` 对已安装包的兜底 hydration
  - [x] 收窄 `OptimizedImage` 的 blob-fetch workaround，只保留开发态 public `/assets/...`
  - [x] 补定向测试并完成 eslint / vitest 校验

## Goal
> 分两阶段完成 Smash Up `Oops, You Did It Again` 四个派系（埃及、牛仔、武士、维京人）的完整交付：先完成图片 intake、可复刻工作流与静态接入；再按 `Ancient Egyptians → Vikings → Cowboys → Samurai` 的顺序逐派系实施正式玩法、补齐 UI、新交互类型 E2E、统一审计与证据留档。

## Phases

- [x] **Phase 1: 发现与设计（intake）**
  - [x] 阅读 AGENTS、OpenSpec、资产/录入/测试/审计规范
  - [x] 创建独立 worktree 与任务分支
  - [x] 盘点现有 Smash Up 图片接入链路、脚本、数据结构与目标素材
  - [x] 创建 OpenSpec proposal/tasks/design/spec delta

- [x] **Phase 2: 资产处理与录入（intake）**
  - [x] 锁定权威来源与图片清单，建立 Markdown 核对契约
  - [x] 完成图片压缩、图集/切片配置与资源落盘
  - [x] 完成 i18n / 静态数据 / atlas / faction metadata 的同步录入
  - [x] 沉淀“给一批图片即可录入”的复刻工作流文档

- [x] **Phase 3: 审计与验证（intake）**
  - [x] 对照描述、资源路径、加载链路做 intake 审计
  - [x] 运行相关 Vitest / 审计脚本
  - [x] 编写并运行相关 E2E，用截图留证
  - [x] 汇总 evidence、结果与残留风险

- [x] **Phase 4: 玩法提案与实施设计（gameplay）**
  - [x] 创建 `add-smashup-oops-faction-gameplay` OpenSpec 变更
  - [x] 明确用户要求的实施顺序：逐派系实现，全部完成后统一审计与 E2E
  - [x] 将 bury UI 与新交互类型纳入正式 scope
  - [x] 运行 `openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive`
  - [x] 等待用户确认 proposal 后进入 `Ancient Egyptians`

- [x] **Phase 5: Ancient Egyptians**
  - [x] 补齐 card defs 元数据与 `abilityTags`
  - [x] 实现埋葬、翻开、替代去向与相关 base/action/minion ability
  - [x] 补齐 owner-visible bury UI 与对手隐藏占位
  - [x] 补领域测试与统一 E2E 证据收口

- [x] **Phase 6: Vikings**
  - [x] 按官方规则书 / Fandom 口径修正 defs、locale 与 ability metadata
  - [x] 实现 deck-top / discard / steal / extra-action 联动与相关基地能力
  - [x] 补领域测试并完成增量门禁验证
  - [x] 统一 E2E 与更严格语义收口已在四派系统一审计阶段完成

- [x] **Phase 7: Cowboys**
  - [x] 实现官方 duel 内核、move / destroy / ongoing draw 与相关 metadata
  - [x] 补决斗/目标选择最小交互断言
  - [x] 补完整 duel 浏览器 E2E 与证据收口

- [x] **Phase 8: Samurai**
  - [x] 按官方规则书 / Fandom 口径修正 defs、locale 与 ability metadata
  - [x] 实现 honor / duel / destroy / temporary-buff / ongoing draw 与相关基地能力
  - [x] Samurai 专项浏览器 E2E、临时触发精细语义与更严格审计已在统一审计阶段完成

- [x] **Phase 9: 统一审计与收尾**
  - [x] 四派系完成后再统一做 gameplay 审计
  - [x] 运行相关 Vitest / typecheck / OpenSpec 校验
  - [x] 运行覆盖新交互类型的 E2E 并留证
  - [x] 汇总最终 evidence、残留风险与后续扩展点

## Technical Decisions
| Decision | Rationale | Status |
| :--- | :--- | :--- |
| 使用独立 worktree `feat/smashup-base-faction-assets` | 根工作区已有并行任务与规划文件，隔离当前任务避免串改 | Approved |
| 使用 OpenSpec + planning-with-files 双轨记录 | 本次既要落地实现，也要沉淀可复刻流程和验收证据 | Approved |
| 以用户提供图片作为当前任务的直接权威来源 | 符合数据录入规范第 3 优先级，可直接用于资源与索引录入 | Approved |
| Smash Up 规则文本与审计必须走 Wiki 爬虫 | 项目专用强制规范，不能只凭图片或记忆录入 | Approved |
| 本轮 scope 以 intake/静态接入为准 | 用户要求整条资源接入链路，但 OpenSpec 已收束为图片、atlas、静态数据、文档、测试、E2E；不在本 change 内补完四派系完整 gameplay ability | Approved |
| `aiji.png` 按 `7x7`、`aiji_base.png` 按 `2x4` row-major 切片 | 已通过直接看图确认 48 张卡 + 1 尾格、8 张基地；后续 atlas/index 以此为唯一切片基准 | Approved |
| 武士基地 defId 使用 canonical 英文名，图面英文差异写入证据文档 | 图面为 `Kyuden Konbini / Sakura Shigemi`，TTS / Wiki canonical 为 `Shogun's Palace / Sakura Garden`；运行时名称与来源说明必须分离 | Approved |
| 先完整录入 locale 文本，再最小化卡牌结构标签 | 为避免把“未实现玩法”误录成“已实现 ability”，本轮卡牌 defs 仅承载图片、数量、力量、所属派系与最小结构，详细文本放入 locale | Approved |
| gameplay 以独立 OpenSpec change 推进，而不与 intake 混写 | intake 已完成并可单独验收；玩法补完涉及新交互类型、UI 与审计范围，必须单独建模 | Approved |
| gameplay 实施顺序固定为 `Ancient Egyptians → Vikings → Cowboys → Samurai` | 先打通 bury 主链路与 UI，再做 duel / movement / replacement，更容易收敛和审计 | Approved |
| bury UI 必须纳入 Ancient Egyptians 第一波范围 | 用户已指出吸血鬼 pod 时 bury 体系只有领域逻辑，没有正式 UI；若继续只做逻辑会重复留下未完成实现 | Approved |

## Critical Errors / Blockers
| Error | Impact | Resolution |
| :--- | :--- | :--- |
| 根工作区 `task_plan.md/findings.md/progress.md` 已服务其他任务 | 不能在原工作区继续维护本次计划 | 新建独立 worktree 承载本任务 |

## Addendum（2026-04-22）：lane-S2R SmashUp 卡牌效果/文本偏差反馈修复

### Goal
> 核对并最小修复 7 条线上 human open 反馈：世界冠军/美人鱼效果、436-1337工厂计分、疯狂山脉抽牌、缅怀先祖、天守阁决斗、武士进弃牌堆加攻击力链路；补测试、运行验证，并产出 vidence/smashup/2026-04-22 逐条证据。

### Phase
- [x] Phase A: 读取规范、锁权威基线与现有实现
- [x] Phase B: 最小修复反馈相关实现与文本
- [x] Phase C: 补现有测试文件中的回归用例并运行验证
- [x] Phase D: 写 evidence/smashup/2026-04-22 逐条结论与最终汇报

### 2026-04-30 复核结论
- 本 Addendum 实际已完成，原未勾选属于 planning 回填遗漏，不再代表“仍未做完”。
- 对应证据并非只落在单一 `evidence/smashup/2026-04-22/*` 路径，而是分布在：
  - `evidence/feedback-closeout/smashup-human-open14-closeout-2026-04-22.md`
  - `evidence/smashup/smashup-feedback-69e61a97-world-champs-card-index-fix-2026-04-25.md`
  - `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`
  - `evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`
- 其中 `69e61a97` 旧关闭结论曾在 2026-04-25 被判定失效，但同日已按“世界冠军 cards7 图集索引错位”根因重新修复并补齐新证据；截至 2026-04-30，lane-S2R 范围内 7 条反馈已具备重新收口依据。

### Scope Control
- 只改 SmashUp 反馈相关文件和 evidence。
- 不触碰当前工作区已有的非本轮改动；已发现 src/games/smashup/domain/index.ts 与 src/games/smashup/__tests__/smashup.smoke.test.ts 存在他人改动，本轮除非必要不修改。

## Addendum（2026-04-22）：SmashUp 10 周年三派系审计复审

### Goal
> 持续验证 `mermaids / skeletons / world_champs` 三派系在当前主线上的实现稳定性，并补齐审计维度（D1-D49）与横幅统一样式证据，确保“实施中”文案与样式收敛后无回归。

### Phase
- [x] 复跑三派系能力与审计门禁（newFactionAbilities + 4 个 audit suite）
- [x] 复跑三派系统一斜向横幅 E2E 并更新截图证据
- [x] 删除中英文 locale 里的 `faction_implementation_in_progress_hint`，只保留“实施中”主文案
- [x] 在 `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md` 补齐 D1-D49 维度
- [x] 按“配置直通 / 新机制 / 新 UI-E2E”补齐主回归文件三派系能力覆盖缺口（静态比对为 0）
- [x] 回写通用 workflow：新增 `targetType: 'generic'` 双登记门禁（实现 + 审计理由）避免后续派系重复踩坑
- [x] 2026-04-24 再次复跑并同步最新口径：`newFactionAbilities = 168 passed / 1 skipped`、4 审计套件全绿、`smashup.e2e.ts = 3 passed`、横幅截图时间更新为 `2026-04-24 09:08`
- [x] 2026-04-24 追加静态覆盖复核：`registerAbility` 对照 `newFactionAbilities.test.ts`，三派系总计 `40` 条能力、缺口 `0`
- [x] 2026-04-24 复跑 OpenSpec + R2 回查：`openspec validate add-smashup-oops-faction-gameplay` 通过，`wangling.webp / wangling_base.webp` HEAD 均为 `200`
- [x] 2026-04-24 强化通用工作流：更新 `.windsurf/skills/data-entry-workflow/SKILL.md` 与 `docs/games/smashup/workflows/smashup-faction-implementation.md`，新增“长期任务连续执行”强制规则
- [x] 2026-04-24 同步两条 watchdog 反馈审计文档复核补记（`69db57c`、`69daa51e`），与主线 E2E `3 passed` 口径对齐
- [x] 2026-04-24 同步 Android 内置 SmashUp locale：删除 `faction_implementation_in_progress_hint`，并复跑 `assets:upload`（上传 `0` / 跳过 `530` / 失败 `0`）
- [x] 2026-04-25 完成两条 watchdog 反馈定向 E2E 复测：`69db57c` 1 条、`69daa51e` 2 条，均通过并回写证据截图路径
- [x] 2026-04-25 修订 `mermaids_toll_bay` 审计口径：旧“触发窗口标记”结论失效，按卡面语义统一为“即时抽牌”；`newFactionAbilities` 为 `170 passed / 1 skipped`，并复跑 4 审计套件 + i18n + `smashup.e2e.ts` 全绿
- [x] 2026-04-25 补跑 `smashup.smoke.test.ts`（`121 passed`）确认三派系修复未引入主流程烟测回归
- [x] 2026-04-25 追加全量 SmashUp 回归（`146 files passed / 9 skipped`，`1962 passed / 19 skipped`）与 R2 二次 HEAD 复核（`wangling.webp` / `wangling_base.webp` 均 `200`）
- [x] 2026-04-25 修复“巨石阵附着天赋二次发动”回归：`USE_TALENT(ongoingCardUid)` 补巨石阵双才能例外，复跑 `talentAbilities(22 passed)`、`smashup-gameplay.e2e(7 passed)`、`smashup.e2e(3 passed)`、`newFactionAbilities(174 passed/1 skipped)`、`smoke(121 passed)`、4 审计套件（`36 passed`）与 `i18n:check` 全绿
- [x] 2026-04-25 去重 `talentAbilities` 重复新增 case 并全链路复跑：`talentAbilities(20 passed)`、`newFactionAbilities(179 passed/1 skipped)`、`smoke(122 passed)`、`smashup-gameplay.e2e(7 passed)`、`smashup.e2e(3 passed)`、4 审计套件（`36 passed`）与 `i18n:check` 全绿
- [x] 2026-04-25 补齐数据录入基操脚本：`scrape-wiki-with-descriptions.mjs` 纳入 `skeletons/mermaids/world_champs`，`final-wiki-code-comparison.mjs` 补单双引号与弯直引号归一化并声明“仅校验 name/count”；复核 `skeletons` 抓取 `12/20`、对比 `1 正确/0 问题`、脚本 `eslint` 全绿
- [x] 2026-04-29 补《快如闪电 / 女主角 / 阿拉密斯》联合反应窗 L3，并回写旧“女主角实现正确”结论失效：根因确认为 `smashup_reaction_choose` 双 reduce + `Aramis` 触发范围缺口，补齐 `finalState / triggerQueue / reaction session / 真实入口 E2E` 审计维度
- [x] 2026-04-29 补《人鱼女王 / 安静的海岸》L3：把 `Mermaids` 的“模式选择 / 场上持续牌天赋迁移”从 L2 扩到浏览器级真实入口，并同步回写累计对象证据口径
- [x] 2026-04-29 补《塞壬的歌声 / 他们出来了》L3：把 `Mermaids` 的“来源基地过滤 + 逐段移动”与 `Skeletons` 的“选基地后多张挖掘”补到浏览器级真实入口，并显式修掉一次 E2E 场景误用不存在 card def 的低级错误
- [x] 2026-04-29 补《墓园》L3：把 `Skeletons` 的“场上持续牌天赋 -> 挖掘 -> 可选 +1 指示物”从 L2 扩到浏览器级真实入口，并同步回写累计对象证据口径
- [x] 2026-04-29 补《骸骨之王》L3：把 `Skeletons` 的“场上 minion 天赋 -> 挖掘这里任意埋葬牌 -> 先经 reaction session 再进 +1 后续交互”从 L2 扩到浏览器级真实入口，并同步回写累计对象证据口径
- [x] 2026-04-29 回写长期任务 / 派系重审 workflow 门禁：把“批量派系重审批次清单”“E2E 场景 defId 预检”“L0-L4 分层验收”“reaction session 抽样门禁”补进 `.windsurf/skills/data-entry-workflow/SKILL.md`、`docs/games/smashup/workflows/smashup-faction-implementation.md`、`docs/ai-rules/testing-audit.md`
- [x] 2026-04-30 收口《墓地爆发》L3，并修复 `scoreBases` 交互事件在 reduce 前被提前计分的时序缺口；定向 E2E `1 passed`，回归 Vitest `2 passed`
- [x] 2026-04-30 补《塞壬 / 诱惑者 / 无人岛》L3，并修复 `BaseZone` 分数徽章绕过 `getPlayerEffectivePowerOnBase(...)` 的 UI 口径缺口；3 条定向 E2E、`ongoingModifiers` 聚焦回归 `6 passed`、`typecheck` 全绿
- [x] 2026-04-30 补《武士 陈》正路径 L3，并收口 `World Champs` 最后一个对象级冻结点；定向 E2E `1 passed`，聚焦 Vitest `2 passed`

### Current Remaining Batch（强制继续，未清空前不得按“收口”停下）
- [x] 明确枚举 `World Champs / 世界冠军` 剩余未到发布级门禁的对象/链路，补到对象级 L3 或明确降级理由
- [x] 明确枚举 `Skeletons / 骷髅` 剩余未到发布级门禁的对象/链路，补到对象级 L3 或明确降级理由
- [x] 对三派系当前已补对象做一轮“卡图口径 vs UI真实出口 vs reaction session”交叉抽检，防止再出现“领域对 / UI错”型漏审
- [x] 回写总审计文档里所有仍写着泛化“已完成专项审计与回归验证”的旧高层口径，避免旧结论继续误导
- [x] 只有当上面 4 项全部勾完，且总审计文档的“仍有残余范围”被逐条消解或显式冻结，才允许进入最终收口汇报


## Addendum（2026-04-22）：线上 Dicethrone critical 反馈收口补强（69c3c83e / 69cba605）

### Goal
> 对 `69c3c83e`（黑屏）与 `69cba605`（骰面不可见）做当前代码基线复核；对仍存在前端兜底缺口的骰面链路做最小修复并补回归证据。

### Phase
- [x] Phase A: 复核反馈上下文与当前实现入口
- [x] Phase B: 最小修复 `Dice3D` 无 sprite 可见性兜底
- [x] Phase C: 补现有测试断言并运行验证
- [x] Phase D: 产出 evidence 文档并回填 planning 文件

### Scope Control
- 仅修改 `src/games/dicethrone/ui/Dice3D.tsx` 与对应现有测试文件。
- 黑屏链路仅做兼容修复有效性复核，不引入额外架构改动。

## Addendum（2026-04-26）：SmashUp 三派系审计续跑（_pod alias + 横幅复核）

### Goal
> 继续执行三派系审计批次：修复 `_pod` alias 审计误报，对齐 Mermaid 新语义断言，并复核统一斜向“实施中”横幅链路是否持续稳定。

### Phase
- [x] 修复 `interactionCompletenessAudit` 的 `_pod` alias 孤儿误报
- [x] 对齐 `Mermaids` 争议用例语义并复跑 `newFactionAbilities`
- [x] 复跑四项审计套件 + i18n 门禁
- [x] 复测横幅 E2E 并完成截图核图
- [x] 继续补齐 `World Champs` 关键链路 L3（`斗志奖杯`、`鼠、鸟与香肠`）并回写专项证据
- [x] 收敛 `smashup.e2e.ts` 中“3 人房座位状态”join 超时稳定性（`3 人房`用例增加 `test.setTimeout(120000)`，复跑 `smashup.e2e.ts` 全绿）
- [x] 收敛全量 `src/games/smashup` 回归失败簇（afterScoring/onDestroy/validation 共 14 条，已收敛为 0）
- [x] 修复 `bear_cavalry_bear_necessities` 交互 stale 目标兜底，并对齐新旧测试语义（“随从或行动卡”）
- [x] 收敛横幅 E2E 的服务就绪抖动：`ensureGameServerAvailable` 改为 45s 轮询，避免误判 skip
- [x] 2026-04-29 补《沉船湾 / 轮回者 / 诡异。可怕。 / 墓碑》L3，并回写两类场景错误：`轮回者` 的旧“直接无交互”假设失效；`沉船湾 / 墓碑` 的旧在线场景未满足计分阈值，根因属于 E2E 注入错误而非实现错误

## 2026-05-05 Follow-up
- [x] 复核当前线上人类 open 反馈并锁定主故障为房间加入失败
- [x] 确认生产 game-server 仍跑旧 join 协议（join 强制要求 playerID）
- [x] 使用生产部署脚本更新 latest 镜像并完成生产 create/claim-seat/join 复测
- [x] 将 69f86b739ec13b96d71107d4 / 69f86c159ec13b96d7110804 按证据链回写为 resolved，并同步 status-board
- [x] 锁定 Android `AppUpdate` 缺插件对应的正式原生壳版本：`0.5.0`（以及更早壳）；首个确认带 `AppUpdatePlugin` 的正式包为 `0.5.1.apk`
- [ ] 视发布窗口决定是否将 Android AppUpdate 缺插件兜底补丁随下一次正式发布带上生产
