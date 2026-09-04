---
name: game-ai-adaptation
description: "BoardGame 游戏 AI 接入入口。用于 AI/机器人/自动玩家、ai.ts、自动响应、watchdog、强制跳过、卡死兜底和响应窗口门禁。"
---

# Game AI Adaptation

本 skill 只管 AI 合法动作、交互闭环、卡死和兜底；AI 打法强弱、评分器、角色画像和策略重构走 [`game-ai-strategy-design`](../game-ai-strategy-design/SKILL.md)。

## 触发

出现以下任一情况必须使用：

- 修改 `src/games/<gameId>/ai.ts`。
- 新增或修改自动响应、自动跳过、强制结束、watchdog。
- 修 “AI 卡死 / 无法选择 / 重复交互 / 跳过后重触发 / 响应音效循环”。
- 新游戏接 AI，需要审查交互闭环与兜底。
- 玩家真实交互合同改变，例如确认入口、对象选择路径、阻塞层生命周期、弹窗承载物或收口按钮迁移。

## 必读

- [`engine-systems`](../../knowledge/standards/engine-systems.md)。
- [`testing-audit`](../../knowledge/standards/testing-audit.md)。
- `references/checklist.md`。
- `references/response-window-watchdog.md`。
- `references/vitest-templates.md`。

历史 evidence 只能作同类参考；不能代替本轮真实链路审计。

## 本仓库 AI 执行链

### Interaction 链

- 游戏层通常在 `domain/execute.ts` 或 `domain/systems.ts` 创建交互。
- 引擎层 `InteractionSystem` 承接 `sys.interaction.current / queue`、choice 创建、resolve 和 `playerView()`。
- `createSimpleChoice()` 拿到空 options 是卡死前兆，不是可接受状态。
- 非 owner 在 `playerView()` 中可能只看到 `isBlocked=true`；sharedState 看不到 current 不等于没有交互。

### Response-window 链

- `ResponseWindowSystem` 负责打开 / 关闭响应窗口、`RESPONSE_PASS`、强制关闭、允许命令和 responder 门禁。
- 响应窗口能否闭合，取决于是否有合法响应、无响应 pass、不会因 stale queue / reopen 再卡住。
- 必须区分：
  - human 自己回合且 human 在响应：watchdog 不得出手。
  - AI 当前阶段被 human 响应窗口卡住：watchdog 可先强制关闭窗口，再继续 AI 阶段收口。
  - AI 自己是 responder：AI 可发合法响应或 `RESPONSE_PASS`。

### 在线 AI 兜底链

- 服务端 watchdog 在 `src/engine/transport/server.ts`。
- AI 恢复逻辑在 `src/engine/transport/onlineAiRecovery.ts`。
- watchdog 是 AI seat 专属兜底，不是全局强推。
- hidden interaction 必须用 `applyPlayerView(match, playerId)` 生成 seat view 后诊断。

## 核心合同

### 1. AI 只能选合法动作

- AI legal actions 必须和 `validate()` / `execute()` 同源一致。
- `disabled=true`、已失效目标、不可移除状态、已确认阶段的旧动作不得进入 AI 动作。
- legal actions 为空时，必须走 cancel / pass / skip / advance 之一；不能继续等。
- 真人在同一规则状态下能选择的并列合法动作，AI legal actions 也要枚举；策略不想选时在评分层降权，不在合法动作层删掉。

### 2. 每个交互必须可收口

每个 AI 相关 interaction / response-window 至少有一个正式收口路径：

- `SYS_INTERACTION_RESPOND`
- `SYS_INTERACTION_CANCEL`
- `RESPONSE_PASS`
- `ADVANCE_PHASE`
- 游戏特化阶段推进命令

没有收口命令是设计缺陷，不是“之后靠 AI 补”。

### 3. UI 交互合同变更要同步审 AI

只要玩家真实操作入口的语义变化，就要把 AI 当成另一个执行者重过闭环：

- AI 是否仍能枚举同一合法命令。
- 命令是否通过 `validate()`。
- 执行后是否关闭 interaction / response-window / roll context。
- 无可选项时是否有 cancel / pass / skip。
- 兜底是否只作用于 AI seat，不会替真人确认。

纯颜色、尺寸、阴影、动效或原位样式变化，不需要因为 AI 重新审。

### 4. 先修可解性，再修 watchdog

优先级固定：

1. 游戏事件源不创建无解交互。
2. AI 决策不产出非法或循环动作。
3. Interaction / ResponseWindow 系统能自然收口。
4. watchdog 只处理剩余异常循环。

不得用“加强推”掩盖无解交互、非法 legal actions 或重复 reopen。

### 5. AI 动作延迟只覆盖可见动作

