# Smash Up AI 交互强口径审计（2026-04-11 / 2026-04-12 更新）

## 审计范围
- 目标：确认 Smash Up 在线 AI 在 **交互 / 响应窗口 / 阶段推进 / watchdog 兜底** 四条主链上不会把真人玩家卡死，并给出当前未覆盖清单。
- 覆盖模块：
  - AI 决策与 legal actions：`src/games/smashup/ai.ts`
  - 领域层流程与响应窗口：`src/games/smashup/domain/*`
  - 在线 AI 兜底：`src/engine/transport/onlineAiRecovery.ts`、`src/engine/transport/server.ts`
  - 在线 E2E：`e2e/smashup/smashup-phase-transition-simple.e2e.ts`

> 说明：本审计只覆盖 Smash Up AI 交互链，不代表另外两个游戏已收口。

## 权威来源 / 审计依据
- `.spec/knowledge/standards/testing-audit.md`
- `docs/automated-testing.md`
- `src/games/smashup/rule/*.md`

## 本轮新增修订
> 续审说明：本轮持续审计阶段 **未复跑任何测试**，下文的 E2E/截图为历史记录的证据清单（非本轮新增复跑）。若需复跑，将另起“本轮验证”记录并补新时间戳。

1. `e2e/smashup/smashup-phase-transition-simple.e2e.ts`
   - 在线 AI 房间创建显式带 `enableAi: true`，避免 `seatControllers` 因不被信任而失效。
   - `force-skip` 用例补断言：**跳过隐藏交互后仍停留在 AI 回合**，不会误推进到真人。
   - `force-skip` / `force-end-turn` 两条用例都补断言：**不存在 `AI 强制结束失败` 提示**。
2. 历史曾重跑（非本轮）：
   - `在线 AI 的盘旋机器人隐藏交互卡住时，应在 4 秒后自动跳过并恢复对局`
   - `在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合`

---

## 交互类型 → AI 可执行性矩阵

> 口径：  
> ✅ = 已有静态与/或运行时证据证明当前主链可推进  
> ⚠️ = 当前主链可用，但仍有未补齐样本/跳过测试/扩展风险  
> ❌ = 本轮未拿到有效证据

| 交互/阶段类型 | AI 当前行为 | 关键证据 | 结论 | 备注 |
|---|---|---|---|---|
| `sys.interaction` 普通 `simple-choice` | AI 先走 `buildInteractionActions`，对刷新后的 options 生成 `SYS_INTERACTION_RESPOND` | `src/games/smashup/ai.ts`；`src/games/smashup/__tests__/smashup.smoke.test.ts` 中 AI 目标交互用例（自利目标/敌对目标/复合目标） | ✅ | 交互主链已不是当前最危险点 |
| **隐藏交互（AI seat 看得到，真人看不到）** | 正常情况下 AI 自动 batch 响应；卡住时先 force-skip | E2E：`在线 AI 持有隐藏交互时应自动 batch 响应并推进状态`、`在线 AI 的盘旋机器人隐藏交互卡住时，应在 4 秒后自动跳过并恢复对局` | ✅ | 已证明不会把房主视角永久阻塞 |
| `responseWindow` 常规响应 | AI 会在 `response-play-*` 与 `response-pass` 之间做决策 | `src/games/smashup/__tests__/smashup.smoke.test.ts`：`Smash Up baseline AI 在高压评分响应窗口应优先响应，而不是直接 response-pass`；`Smash Up baseline AI 在非紧急响应窗口会选择 response-pass，避免空耗响应牌` | ✅ | 响应窗口决策有代表性行为证据 |
| `responseWindow` 空响应者 / 无可响应内容 | 系统会自动跳过无内容响应者，并在所有人都无内容时关闭窗口 | `src/games/smashup/__tests__/response-window-skip.test.ts`：`重新开始一轮时应跳过没有可响应内容的玩家`、`所有玩家都没有可响应内容时应立即关闭窗口` | ✅ | 这是“不会空转卡住”的共享底座 |
| `responseWindow + interaction` 并存 | 交互锁定期间不会提前关窗；交互解锁后继续原窗口 | `src/games/smashup/__tests__/response-window-skip.test.ts`：`交互失败时应解锁但不推进（当前响应者继续响应）`、`tail responder interaction should not close response window early` | ✅ | 已覆盖“尾响应者交互后窗口不应错误收口” |
| `afterScoring` 响应窗口 | 计分后窗口不会提前清场；交互完成后再补发后续结算 | `src/games/smashup/__tests__/afterScoring-rescoring.test.ts`：`afterScoring 窗口打开期间不应提前清场换基地，窗口关闭后只补发一次`、`无力量变化：afterScoring 窗口无人出牌时不重新计分` | ✅ | 证明计分后主链可停、可续、可收口 |
| `afterScoring + 当前 simple-choice` 并存 | 即使已有交互，也允许继续打出响应行动牌 | `src/games/smashup/__tests__/afterScoring-rescoring.test.ts`：`afterScoring 响应窗口与当前 simple-choice 并存时，仍允许打出响应行动牌` | ✅ | 覆盖“窗口与交互并存”高风险组合 |
| `afterScoring` 链式交互 / 最后基地补发结算 | 最后基地上的 afterScoring 交互链结束后仍能完成换基地 | `src/games/smashup/__tests__/afterScoring-rescoring.test.ts`：`最后一个基地在 afterScoring 交互链中打出返回深海后，仍应完成计分与换基地`；`innsmouth_return_to_the_sea_pod 在 afterScoring 窗口中打出后，应立即创建交互并锁定响应窗口` | ✅ | 这是“交互链结束后不能悬空”的直接证据 |
| 回合切换时的 startTurn / afterScoring 交互 | 流程应停在交互点，响应后再继续，不把 Interaction 悬空带进下一阶段 | `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts`：`P0 结束回合 → P1 回合开始 → 拉莱耶 Interaction → P1 应能响应后正常操作`；`托尔图加达标 → 计分 → afterScoring Interaction → 流程应暂停等待响应` | ✅ | 这是“不会推进到错误阶段导致假卡死”的关键证据 |
| 在线 watchdog：4 秒无解隐藏交互 | AI seat 先尝试响应，失败后自动 `force-skip`，**仍留在 AI 当前回合** | E2E：`在线 AI 的盘旋机器人隐藏交互卡住时，应在 4 秒后自动跳过并恢复对局` | ✅ | 已证明“不会误把 AI 回合直接推进给真人” |
| 在线 watchdog：8 秒无进展 | AI seat 在持续无进展时自动 `force-end-turn`，**直接切回真人回合** | E2E：`在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合` | ✅ | 已证明“卡死时一定收口，且收口到真人回合” |
| watchdog 收口后 UI 稳定性 | AI 回合结束回到真人时不应整板重挂载 / loading 闪屏 | E2E：`在线 AI 结束回合切回我方时不应出现整板重挂载或 loading 闪屏` | ✅ | 防止“看似推进成功，实际 UI 重挂导致假死” |
| 在线 AI 房间创建契约 | 带 AI seatControllers 的房间显式 `enableAi: true` | `e2e/smashup/smashup-phase-transition-simple.e2e.ts` 的 `setupSmashUpOnlineAiRoom()` | ✅ | 本轮已补齐并保留 |

