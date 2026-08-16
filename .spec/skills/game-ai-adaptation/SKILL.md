---
name: game-ai-adaptation
description: "BoardGame 游戏 AI 接入入口。用于 AI/机器人/自动玩家、ai.ts、自动响应、watchdog、强制跳过、卡死兜底和响应窗口门禁。"
---

# Game AI Adaptation

## 何时必须使用

出现下列任一情况就触发本技能：

- 修改 `src/games/<gameId>/ai.ts`
- 新增/修改 AI 自动响应、自动跳过、强制结束、watchdog
- 修复 “AI 卡死 / 无法选择 / 重复交互 / 跳过后立刻又触发 / 响应音效循环”
- 新游戏接 AI，需要审查交互闭环与兜底策略
- 改动玩家交互合同后需要同步审查 AI / 机器人 / 自动玩家：例如确认入口、对象选择路径、阻塞层生命周期、专用按钮改为通用按钮、弹窗改为侧栏 / 骰盘 / HUD，或真人原本能点的收口动作迁移到另一个 UI 承载物
- 用户提到：`AI 接入`、`AI 适配`、`AI 卡死`、`自动跳过`、`强制推进`、`watchdog`、`response-window`、`无解交互`

若用户关注的是“AI 蠢 / 打法优化 / 策略设计 / 对比大杀四方 / 英雄或卡组画像 / 评分模型重构”，先读项目 skill：`.spec/skills/game-ai-strategy-design/SKILL.md`。本技能只负责 AI 合法动作、交互闭环、卡死和兜底。

---

## 先读什么（强制）

1. `.spec/knowledge/standards/engine-systems.md`
2. `.spec/knowledge/standards/testing-audit.md`
3. 本技能 references：
   - `references/checklist.md`
   - `references/response-window-watchdog.md`
   - `references/vitest-templates.md`
4. 真实审计样例（优先复用旧结论并回写）：
- `evidence/engine/online-ai-watchdog-strong-audit-2026-04-12.md`
- `evidence/engine/ai-stall-loop-full-chain-audit-2026-04-12.md`
- `evidence/dicethrone/dicethrone-ai-interaction-audit-2026-04-11.md`
- `evidence/dicethrone/dicethrone-ai-interaction-audit-2026-04-12.md`
- `evidence/dicethrone/dicethrone-response-window-retrigger-audit-2026-04-12.md`
- `evidence/dicethrone/dicethrone-discard-undo-loop-audit-2026-04-11.md`

---

## 本仓库 AI 真正的执行链路（必须按这个理解）

### 1) 交互链

- 游戏层通常在 `domain/execute.ts` / `domain/systems.ts` 中创建交互
- 引擎层 `InteractionSystem` 负责：
  - `sys.interaction.current / queue`
  - `createSimpleChoice()` / `createMultistepChoice()`
  - `resolveInteraction()`
  - `playerView()` 对非当前玩家隐藏交互详情，并只暴露 `isBlocked`

**关键事实：**

- `createSimpleChoice()` 若传入空选项，会直接打印错误：这是卡死前兆，不是可接受状态
- 非当前交互玩家在 `playerView` 中看不到 `current`，只会看到 `isBlocked=true`
- 所以“sharedState 看不到交互，不代表没有交互”；可能只是**隐藏交互**

### 2) 响应窗口链

- `ResponseWindowSystem` 负责：
  - `RESPONSE_WINDOW_EVENTS.OPENED / CLOSED`
  - `RESPONSE_PASS`
  - `SYS_RESPONSE_WINDOW_FORCE_CLOSE`
  - `allowedCommands`
  - `responderExemptCommands`
  - `allowNonResponderCommand`
  - 当前响应者门禁（不是当前 responder 的命令会被拦）

**关键事实：**

- 响应窗口是否能闭环，不取决于 AI 会不会点，而取决于：
  - 是否存在合法响应命令
  - 无响应时是否能 `RESPONSE_PASS`
  - 是否会因 `pendingInteractionId` / stale queue / reopen 事件再次卡住
