# DiceThrone 在线 AI 四人流程时间线历史 E2E（2026-04-28）

> 2026-06-06 当前有效口径：本文只保留四人在线 AI 时间线这条历史 E2E 证据，不代表 DiceThrone 全体四人局、在线 AI、任一单英雄，或四位新英雄整批当前已经审计完成。它现在只能证明当时“四人局不会在首次主流程 / targetingRoll 前直接卡死”这一条主链被专项验证和补强过，不能外推成 DiceThrone 当前总体收口。

## 目标
- 将原本双人在线 AI 流程时间线用例改为四人（1 人类 + 3 AI）房间。
- 验证首个 AI 回合在四人局下仍能完成可见动作链，不会因为额外 AI seat 干扰而把主流程卡死在“思考中”。

## 运行命令
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-simple-start.e2e.ts "Online AI 真人房间：主阶段到攻击链时间线应可区分动作延迟与传输重试"`

## 结果
- 通过：`1 passed (35.4s)`
- 2026-04-29 追加回归：在同一四人用例上再次通过 2 次；最新摘要里：
  - `submittedRollCount = 2`
  - `patchApplyFailedCount = 0`
  - `secondaryPatchApplyFailedCount = 0`
  - `idleActiveAiCount = 0`
  - `submitBlockedCount = 0`

## 关键截图与肉眼结论

### 1. 房主主阶段起点
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-simple-start.e2e\Online-AI-真人房间：主阶段到攻击链时间线应可区分动作延迟与传输重试\40-online-ai-real-timeline-host-main1.png`
- 实际看到：顶部同时出现 `AI 2 号位 / AI 3 号位 / AI 4 号位` 三个对手头栏，说明房间已是四人局，不是旧的双人局。
- 实际看到：左侧阶段栏停在 `3. 主要阶段(1)`，右侧可见投骰与下一阶段按钮，房主已进入可推进的真实主阶段。
- 验收判断：达到“四人局起点已建立”的验收标准。

### 2. AI 回合开始
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-simple-start.e2e\Online-AI-真人房间：主阶段到攻击链时间线应可区分动作延迟与传输重试\41-online-ai-real-timeline-ai-turn-start.png`
- 实际看到：中央出现技能卡特写，底部可见手牌，说明首个 AI 已进入真实可见动作链，而不是停留在空转思考。
- 实际看到：顶部仍保持三名 AI 头栏，证明流程发生在四人局上下文中，不是退化回双人环境。
- 验收判断：达到“首个 AI 回合在四人局下能开始出牌/出招流程”的验收标准。

### 3. 攻击链推进后
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-simple-start.e2e\Online-AI-真人房间：主阶段到攻击链时间线应可区分动作延迟与传输重试\42-online-ai-real-timeline-after-attack-chain.png`
- 实际看到：左侧阶段栏已推进到 `4. 那耶攻击阶段`，中央出现 `AI 2 号位 正在思考中...`，右侧骰列已出现多颗已锁定/已确定结果。
- 实际看到：这一步不再是起始主阶段，说明 AI 已完成前面的可见动作提交，流程确实向攻击链推进。
- 验收判断：达到“主流程至少推进到攻击链中段”的验收标准；截图没有显示房间退回双人局，也没有显示流程停在初始 main1。

## 补充产物
- 时间线控制台：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-simple-start.e2e\Online-AI-真人房间：主阶段到攻击链时间线应可区分动作延迟与传输重试\online-ai-real-timeline-console.json`
- 时间线摘要：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-simple-start.e2e\Online-AI-真人房间：主阶段到攻击链时间线应可区分动作延迟与传输重试\online-ai-real-timeline-summary.json`