---

## 历史 E2E 证据（非本轮复跑）

### A. 4 秒 force-skip：隐藏交互卡住时只跳过 AI 当前隐藏交互，不误推进真人

#### 历史运行命令（非本轮复跑）
```bash
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 的盘旋机器人隐藏交互卡住时，应在 4 秒后自动跳过并恢复对局"
```

#### 截图 1：超时 toast 出现
路径：  
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局\在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局-online-ai-hoverbot-force-skip-toast.png`

肉眼观察：
- 左上角仍显示 **回合 3 / 对手 / 出牌阶段**，说明此时仍然是 AI 的回合，不是我的回合。
- 右上角出现 `AI 响应超时` / `AI 自动跳过` toast，没有出现 `AI 强制结束失败` 文案。
- 画面中央棋盘正常、无遮挡、没有 loading 蒙层。

验收判断（历史记录）：
- **达到验收标准**：说明 watchdog 先走的是“只跳过当前隐藏交互”的收口，而不是错误地结束真人回合。

#### 截图 2：跳过后恢复对局
路径：  
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局\在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局-online-ai-hoverbot-force-skip-after-resolve.png`

肉眼观察：
- 左上角依然是 **对手 / 出牌阶段**，证明 `force-skip` 之后仍停留在 AI 回合。
- 右上角超时 toast 已消失，棋盘恢复正常可见状态，没有“强制结束失败”提示残留。
- 右下角结束回合主按钮没有错误切到真人主回合态。

验收判断（历史记录）：
- **达到验收标准**：证明当前修复满足“超时就跳过，但别推进到玩家”的要求。

### B. 8 秒 force-end-turn：持续无进展时必须直接收口到真人回合

#### 历史运行命令（非本轮复跑）
```bash
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合"
```

#### 截图 3：超时前仍卡在 AI 回合
路径：  
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合-online-ai-force-end-turn-before-timeout.png`

肉眼观察：
- 左上角显示 **回合 3 / 对手 / 出牌阶段**，说明 AI 仍卡在自己的出牌阶段。
- 右下角结束回合按钮为灰暗不可操作态，符合“房主被隐藏交互阻塞”的前置状态。
- 没有出现真人自己的回合提示。

验收判断（历史记录）：
- **达到验收标准**：这是“AI 已卡死但尚未收口”的有效前态截图。

#### 截图 4：强制结束后切回真人
路径：  
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-phase-transition-simple.e2e\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合\在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合-online-ai-force-end-turn-after-resolve.png`

肉眼观察：
- 左上角变成 **回合 4 / 你自己 / 出牌阶段**，明确已经切回真人玩家回合。
- 画面中央出现 `轮到你了！` 提示，右上角 toast 为 `AI 强制结束回合 / AI 已强制结束回合。`，没有任何 `AI 强制结束失败` 文案。
- 右下角结束回合主按钮恢复正常可见，说明真人已重新拿回操作权。