- **区分两种 human responder 场景：**
  - 若当前轮到 human，本来就是 human 在响应：watchdog **不得**出手
  - 若当前轮到 AI，但流程卡在 **human 的响应窗口**：watchdog 允许先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`，再继续把 AI 阶段收口

### 3) 在线 AI 兜底链

- 服务端 watchdog：`src/engine/transport/server.ts`
- 决策函数：`src/engine/transport/onlineAiRecovery.ts`
  - `resolveForceSkippableHiddenAiInteraction()`
  - `resolveForceEndTurnForStalledAi()`
  - `resolveForceAdvancePhaseAfterRecovery()`
  - `resolveUnsatisfiableReasonFromInteraction()`
  - `buildOnlineAiRecoveryStateSnapshot()`
  - `buildUnsatisfiableInteractionStateSnapshot()`

**关键事实：**

- watchdog 是**AI seat 专属兜底**，不是“全局强推”
- hidden interaction 必须靠 `applyPlayerView(match, playerId)` 生成 seat view 才能诊断
- 当前共享态若是 `interaction.current == null && isBlocked == true`，要优先怀疑**隐藏交互**
- **不要把 `currentResponderId === human` 简化成“一律返回 null”**。正确判断是：
  - 当前轮到 human → 返回 `null`
  - 当前轮到 AI，但 AI 阶段被 human 响应窗口卡住 → 先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`

---

## 核心原则（强口径）

### 原则 1：AI 只能从“真正可执行”的动作里选

禁止：

- 把 `validate()` 会拒绝的命令留给 AI
- 把 `disabled=true` 选项当成可行动作
- 把 `removable=false` 的状态/标记当成可移除目标
- 让 AI 在 `rollConfirmed=true` 之后继续生成重掷动作

必须：

- legal actions 与 validate/execute 语义一致
- 若 legal actions 为空，立即走 cancel/pass/skip，而不是继续等

### 原则 2：每个交互都必须有“收口命令”

至少要有一个：

- `SYS_INTERACTION_RESPOND`
- `SYS_INTERACTION_CANCEL`
- `RESPONSE_PASS`
- `ADVANCE_PHASE`
- 游戏特化的阶段推进命令（如某些游戏的 `END_PHASE`）

没有收口命令的交互 = 设计缺陷，不是“AI 之后再补”

### 原则 2A：UI 交互合同变更必须同步审查 AI 闭环

只要玩家真实操作入口发生语义变化，就必须把 AI 当成另一个执行者重新过闭环，而不是只证明真人能点：

- **必须审查**：确认 / 取消 / 跳过入口迁移，对象本体选择替代按钮选择，阻塞式结果层改为侧边结果区，专用收口按钮改为普通确认按钮，或同一规则动作从一个 UI 承载物迁到另一个承载物。
- **不必因纯视觉审查 AI**：颜色、尺寸、阴影、动效、文案轻微排版、同一按钮原位换样式，默认只按 UI / 截图门禁处理。
- **同源动作合同**：真人在同一规则状态下能选择的可执行动作，AI legal actions 也必须从同一规则真相源枚举出来，例如改写中间结果、重掷、确认、跳过、选择目标或打出合法响应。UI 按钮 / 组件 / DOM 只能是这些规则动作的消费者，不能成为 AI 的真相源；如果 AI 策略不想选某动作，应在评分层降权，而不是让合法动作消失。
- **AI 闭环最低问题**：AI 是否仍能枚举到同一合法命令；该命令是否通过 `validate()`；执行后是否真的关闭当前 interaction / response-window / roll context；无可选项时是否有 cancel / pass / skip；是否只作用于 AI seat，不会替真人确认。
- **测试口径**：若变更影响可结算结果或阶段推进，至少补最窄领域 / 协作测试；若风险在真实页面消费、隐藏交互、在线 AI 或玩家视角，则补代表性 E2E。不得用“真人 E2E 能点”替代 AI legal actions / 自动玩家闭环验证。

### 原则 3：AI 兜底只作用于 AI seat

允许：

