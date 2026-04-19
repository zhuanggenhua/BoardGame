# Smash Up 在线 AI factionSelect watchdog 误推进回归验证（2026-04-15）

## 对应反馈
- 反馈 ID：`69dd9e973d186c75bf372466`
- 现象：玩家选完第一个派系后，专家级 AI 不继续选派系，约 8 秒后直接进入空牌空派系的 `playCards`。

## 根因结论
- 这类坏局面的关键风险点不是 AI 选派系策略本身，而是 **AI seat 建连 / seat state 延迟时，watchdog 把 `factionSelect` 误当成可强制结束的普通 AI 回合**。
- 一旦在 `factionSelect` 阶段直接提交 `ADVANCE_PHASE`，就会绕过派系初始化，导致双方 `factions/hand/deck` 仍为空却进入对局阶段。
- 当前代码口径已经改为：**`factionSelect` 不允许走 `active-turn` 强制推进**；本轮补了单测和真实联机 E2E，证明该反馈场景不会再被误推进成空牌局。

## 本轮新增验证
### 1. 单测
- 命令：`npx vitest run src/pages/__tests__/matchSeatValidation.test.ts`
- 结果：58 passed
- 新增断言：`factionSelect` 阶段即使当前玩家是 AI，`resolveForceEndTurnForStalledAi()` 也不应返回 `active-turn` 强制推进方案。

### 2. 真实联机 E2E
- 命令：`npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI seat 建连延迟超过 8 秒时，factionSelect 不应被 watchdog 误推进到空牌 playCards"`
- 用例做法：
  1. 创建 Smash Up 在线 AI 房；
  2. 人类先选第一个派系；
  3. 人为延迟 AI seat 的 claim-seat / 建连；
  4. 验证超过 watchdog 窗口后仍停留在 `factionSelect`，不会跳到空牌 `playCards`；
  5. AI seat 补上后继续完成双选；
  6. 人类完成第二选，最终正常进入带手牌/牌库的对局。

## 关键截图与肉眼结论

### A. 超过 watchdog 窗口后仍停留在派系选择
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-seat-建连延迟超过-8-秒时，factionSelect-不应被-watchdog-误推进到空牌-playCards\在线-AI-seat-建连延迟超过-8-秒时，factionSelect-不应被-watchdog-误推进到空牌-playCards-online-ai-faction-select-still-waiting-after-watchdog.png`
- 我实际看到：页面仍是“选择你的派系”界面，不是棋盘出牌界面；右下角也没有进入结束回合/正常出牌链路。
- 我实际看到：中间仍是选秀状态卡片，而不是双方空手牌进入棋盘的坏局面。
- 验收判断：**达到本轮验收标准**，证明 watchdog 没有把 `factionSelect` 误推进成空牌 `playCards`。

### B. AI 补建连后完成双选，选秀权回到房主
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-seat-建连延迟超过-8-秒时，factionSelect-不应被-watchdog-误推进到空牌-playCards\在线-AI-seat-建连延迟超过-8-秒时，factionSelect-不应被-watchdog-误推进到空牌-playCards-online-ai-faction-select-ai-picked-twice.png`
- 我实际看到：画面仍处在派系选择页，说明补建连后是继续选秀，而不是被错误跳相位。
- 我实际看到：选秀流程没有黑屏、没有空棋盘提前出现。
- 验收判断：**达到本轮验收标准**，说明 AI seat 延迟恢复后，流程仍沿正确的派系选择链路继续。

### C. 最终正常进入 playCards，双方不再是空牌空派系
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-seat-建连延迟超过-8-秒时，factionSelect-不应被-watchdog-误推进到空牌-playCards\在线-AI-seat-建连延迟超过-8-秒时，factionSelect-不应被-watchdog-误推进到空牌-playCards-online-ai-faction-select-final-playcards.png`
- 我实际看到：已经进入正常棋盘视图，顶部显示“你自己 / 出牌阶段”，不再停留在坏掉的 setup 态。
- 我实际看到：底部存在 5 张可见手牌，左下角牌堆角标为 35，说明房主派系/牌组初始化正常，不是“空手牌+空牌库”。
- 我实际看到：棋盘上有 3 个正常基地位，页面没有出现双方空牌却持续轮转的异常画面。
- 验收判断：**达到本轮验收标准**，证明该反馈描述的“直接进入空牌局”已被阻断，且后续能正常进入对局。

## 结论
- 反馈 `69dd9e973d186c75bf372466` 可收口为 **resolved**。
- 当前证据链证明：即使 AI seat 建连晚于 watchdog 窗口，Smash Up 也不会再从 `factionSelect` 被误推进到空牌 `playCards`；AI 建连恢复后可继续完成选秀，最终正常开局。

---

## 2026-04-17 复验补记（本轮 Ralph 收口）

### 本轮额外改动目的
- 把 watchdog 口径从“`factionSelect` 直接返回 `null`”升级为“**只允许 legal-action recovery，绝不允许 fallback `ADVANCE_PHASE`**”。
- 同步修正 `MatchRoom` 里的 AI attemptKey 确认释放时机，以及 `OptimisticEngine` 在 `stateID/playerId` 命中但 `core` 不一致时的权威回滚语义，避免本地继续带着错误预测前冲。

### 本轮静态/单测验证
- `npx vitest run src/pages/__tests__/matchSeatValidation.test.ts src/engine/transport/__tests__/server.test.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/engine/transport/latency/__tests__/optimisticEngine.test.ts`
- 结果：`4 files, 136 passed`
- `npm run typecheck`：通过
- `npm run build`：通过

### 本轮 E2E 复验
- 先修复了测试脚本自身问题：`e2e/smashup/smashup-phase-transition-simple.e2e.ts` 缺失 `selectFaction` import，首次运行会直接 `ReferenceError`，不能作为业务失败证据。
- 修复后执行：
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "回归：在线 AI 在 factionSelect 阶段 seat state 延迟就绪时，不得被 watchdog 跳过到空牌对局"`
  - 结果：`1 passed`

