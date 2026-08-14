# Summoner Wars AI 交互审计（强口径更新，2026-04-12）

## 审计范围
- 在线 AI watchdog 兜底链路：`src/engine/transport/server.ts`、`src/engine/transport/onlineAiRecovery.ts`
- 在线 AI seat 识别前提：`src/pages/onlineAiSeats.ts`
- Summoner Wars 在线 E2E 场景：`e2e/helpers/summonerwars.ts`、`e2e/summonerwars/summonerwars.e2e.ts`
- 仅收口本轮目标：**Summoner Wars 在线 AI seat + watchdog 卡死兜底证据**。不把本文扩写成“Summoner Wars 全量 AI 已审完”。

## 权威来源
- `.spec/knowledge/standards/testing-audit.md`（D3 / D5 / D8 / D15 / D39）
- `src/games/summonerwars/rule/*.md`
- `src/pages/onlineAiSeats.ts`
- `src/engine/transport/server.ts`
- `src/engine/transport/onlineAiRecovery.ts`

## 本轮测试构造与修正
### 测试目标
验证一个**真实在线 AI 房间**：
1. 房间创建时显式声明 `enableAi: true` + `seatControllers['1']=local-ai`
2. E2E 主动阻断 AI seat `claim-seat`
3. 将房间注入到“AI 当前回合、无交互、无 responseWindow”的卡死态
4. 观察服务端 watchdog 是否自动收口到真人回合
5. 额外等待，确认真人回合不会被再次强制推进

### 本轮测试修正
- 初版注入使用纯 evidence state，缺少服务端要求的 `sys.matchId` / `sys.turnOrder` / `sys.currentPlayerIndex`，会被 `/test/inject-state` 拒绝。
- 已修正为：**先读取在线房间 live state，再把 live state 的系统元数据合并进 watchdog 注入态**，保证场景是真实在线房间而不是脱离房间上下文的假状态。

## 逐项结论（强口径）

### 1) 在线 AI seat 前提已被真实满足 — PASS
- 创建房间时通过 `createSWRoomViaAPI(..., { setupData })` 透传：
  - `enableAi: true`
  - `seatControllers['1'] = { type: 'local-ai', minimumActionDelayMs: 0 }`
- 这满足 `src/pages/onlineAiSeats.ts` 的信任前提：前端会把 seat `1` 识别为 AI seat，而不是真人。
- 结论：**本用例不是“假 AI 房间”，而是真实在线 AI seat 场景。**

### 2) watchdog 只针对 AI seat / AI 回合，不会误推进真人 — PASS
- 静态链路：`src/engine/transport/server.ts` 会先从 `setupData.seatControllers` 解析 seat controller；human seat 不进入 AI recovery 候选。
- 动态证据：
  - 注入后先确认 `currentPlayer = '1'`（AI seat）且 `sw-end-phase` 按钮 disabled。
  - watchdog 收口后确认 `currentPlayer = '0'` 且 `sw-end-phase` enabled。
  - 额外等待 9 秒后，`currentPlayer`、`phase`、`turnNumber` 均保持不变，未发生“真人回合又被继续强制推进”。
- 结论：**本轮已证明 watchdog 收口点只落在 AI seat / AI 回合，不会把真人回合继续向前硬推。**

### 3) 阻断 AI seat 建连后，服务端 watchdog 能自动收口卡死回合 — PASS
- 本用例通过 `blockSummonerWarsAiSeatAutoClaim()` 拦截 `POST /games/summonerwars/:matchId/claim-seat`，对 `playerID === '1'` 返回 503。
- 运行时断言：`localStorage['match_ai_creds_<matchId>'] === null`，证明 AI seat 凭据没有被自动领取。
- 在此基础上注入 AI 回合卡死态后，服务端 watchdog 成功把对局切回 `player 0` 的真人回合。
- 结论：**这条证据链证明了“AI seat 真断线/真没建连时，watchdog 仍能收口”而不是只对本地 mock 生效。**

### 4) 未出现“AI 强制结束失败 / AI 自动跳过失败”提示 — PASS
- 用例在 recovery 后、以及额外等待后的真人稳定阶段，都断言：
  - `AI 强制结束失败`
  - `AI 自动跳过失败`
  这两类提示均不存在。
- 结论：**本轮补齐了用户最关心的“还会不会继续弹那几个失败提示”的在线证据。**

### 5) Summoner Wars 在线 watchdog 证据缺口已补齐，但不是“全量 AI 已收口” — PASS（范围内）
- 本轮目标已经完成：在线 AI seat + watchdog + 真人保护 的端到端证据已补齐。
- 但这**不等于**下面这些问题已经全部收口：
  - response-window 二次触发 / 响应音效循环
  - UI-only prompt 对 AI / watchdog 的可见性
  - phase-triggered ability 的全量 AI parity