- AI 被卡住时自动 `RESPONSE_PASS`
- AI hidden interaction 自动选 skip / cancel / done
- AI 卡在自己回合时强制推进阶段
- AI 当前阶段被 **human 响应窗口** 卡住时，先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`，再做 follow-up advance

禁止：

- 当前响应者是 human 时替 human `RESPONSE_PASS` / 选项选择
- human 自己回合里的响应窗口，直接被 watchdog 越权关闭
- 不加门禁地“只要是 human responder 就强关窗口”

### 原则 4：先修事件源/可解性，再修 watchdog

watchdog 是最后兜底，不是第一修法。

优先级必须是：

1. 游戏层交互设计有解
2. AI 决策只选合法解
3. ResponseWindow/InteractionSystem 能自动收口
4. 最后才是 watchdog 对异常循环做强制恢复

### 原则 5：AI 动作延迟要“只延迟可见动作”

默认口径（当前仓库）：

- `minimumActionDelayMs` 只决定“延迟时长”，不决定“哪些动作延迟”
- “是否给下一步加延迟”由 `LocalGameProvider` 的动作类型门控决定
- 静默动作（例如卖牌/跳过 token/纯阶段推进）默认不应累计延迟

#### 5.1 动手前必须先写“可见动作清单”（强制）

只要本轮要改 AI、自动回合、watchdog、自动跳过、自动确认、自动推进、`ai.ts` 或 AI 相关 UI，就必须先把当前链路里的动作分成两类：

- **可见动作**：玩家肉眼能看到，并会拿它当作“AI 正在操作 / 轮到我继续 / 流程还活着”的动作。
- **静默动作**：只是后台收口、合法性清理、隐藏交互闭环、纯阶段推进、无对象变化的内部命令。

最低清单必须至少点名：

1. 哪些动作会让对象本体发生可见变化（摸牌、拿公开牌、弃牌、打出、目标高亮、确认提交）
2. 哪些动作只是后台收口（pass、cancel、force close、hidden interaction respond、纯 advance）
3. 哪些动作之后玩家需要立刻接下一步，所以 UI 必须显式告诉玩家“现在该点哪里”
4. 哪些动作虽然合法，但如果不补等待归属/下一步入口，页面会看起来像卡死

没写出这份清单前，不得实施。

#### 5.2 不改延迟，也必须先做的基础优化（强制）

当用户明确说“不要改延迟”时，仍必须主动检查并补齐以下项目，而不是把问题简化成“那就不动 AI 了”：

1. **可见动作分类是否正确**：不要把纯后台命令误当成需要节奏感的主动作。
2. **等待归属是否清楚**：当前是在等 AI、等对手、还是等系统自动收口，页面上必须说清楚。
3. **唯一下一步是否可发现**：如果 AI 或系统刚完成一步，玩家下一步入口必须直接可见，不能靠猜。
4. **对象变化是否有最小动效或状态反馈**：至少保证本体变化、确认收口、等待切换不是“瞬移 + 死页面”。
5. **证据是否覆盖可见链路**：不能只看日志/断言；至少要回到真实页面看一遍“动作前 / 动作后”。

实现落点（必须同步 `src` 与 `e2e/src`）：

- `src/engine/transport/react.tsx`
- `e2e/src/engine/transport/react.tsx`
- 关键常量/函数：
  - `FAST_AI_COMMAND_TYPES`（本步快速放行）
  - `NO_FOLLOW_UP_DELAY_ACTION_KINDS`（本步执行后不应给下一步上 gate）
  - `shouldSkipFollowUpActionDelay()`

收口判定（必须带日志证据）：

- 用 `[LOCAL_AI_PERF] scheduled/dispatched/command-progress` 验证：
  - 静默动作 `gateDelayMs=0`
  - 需要节奏感的可见动作才出现 `gateDelayMs≈minimumActionDelayMs`
- 禁止只看“体感快慢”不看日志字段就宣称完成

#### 5.3 “可见动作”默认判定口径（直接照这个想）

默认应判为**可见动作**的包括：

- 手牌数量变化、公开区对象变化、场上对象移动
- 需要玩家接续点击的确认/选择/结束回合入口切换
- 等待归属从“我操作”切到“等待 AI / 等待对手 / 等待系统”
- 会让玩家误以为“轮到我了”或“AI 卡住了”的阶段切换

默认应判为**静默动作**的包括：

- hidden interaction 的 skip / cancel / auto respond
- response-window 无响应收口
- 不改变对象呈现的纯 `advance phase`
- watchdog 的内部诊断、失败计数、快照与 guard

如果某一步介于两者之间，按用户体感归类：**用户会不会把它当作“这一步已经发生了”**。会，就按可见动作处理；不会，就按静默动作处理。

---

## 常见卡死类型清单（每次都要逐项过）

### A. 空交互 / 无可选项

**表现：**

- 交互弹出但无法选
- AI 一直不动
- 自动反馈中出现 `empty-options`

**根因常见点：**

- `createSimpleChoice()` 传入空 options
- `optionsGenerator` 失效后没刷新
- `multi.min > enabledOptions.length`
- target/source 在前置事件后已经失效

**避免方式：**

- 创建交互前先判空
- 需要动态刷新时显式启用 `autoRefresh` / `optionsGenerator`
- `min=0` 时提供 `done` 或空提交闭环
- 优先为 simple-choice 补 `autoCancelOption` / skip / done

**guard：**

- AI legal actions 为空时优先发 `SYS_INTERACTION_CANCEL`
- hidden AI interaction 可 skip 时，交给 `resolveForceSkippableHiddenAiInteraction()`
- 自动上报必须带 `empty-options / all-options-disabled / min-selection-unreachable`

### B. Hidden interaction 卡住

**表现：**

- sharedState 看不到 `interaction.current`
- 但玩家/AI 无法推进，且 `isBlocked=true`

**根因常见点：**

- 交互只在 owner 的 `playerView` 可见
- 服务端只看 sharedState，没构建 AI seat view

**避免方式：**

- 诊断卡死时同时看：
  - sharedState
  - `applyPlayerView(match, playerId)` 结果
- watchdog 必须把各 AI seat 的 view 传给 `resolveForceEndTurnForStalledAi()`

**guard：**

- 可跳过时强制 `SYS_INTERACTION_RESPOND`
- 不可跳过但 owner 是 AI 时才考虑阶段推进或取消

### C. Response-window 重触发 / 音效循环

**表现：**

- 点跳过后立刻又触发响应
- `RESPONSE_WINDOW_OPENED` 音效不断响
- UI 看起来像 AI 一直在点

**根因常见点：**

- 事件源重复 reopen
- 同批事件既推进 responder，又马上重新创建 interaction/window
- AI 在已确认阶段后还继续产出“可打扰真人”的动作
- responderQueue / currentResponderIndex / pendingInteractionId 不一致

**避免方式：**

- 审计事件源：谁在 reopen，而不是先怪音频
- AI 在不该继续动作的状态下直接停止产出动作
- 需要时在游戏层按 `sourceId / interactionId / 已确认标记` 做一次性 guard

**guard：**

- 当前轮到 human 且 responder 也是 human 时，watchdog 不出手
- 当前轮到 AI 且 human responder 把 AI 阶段卡住时，watchdog 应改走 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`，不是傻发 `ADVANCE_PHASE`
- 仅当当前 responder 是 AI，才允许 watchdog 执行 `RESPONSE_PASS`