- `minimumActionDelayMs` 只决定时长，不决定哪些动作延迟。
- 可见动作是玩家肉眼会理解为“AI 正在操作 / 轮到我继续 / 流程还活着”的动作，例如摸牌、公开区变化、移动、目标高亮、确认提交、等待归属切换。
- 静默动作是后台收口、hidden interaction skip / cancel、无响应 pass、纯阶段推进、watchdog 内部诊断。
- 用户反馈“AI 瞬间 / 太快 / 1 秒无效”时，先跑真实页面行动权时间线；不得用静态分类直接否定。
- 改延迟门控时必须同步 `src/engine/transport/react.tsx` 与 `e2e/src/engine/transport/react.tsx`，并用 `[LOCAL_AI_PERF]` 或在线 AI trace 证明静默动作不累计 gate、可见动作保留节奏。

## 常见卡死归类

- **空交互 / 无可选项**：空 options、`min` 不可达、目标失效或 optionsGenerator 未刷新；先在创建前判空并提供 skip / done / cancel。
- **Hidden interaction**：sharedState 看不到 current 但 `isBlocked=true`；必须检查 AI seat 的 `playerView()`。
- **Response-window 重触发**：pass 后 reopen、音效循环或 pendingInteractionId 不一致；先查事件源，不先怪音频。
- **重复动作循环**：undo / cancel / 撤回类动作被 AI 当收益动作；先在 `ai.ts` 阻断同一 source / interaction 的无限重试。
- **真人被误影响**：watchdog 替 human pass / choose / close；除 AI 当前阶段被 human 响应窗口卡住的场景外，一律禁止。

## 工作流

1. **圈定层级**：游戏 AI、游戏事件源、引擎系统、在线 watchdog。
2. **画闭环**：谁创建交互、AI legal actions 从哪里来、哪个命令真正 close / resolve / advance、无解时谁兜底。
3. **可解性审计**：AI 是否能构造合法命令；不能时是否有 cancel / pass / skip；hidden 时 seat view 是否可见；兜底是否误伤 human。
4. **按层修**：事件源 -> AI 决策 -> 系统锁 -> watchdog。
5. **验证**：至少一条本层测试、一条相邻链路协作测试和一份 evidence 更新；若风险在页面消费、隐藏交互、在线 AI 或玩家视角，补代表性 E2E。

## 测试落点

- 引擎 / watchdog 按行为合同补到 `src/engine/transport/__tests__/onlineAiWatchdog*.test.ts`、`src/engine/transport/__tests__/onlineAiImmediateServerAi.test.ts`、`src/engine/transport/__tests__/onlineAiUnsatisfiableInteractionRecovery.test.ts`、`src/engine/transport/__tests__/server-lifecycle-sync.test.ts` 或最近相关测试；禁止回到旧集中测试文件追加。
- 游戏层 AI 优先补 `src/games/<gameId>/__tests__/basic-commands-coverage.test.ts`、`flow.test.ts` 或同名 prompt / response / interaction 测试。
- 不新建无关散测试文件；先补最相关现有测试。

测试至少覆盖当前风险之一：

- human 当前回合时 watchdog 不误触发。
- AI 当前阶段 + human responder 时走强制关闭窗口 + follow-up。
- hidden interaction 需要 seat view 才能识别。
- 无解交互能 cancel / pass / skip。
- 重复动作循环被 AI guard 或 watchdog 打断。

## Evidence

AI evidence 必须写清：

- 现实卡死现象。
- 根因层级：游戏事件源、AI 决策、InteractionSystem、ResponseWindow、playerView 或 watchdog。
- 只对 AI seat 生效的门禁，以及为什么不影响真人。
- 涉及 response-window 时写 `currentResponderId / responderQueue`。
- 涉及 hidden interaction 时写 `playerView / isBlocked`。
- 涉及合法动作时写 `legalActions / unsatisfiable reason`。

优先更新已有审计文档；没有现成文档时再写 `evidence/engine/...` 或 `evidence/<gameId>/...`。

## 禁止

- 只在 UI 隐藏弹窗，不修交互根因。
- 只在 watchdog 加强推，不修 legal actions。
- 把 human 当前响应误当 AI 卡死。
- 为止血强关所有 response-window。
- 用真人 E2E 能点替代 AI legal actions / 自动玩家闭环验证。
- evidence 只写“已修复”，不写链路和 AI-only guard。

## 收口自检

- 每个新增 / 修改 AI 交互都有合法解或显式 skip / cancel / pass。
- hidden 风险已验证 seat `playerView()`。
- 已区分 human 自己回合与 AI 当前阶段 + human 响应窗口。
- 重复动作循环优先在 AI 层阻断，watchdog 只兜底。
- 测试放入最相关现有文件。
- `npx eslint <改动文件>` 或对应项目门禁已通过。
- evidence 已写明只对 AI seat 生效，不影响真人。

## Resources

- `references/checklist.md`
- `references/response-window-watchdog.md`
- `references/vitest-templates.md`