### 本轮关键截图与肉眼结论

#### D. watchdog 窗口过去后仍停留在派系选择
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局-online-ai-faction-select-still-waiting-after-watchdog.png`
- 我实际看到：标题仍是“选择你的派系”，画面主体还是派系列表，不是棋盘主态。
- 我实际看到：底部玩家卡片仍显示 `P0` 已选 1 个、`P1` 还未完成，不存在“空牌空派系却进入 playCards”的坏局面。
- 验收判断：**达到验收标准**，说明本轮改动后 watchdog 仍没有把 `factionSelect` 误推进掉。

#### E. AI 补建连后选秀继续推进
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局-online-ai-faction-select-ai-picked-twice.png`
- 我实际看到：画面仍停留在选派系界面，没有黑屏或错误提前切棋盘。
- 我实际看到：选秀流程继续向前，而不是被错误跳相位后再回不来。
- 验收判断：**达到验收标准**，说明“只允许 legal-action recovery”的链路能继续把派系选择走完。

#### F. 最终正常进入出牌阶段
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局-online-ai-faction-select-final-playcards.png`
- 我实际看到：顶部明确显示“回合 1 / 你自己 / 出牌阶段”，说明已经走入正常对局而不是停留在 setup 残态。
- 我实际看到：底部我方手牌是 5 张，左下牌堆角标是 `35`，双方初始化已经完成，不是空手牌/空牌库。
- 我实际看到：棋盘上 3 个基地正常显示，右下角也回到正常对局 HUD，不存在“空棋盘假开局”。
- 验收判断：**达到验收标准**，证明本轮 transport/bridge/optimistic 修正后，这条真实反馈链路仍然完整闭环。

## 2026-04-17 回归复跑（新增）

### 本次复跑结果
- Playwright 最近一次运行结果：`test-results/playwright-artifacts/.last-run.json` 显示 `status: "passed"`
- 复跑用例目录：`test-results/evidence-screenshots/smashup/smashup-phase-transition-simple.e2e/回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局/`

### 本次实际查看的截图与结论

#### 1) host 先选完第一个派系后，流程仍停留在 factionSelect
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局-online-ai-faction-select-host-picked-first.png`
- 我实际看到：页面仍是“选择你的派系”界面，顶部有“正在等待 P1 / 等待对手加入…”提示，左上牌面已有“已选择”标记。
- 我实际看到：此时没有提前进入棋盘，也没有出现空手牌/空牌库的坏局面。
- 验收判断：**达到本轮阶段性验收标准**，证明 host 完成第一选后仍在正确的派系选择链路中。

#### 2) watchdog 窗口之后，仍未被错误跳进空牌 playCards
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局-online-ai-faction-select-still-waiting-after-watchdog.png`
- 我实际看到：画面仍在派系选择页，不是棋盘出牌页；中央仍是派系列表与座位选择态。
- 我实际看到：顶部提示已切到“现在轮到你了”，说明流程继续沿 factionSelect 正常推进，而不是被 watchdog 粗暴 ADVANCE_PHASE 跳到坏局面。
- 验收判断：**达到本轮核心验收标准**，证明 watchdog 没有把该反馈链路误推进到空牌对局。

#### 3) 最终进入正常 playCards，手牌/牌库初始化正常
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局\回归：在线-AI-在-factionSelect-阶段-seat-state-延迟就绪时，不得被-watchdog-跳过到空牌对局-online-ai-faction-select-final-playcards.png`
- 我实际看到：已进入正常棋盘，左上显示“回合1 / 你自己 / 出牌阶段”，不是异常 setup 态。
- 我实际看到：底部能直接看到 5 张手牌，左下牌库角标为 35，说明不是“空手牌 + 空牌库”坏局面。
- 我实际看到：棋盘上 3 个基地正常出现，右侧 HUD 与结束回合按钮都在正常位置。
- 验收判断：**达到本轮最终验收标准**，证明延迟 seat state 场景最终能正常开局。

### 本次复跑结论
- 截至 **2026-04-17**，该反馈链路在真实联机 E2E 中仍然通过。
- 新一轮 transport / watchdog / reconcile 改动没有把旧问题带回：`factionSelect` 没有再被误推进到空牌 `playCards`，最终仍能正常进入有手牌/牌库的对局。