### D. 重复动作循环（弃牌↔撤回、卖↔撤回、确认↔重开）

**表现：**

- action log 反复出现两种动作交替
- 阶段不前进，但命令持续发生

**根因常见点：**

- AI 评分函数把 undo / cancel 当成收益动作
- legal actions 中同时存在“做”和“撤回做”，且没有循环惩罚
- 游戏规则允许 reopen，但 AI 没有“一次尝试后放弃” guard

**避免方式：**

- 同一 `interactionId / sourceId` 上，AI 不要无限重试同一失败动作
- 对 undo/cancel/撤回类动作加强惩罚
- 对已确认态补“禁止再做前一阶段动作”的 guard

**guard：**

- `onlineAiRecovery.ts` 的 loop 检测只当最终兜底
- 更推荐在 `ai.ts` 本地先断掉循环

### E. 真人被误影响

**表现：**

- 弹“强制结束失败/自动跳过失败”提示
- 玩家正在响应，AI watchdog 却尝试推进

**根因常见点：**

- 把 human responder 误判成 AI 卡死
- 直接看 sharedState，没看 responder owner

**避免方式：**

- 所有 watchdog 操作先判断 seat controller
- 所有 response-window 兜底都要同时判断：
  - `currentPlayerId`
  - `currentResponderId`
  - `seatControllers`
  - 当前卡死的是“AI 自己”还是“human 正常操作”

**红线：**

- 任何“帮真人 pass / choose”的兜底都是错的，除非用户明确要求新的产品语义
- **仅在“AI 当前阶段被 human 响应窗口卡住”时，自动 close response-window 才是允许的**

---

## 标准工作流

### Step 0：圈定范围

先确认这次动的是哪一层：

- 游戏 AI 决策：`src/games/<gameId>/ai.ts`
- 游戏事件源：`src/games/<gameId>/domain/**`
- 引擎系统：`src/engine/systems/InteractionSystem.ts` / `ResponseWindowSystem.ts`
- 在线 watchdog：`src/engine/transport/server.ts` / `onlineAiRecovery.ts`

### Step 1：先画出闭环

必须写清：

1. 交互/窗口是**谁创建的**
2. AI 的 legal actions 从**哪里来**
3. 哪个命令会**真正 resolve / close / advance**
4. 无解时谁兜底：游戏层？AI 层？watchdog？

没有这四条，先别改代码。

### Step 2：做“可解性审计”