- 结论：**本轮是“watchdog 强口径补齐完成”，不是“Summoner Wars 全量 AI 完结”。**

## 实际运行与结果
### 静态检查
- `npx eslint e2e/helpers/summonerwars.ts` → 通过（0 errors / 0 warnings）
- `npx eslint e2e/summonerwars/summonerwars.e2e.ts` → 通过（0 errors，存在仓库既有 warnings）
- `npx tsc --noEmit` → 通过

### 动态验证
- 命令：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars.e2e.ts "在线 AI watchdog/卡死兜底：阻止 AI seat 建连后，服务端仍应自动收口到真人回合且不误推进真人"`
- 结果：
  - `1 passed (33.5s)`

## 关键截图与肉眼结论

### A. 卡死注入后、watchdog 收口前
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-watchdog-卡死兜底：阻止-AI-seat-建连后，服务端仍应自动收口到真人回合且不误推进真人\watchdog-before-recovery.png`
- 肉眼观察：
  1. 棋盘、手牌、调试面板都已正常渲染，不是白屏/断渲染。
  2. 顶部红色提示条显示“等待对手加入…”，说明 seat `1` 没有成功建连，符合本用例的人造卡死前提。
  3. 调试面板里“当前玩家 = 1 / 阶段 = summon”，与“AI 回合卡死”预期一致。
- 验收判断：**达到“watchdog 触发前确实处于 AI 回合卡死态”的验收标准。**

### B. watchdog 收口后
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-watchdog-卡死兜底：阻止-AI-seat-建连后，服务端仍应自动收口到真人回合且不误推进真人\watchdog-after-recovery.png`
- 肉眼观察：
  1. 调试面板里的“当前玩家”已经从 `1` 变成 `0`，说明 watchdog 已经把对局从 AI seat 收口回真人 seat。
  2. 棋盘仍保持稳定显示，没有因为 recovery 进入白屏、遮挡或整页抖动异常。
  3. 画面里没有出现“AI 强制结束失败 / AI 自动跳过失败”的失败提示弹窗。
- 补充断言：同一条用例内已实际断言 `sw-end-phase` 此时为 enabled。
- 验收判断：**达到“watchdog 已有效收口且没有失败提示”的验收标准。**

### C. 额外等待后的真人稳定阶段
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线-AI-watchdog-卡死兜底：阻止-AI-seat-建连后，服务端仍应自动收口到真人回合且不误推进真人\watchdog-human-turn-stable.png`
- 肉眼观察：
  1. 额外等待后，调试面板中的“当前玩家”仍然是 `0`，没有再次跳回 AI 或继续自动推进。
  2. 画面结构与 recovery 后保持一致，没有新增弹窗、没有失败提示、没有循环闪烁。
  3. 棋盘/手牌区域仍然稳定可见，说明 recovery 没把房间打坏。
- 补充断言：同一条用例内已实际断言 `sw-end-phase` 仍为 enabled，且 `phase` / `turnNumber` 与 recovery 完成时保持一致。
- 验收判断：**达到“真人回合不会被 watchdog 继续误推进”的验收标准。**

## 与旧结论的关系
- 2026-04-11 的静态审计已经指出：Summoner Wars 仍存在 UI-only prompt、response-window、loop detector 覆盖不足等结构性风险。
- **本轮没有推翻这些旧风险。**
- 本轮只新增了一个此前缺失、但对用户最关键的强口径结论：
  - **在线 AI seat 真断连/真未建连时，Summoner Wars watchdog 现在有真实端到端证据证明“能收口、且不会误推进真人”。**

## 未覆盖项 / 后续仍需继续审查
1. **response-window / 响应音效循环** — 未覆盖
   - 本轮 E2E 只覆盖 active-turn stall，不覆盖“跳过后立刻又触发响应/音效循环”的链路。
2. **UI-only prompt 可见性** — 未覆盖
   - `ABILITY_TRIGGERED` / `*_REQUESTED` 这类 React 本地 mode，AI / recovery 是否都可见，本轮未动态验证。
3. **loop detector 对 Summoner Wars phase 的专项命中** — 未覆盖
   - 本轮证明了超时 watchdog 可收口，但没有补齐“动作循环直接判卡死”的 SW 专项动态证据。
4. **全量派系 / 全量交互类型** — 未覆盖
   - 本轮仅补 watchdog 兜底，不代表所有 Summoner Wars AI 交互都已逐个动态审完。

## 最终结论
- **本轮任务已收口：Summoner Wars 在线 AI watchdog 兜底的端到端证据已补齐，并已证明不会误推进真人回合。**
- **但 Summoner Wars 全量 AI 架构与所有交互类型仍未全收口；本文只对“在线 AI watchdog 兜底”给出 PASS。**