验收判断（历史记录）：
- **达到验收标准**：证明“持续无进展 → 必须强制推进，而且直接推进到真人回合”已生效。

---

## D1-D49 关键维度结论

| 维度 | 结论 | 证据 |
|---|---|---|
| D3 数据流闭环 | ✅ | `ai.ts` legal action → `domain/commands.ts` validate → `responseWindow/interaction` → `onlineAiRecovery` → E2E 强制收口 |
| D5 交互完整 | ✅ | 普通交互、隐藏交互、responseWindow、afterScoring 并存与链式交互都有测试/E2E 证据 |
| D8 时序正确 | ✅ | `turnTransitionInteractionBug.test.ts`、`afterScoring-rescoring.test.ts`、force-skip / force-end-turn E2E |
| D15 UI 状态同步 | ✅ | `在线 AI 结束回合切回我方时不应出现整板重挂载或 loading 闪屏` |
| D39 流程卡死兜底 | ✅（当前主链） / ⚠️（仍有扩展风险） | 当前在线 AI 隐藏交互卡死与无进展卡死都能自动收口；但 source-level 仍有 skipped tests 未恢复 |

---

## 历史验证记录（非本轮复跑）
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 的盘旋机器人隐藏交互卡住时，应在 4 秒后自动跳过并恢复对局"`  
  - 历史记录：该命令曾通过（非本轮复跑）
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-phase-transition-simple.e2e.ts "在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合"`  
  - 历史记录：该命令曾通过（非本轮复跑）
- `npx eslint e2e/smashup/smashup-phase-transition-simple.e2e.ts`  
  - 结果：**0 errors / 49 warnings（历史记录，仓库既有 any 警告，非本轮新增阻塞）**

---

## 未覆盖风险 / 补测计划

> 强口径要求下，这些项 **不能假装已收口**。

1. **仍有 skipped 的历史高风险链路**
   - 例如：
     - `src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug.test.ts`
     - `src/games/smashup/__tests__/mothership-scout-afterscore-bug.test.ts`
     - `src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts`
     - `src/games/smashup/__tests__/wizard-academy-scout-afterscore.test.ts`
   - 当前状态：⚠️ **未覆盖**
   - 补测计划：优先恢复“隐藏交互 + afterScoring 链式传递 + 最后基地换基地”三条。

2. **历史 E2E 曾重跑最容易卡死的两条 watchdog 主链（本轮未复跑）**
   - 历史已跑：hidden interaction `force-skip`、no-progress `force-end-turn`
   - 未重跑：`在线 AI 持有隐藏交互时应自动 batch 响应并推进状态`、`在线 AI 结束回合切回我方时不应出现整板重挂载或 loading 闪屏`
   - 当前状态：⚠️ **依赖现有测试与历史证据，不算本轮动态新增证明**
   - 补测计划：在整批三游戏 AI 审计收口阶段重跑这两条补齐最新时间戳。

3. **source-level “能合法打出，但能力内部立即 feedback 失败”的响应牌矩阵还未逐张枚举**
   - 当前状态：⚠️ 仅有代表性样本，不是逐卡穷尽
   - 补测计划：按 `giant_ants / pirates / aliens / zombies / ninjas` 等存在 response/afterScoring 牌的派系补“可解预检矩阵”。

4. **当前审计已能证明“真人不会被 Smash Up AI 主链卡死”，但不能证明“仓库中每一张未来新增响应牌天然安全”**
   - 当前状态：⚠️ 需要持续把新牌纳入 response-window/afterScoring 套件
   - 补测计划：新增 response/afterScoring 牌时，必须至少补 1 条 GameTestRunner 行为测试 + 视风险补 1 条 E2E。

---

## 最终结论（仅针对 Smash Up 当前主链，历史证据）

- **结论 1：当前最容易把真人卡死的两条 Smash Up 在线 AI 主链，已有历史运行时证据支撑。**
  - 隐藏交互卡住 → **4 秒 force-skip，仅跳过 AI 当前隐藏交互，不误推进到真人**
  - 持续无进展 → **8 秒 force-end-turn，直接切回真人回合**

- **结论 2：当前 watchdog 的“不会影响真人”口径，Smash Up 已有历史直接证据。**
  - `force-skip` 后仍停留 AI 回合
  - `force-end-turn` 后明确切到真人回合
  - 历史截图中均**未出现 `AI 强制结束失败` 提示**

- **结论 3：Smash Up 主链可宣称“已拿到强证据”，但不能宣称“所有历史交互都已 100% 审完”。**
  - 原因：仍有 skipped 历史回归链未恢复，必须保留为未覆盖项。

## 修订记录
- 2026-04-11：建立初版 Smash Up AI 交互审计。
- 2026-04-12：升级为强口径版本；补记 `enableAi: true`、`force-skip` 不误推进真人、`force-end-turn` 无失败弹窗；历史记录显示曾重跑两条最容易卡死的在线 AI E2E 并补截图结论。