对每个交互类型都问四个问题：

1. AI 能不能构造至少一个合法命令？
2. 如果不能，是否存在 cancel / pass / skip？
3. 若 sharedState 不可见，seat playerView 能否看见？
4. 这条兜底会不会误伤 human？

### Step 3：按层修

优先顺序：

1. **游戏层事件源**：别创建无解交互
2. **AI 决策层**：别产出非法/循环动作
3. **系统层**：保证 responder / interaction 锁正确推进
4. **watchdog**：只处理剩余异常

### Step 4：验证

至少要有：

- 1 条本层单测
- 1 条与之相邻链路的协作测试
- 1 份 evidence 更新

---

## 测试放哪（不要新建无关文件）

### 引擎/共享 watchdog

优先放：

- `src/engine/transport/__tests__/server.test.ts`

适合测：

- human 当前回合时 watchdog 不得误触发
- AI 当前阶段 + human responder 时，watchdog 应先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE` 再收口
- hidden interaction 需要 seat view 才能识别
- 自动反馈是否携带 unsatisfiable reason / options 摘要
- response loop 是否只对 AI seat 强制 `RESPONSE_PASS`

### DiceThrone

优先放：

- `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
- `src/games/dicethrone/__tests__/flow.test.ts`
- `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`
- `src/games/dicethrone/__tests__/token-response-window.test.ts`

适合测：

- 已确认骰面后不再生成重掷动作
- token/status 交互无解时 AI 能 cancel/pass
- response-window 与 interaction lock 的协作

### Smash Up

优先放：

- `src/games/smashup/__tests__/promptSystem.test.ts`
- `src/games/smashup/__tests__/beforeScoring-window-stuck.test.ts`
- `src/games/smashup/__tests__/duplicateInteractionRespond.test.ts`
- `src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts`

适合测：

- prompt/choice 无解时是否可收口
- afterScoring 多段交互是否会重复 reopen
- AI 是否可能在同一 interaction/source 上无限重试

### Summoner Wars

优先放：

- `src/games/summonerwars/__tests__/basic-commands-coverage.test.ts`
- `src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts`
- `src/games/summonerwars/__tests__/flow.test.ts`

适合测：

- AI 是否能走完整 interaction chain
- response / phase / ability 连续触发是否会 reopen
- 无解时是否能 pass / cancel / advance

---

## Evidence 怎么写（强制）

### 必须写清三件事

1. **卡死现象是什么**
   - 例如：跳过后立刻 reopen、弃牌与撤回交替、AI 当前阶段卡在 human 响应窗口、human 响应时误弹强制失败
2. **根因落在哪一层**
   - 游戏事件源 / AI 决策 / ResponseWindow / watchdog / playerView
3. **为什么这次修复不会误伤真人**
   - 明确写：只对 AI seat 生效的门禁是什么

### 文档落点

- 更新已有审计文档优先
- 没有现成文档时，再写：
  - `evidence/engine/...`
  - `evidence/<gameId>/...`

### 文档中必须出现的关键词

- `interactionId / sourceId`
- `currentResponderId / responderQueue`（若涉及 response-window）
- `playerView / isBlocked`（若涉及 hidden interaction）
- `legalActions / unsatisfiable reason`
- `AI seat only / human guard`

---

## 不要这么做

- 只在 UI 上隐藏弹窗，不修根因
- 只在 watchdog 里狂加强推，不修 legal actions
- 把 human 当前响应误当成 AI 卡死
- 为了“先不死”直接强关所有 response-window
- 新建一堆零散测试文件；应补到最相关的现有 `__tests__`
- evidence 只写“已修复”；必须写链路和门禁

---

## 收口前自检

- [ ] 每个新增/修改的 AI 交互都有合法解或显式 skip/cancel/pass
- [ ] sharedState 不可见时，已验证 seat `playerView`
- [ ] 已区分“human 自己回合”与“AI 当前阶段 + human 响应窗口”两种场景
- [ ] AI 当前阶段 + human 响应窗口时，watchdog 走的是 `FORCE_CLOSE + follow-up`，不是无效 `ADVANCE_PHASE`
- [ ] 重复动作循环在 AI 层已尽量阻断，watchdog 只作兜底
- [ ] 单测已放入最相关现有文件
- [ ] `npx eslint <改动文件>` 已通过
- [ ] evidence 已写明“只对 AI seat 生效，不影响真人”

---

## Resources

- `references/checklist.md`
- `references/vitest-templates.md`
