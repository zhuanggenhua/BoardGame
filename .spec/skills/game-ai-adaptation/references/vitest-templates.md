# Game AI Adaptation Vitest Templates

> 模板不是让你生搬硬套，而是提示“这类 AI 修复至少要锁住什么事实”。新增用例时优先补到现有测试文件：
>
> - 引擎 watchdog：`src/engine/transport/__tests__/server.test.ts`
> - DiceThrone：`src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
> - Smash Up：`src/games/smashup/__tests__/promptSystem.test.ts` / `beforeScoring-window-stuck.test.ts` / `duplicateInteractionRespond.test.ts`
> - Summoner Wars：`src/games/summonerwars/__tests__/basic-commands-coverage.test.ts` / `interaction-chain-comprehensive.test.ts`

---

## 模板 1：区分 human 当前回合 与 “AI 当前阶段 + human responder”

```ts
it('human 当前回合时，watchdog 不得误触发 AI 兜底', async () => {
  // Assert:
  // 1. executeCommandInternal 不应收到 RESPONSE_PASS / ADVANCE_PHASE / FORCE_CLOSE
  // 2. onlineAiFeedbackReporter 不应收到误报
})

it('AI 当前阶段卡在 human 响应窗口时，watchdog 应先 FORCE_CLOSE 再收口', async () => {
  // Arrange:
  // 1. activePlayerId 指向 AI
  // 2. responseWindow.current.currentResponderId 指向 human
  // 3. human 手牌/状态要能代表“真实可响应场景”

  // Assert:
  // 1. 第一步应收到 SYS_RESPONSE_WINDOW_FORCE_CLOSE
  // 2. 后续才允许 ADVANCE_PHASE / END_PHASE
  // 3. 不允许替 human 发 RESPONSE_PASS
})
```

**推荐文件：** `src/engine/transport/__tests__/server.test.ts`

**对应 E2E：**

- 必须注入 **对手真实可响应牌**
- 前态必须看见 `可以响应/跳过` 或等价响应入口
- 收口后必须同时证明：
  - 响应窗口已消失
  - 阶段推进或控制权交还已完成

## 模板 1A：同一状态的并列合法动作必须完整枚举

```ts
it('AI 在同一规则状态下应同时保留可介入动作和收口动作', () => {
  // Arrange:
  // 1. 构造一个真人同状态下既能修改当前中间结果，也能确认 / 跳过收口的规则状态
  // 2. 确认修改动作和确认动作各自都能通过领域 validate

  // Act:
  // const actions = build<Game>AiLegalActions({ playerId, state })

  // Assert:
  // 1. legal actions 包含修改 / 重掷 / 选择目标等可介入动作
  // 2. legal actions 同时包含确认 / 跳过 / done 等收口动作
  // 3. 去掉可介入条件后，legal actions 不应凭空生成该动作，但仍保留合法收口动作
})
```

**推荐文件：** 各游戏现有 AI legal-actions 测试文件；有真实页面消费风险时，再补代表性 E2E。

**注意：** 这类测试锁的是“规则动作合同完整消费”，不是 UI 按钮数量。按钮、骰盘、手牌区、HUD 只作为消费者，不能成为 AI 预期来源。

---

## 模板 2：AI 已确认阶段后不应再产出前一阶段动作

```ts
it('本地 AI 在已确认状态下不应继续生成会重开响应窗口的动作', () => {
  // Arrange:
  // 1. 构造 state，让 AI 处于“已确认、理论上应等待下一阶段”的状态
  // 2. 调用 build<Game>AiLegalActions 或 resolveNextLocalAiAction

  // Act:
  // const actions = build<Game>AiLegalActions({ playerId: '0', state })

  // Assert:
  // 1. 不包含会 reopen response-window 的动作
  // 2. 若此时应直接推进阶段，检查得到 advance / end-phase
})
```

**推荐文件：**

- DiceThrone：`src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
- Summoner Wars：`src/games/summonerwars/__tests__/basic-commands-coverage.test.ts`

---

## 模板 3：无解交互时 AI 必须 cancel / pass / skip

```ts
it('AI 在无合法选项的交互中应走 cancel/pass/skip，而不是卡死', async () => {
  // Arrange:
  // 1. 构造一个 options 为空、或全部 disabled、或 min 无法满足的交互
  // 2. 若是 hidden interaction，使用 playerView 后的 seatState 做诊断

  // Act:
  // const resolution = await resolveNextLocalAiAction(...)
  // 或 const candidate = resolveForceSkippableHiddenAiInteraction(...)

  // Assert:
  // 1. 返回 cancel/pass/skip 命令之一
  // 2. 自动诊断里带 empty-options / all-options-disabled / min-selection-unreachable
})
```

**推荐文件：**

- 引擎 watchdog：`src/engine/transport/__tests__/server.test.ts`
- 游戏 AI：各游戏 `basic-commands-coverage.test.ts` / interaction 相关测试文件

---

## 模板 4：重复动作循环应被 AI guard 或 watchdog 打断

```ts
it('AI 遇到重复交替动作循环时应被打断并推进离开当前卡死状态', async () => {
  // Arrange:
  // 1. 构造最近动作形成 repeat / alternating pattern
  // 2. 当前玩家必须是 AI

  // Act:
  // const candidate = resolveForceEndTurnForStalledAi({
  //   sharedState,
  //   seatControllers,
  //   seatStates,
  // })

  // Assert:
  // 1. candidate.reason === 'action-loop'
  // 2. resolution.commands 为 ADVANCE_PHASE / END_PHASE / RESPONSE_PASS 中的正确一种
  // 3. 不影响 human seat
})
```

**推荐文件：**

- `src/engine/transport/__tests__/server.test.ts`
- 若是某游戏本地 AI 评分函数导致的循环，也要在该游戏现有 AI 测试文件补一条

---

## 模板 5：hidden interaction 必须通过 playerView 才能发现

```ts
it('hidden interaction 只能通过 seat playerView 被 watchdog 识别', () => {
  // Arrange:
  // 1. sharedState.sys.interaction.current = undefined
  // 2. sharedState.sys.interaction.isBlocked = true
  // 3. 某个 AI seat 的 playerView 中存在 current interaction

  // Act:
  // const candidate = resolveForceEndTurnForStalledAi({
  //   sharedState,
  //   seatControllers,
  //   seatStates,
  // })

  // Assert:
  // 1. 没有 seatStates 时识别不到
  // 2. 有 seatStates 时能拿到 hidden-interaction resolution
})
```

**推荐文件：** `src/engine/transport/__tests__/server.test.ts`