## 本轮代码改动摘要
- `setupDTOnlineAiRoom()` 支持可配置 `numPlayers` 与 `aiSeatIds`，不再只能创建双人 1 AI 房间。
- 该时间线用例改为创建四人房间，并显式等待 `1/2/3` 三个 AI seat 完成选角与 ready。
- 断言改为：验证四人 `seatingOrder`、三枚顶部头栏，以及只对主流程 AI（seat 1）的 `patch-apply-failed` 做硬门禁；旁路 AI 的自愈重同步只记录，不误判主流程失败。
- 新增 transport 侧序列化保护：`src/engine/transport/server.ts` 会在广播前剥离函数型字段，避免 `localReducer/toCommands` 进入 patch。
- 新增回归测试：`src/engine/transport/__tests__/patch.test.ts` 证明函数型 patch 经过传输后会退化成无 `value` 的 `add`，并验证序列化后可正常 apply。
- 新增 DiceThrone AI 修复：`src/games/dicethrone/ai.ts` 现在会在 **四人 targetingRoll** 生成 `roll-dice / confirm-roll`，不再在该阶段直接 `idle`。
- 新增单测：`src/games/dicethrone/__tests__/basic-commands-coverage.test.ts` 覆盖“本地 AI 在四人 targetingRoll 应能继续掷目标骰并推进，而不是 idle 卡思考”。
- E2E 门禁收紧：四人时间线现在要求主流程 AI 至少出现 **两次可见 `roll-dice`**（进攻掷骰 + targetingRoll 目标骰）或已进入 `defensiveRoll`，避免只跑到第一次攻击动作就误判通过。

## 根因更新（2026-04-29）

### 根因 1：transport patch 夹带函数字段
- `multistep interaction` 的 `localReducer / toCommands` 进入服务端 diff。
- 经过 socket/JSON 传输后函数值丢失，客户端收到无 `value` 的 `add` patch，触发 `patch-apply-failed -> resync`。
- 这条已通过 transport 序列化修复，并由单测兜住。

### 根因 2：DiceThrone 本地 AI 在四人 targetingRoll 没有生成后续动作
- 人类 UI 与规则都允许 `targetingRoll` 执行 `ROLL_DICE -> CONFIRM_ROLL -> ADVANCE_PHASE`。
- 但修复前 `buildDiceThroneAiLegalActions()` 只给 `offensiveRoll / defensiveRoll` 生成这套动作，`targetingRoll` 会直接掉进 `idle-active-ai` 恢复链。
- 这会把用户体感表现成“AI 一直在思考”，尤其在四人局首次攻击进入 targetingRoll 时最明显。
- 修复后，四人时间线最新摘要已出现 `submittedRollCount = 2`，说明主流程 AI 已补跑到第二次目标骰。


## 2026-04-29 追加压测（继续跟进）
- 我又连续重跑同一条四人 E2E **2 次**，两次都通过；结合前面的 2 次，本轮这个四人用例已 **连续通过 4 次**。
- 最新摘要确认：
  - `submittedRollCount = 2`
  - `patchApplyFailedCount = 0`
  - `secondaryPatchApplyFailedCount = 0`
- 当前这条 E2E 的收口点仍是“第二次可见 `roll-dice` 已提交或已进入 `defensiveRoll`”。本次最新通过里最终快照停在 `targetingRoll`，说明它已经证明“四人局不会在 targetingRoll 前直接卡死”，但**还没有把同一次 E2E 的门禁推进到 targetingRoll 的 confirm/advance 全部完成**。
- 因此，目前最稳妥的结论是：**原先高概率卡死的四人 targetingRoll 主问题已经复现并修掉，且回归压力下未再出现 transport patch 失败；如果要把收口再抬高一档，下一步应把 E2E 门禁继续推进到 `defensiveRoll` 或 targetingRoll 的 `confirm-roll / advance-phase` 也完成。**

## 当前阅读说明

- 本文只覆盖四人在线 AI 时间线这一条历史主链，不覆盖更广范围 DiceThrone 在线 AI / targetingRoll / watchdog 总体完成态。
- 文中已经明确保留了“门禁未抬到 confirm/advance 全完成”的历史残余，因此更不能把它当成当前 DiceThrone 或新英雄整批“全面收口”的证明。
