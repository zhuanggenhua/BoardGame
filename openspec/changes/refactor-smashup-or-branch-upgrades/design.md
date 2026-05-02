## Context

- Smash Up 已存在 `simple-choice`、`continuationContext`、链式 interaction resume 等交互原语，能够承载“先选分支，再进入子目标选择”的链路。
- Fairies 的 `Spirit of the Forest` 规则要求：当玩家使用写有 `OR` 的能力时，可以改为使用两边效果，且顺序由玩家决定。
- 这类规则在真实 UX 上并不等价于“一次性把两个分支都编号选完”：
  - 有些分支本身还会继续开目标选择（例如 Titania 的“回手哪个随从”）
  - 玩家需要先看到第一边已经执行，再决定要不要继续剩余分支
  - `Spirit of the Forest` 只应在玩家真的拿第二边时才消费
- 当前项目里这类能力主要通过单卡 handler 链式手写实现，缺少统一的分支能力抽象和统一的 follow-up 恢复点。

## Goals / Non-Goals

- Goals:
  - 用统一 builder 显式表达“这是一条 OR 分支能力”
  - 让 Titan/持续效果能通过统一入口升级分支能力，而不是卡牌内散落 `if (spirit)`
  - 让“both in any order”落成 **先执行第一边，再补一次剩余分支选择** 的串行语义
  - 让分支选择、分支内部目标选择、升级消费时机都收敛到统一契约
- Non-Goals:
  - 不新增 engine-level interaction kind
  - 不尝试从任意普通按钮 prompt 自动推断规则级 `OR` 语义
  - 不把 Smash Up OR 语义实现成“一次性 ordered multi 编号多选”
  - 不在第一轮迁移全部 Smash Up 派系

## Decisions

- Decision: OR 能力用专用 builder 显式建模，而不是运行时猜测普通 prompt 是否代表规则文本中的 OR。
  - Why: 规则级 OR 与实现细节按钮列表不是一回事；纯推断容易误判。

- Decision: 继续复用 `simple-choice` 作为交互载体，而不是新增 engine-level interaction kind。
  - Why: 现有 `simple-choice` + `continuationContext` + queue/resume 已足够表达串行 OR 链路，改造面更小。

- Decision: `Spirit of the Forest` 的 optional-both 语义采用“串行补选”，不是一次性 ordered multi。
  - Why: 真实体验要求“先选并执行第一边，再决定要不要剩余边”；Titania 这类带子目标的能力更必须拆开。

- Decision: upgrade provider 只介入 branching builder 产物，不碰普通 simple-choice。
  - Why: 这样可以让“自动识别”建立在统一 DSL 上，而不是靠脆弱的运行时推断。

- Decision: 升级消费只在玩家真的执行第二个剩余分支时发生。
  - Why: 升级可用 ≠ 升级已消耗；如果 follow-up 选择 `跳过`，规则语义仍然是只执行了一边。

## Architecture

### 1. Smash Up 域层新增 branching choice 抽象

- 新增统一 helper，用于声明：
  - `sourceId`
  - `branches`
  - `upgradeKey` / `upgradeProvider`
  - `allowBoth`
- builder 负责生成**首个 branch 选择 prompt**，并把 branch plan 写入 `continuationContext`。

### 2. Branch plan 作为链式执行状态

- 玩家第一次选择分支后，不是立即把两边都选完，而是生成可恢复的 pending plan：
  - `planContext`
  - `remainingOptions`
  - `upgrade`
- branch executor 先执行当前分支。
- 如果当前分支又打开了子交互（例如 Titania 回手目标、Playful Tricks 选行动卡），pending plan 会挂到后续交互上，等子交互收口后再恢复。
- 如果当前分支执行完且仍有剩余分支可选，则统一弹出 **“剩余分支 + 跳过”** follow-up prompt。

### 3. Follow-up prompt 负责“剩余分支 + 跳过”

- follow-up prompt 只显示还没执行过的分支，加一个统一 `跳过` 选项。
- 如果玩家选 `跳过`，branch plan 直接收口，不消费升级。
- 如果玩家选剩余分支，系统先追加升级消费事件，再执行该分支。

### 4. 分支选择与子目标选择严格分层

- 第一层 prompt 只负责“你这次要做哪边”。
- 第二层及后续 prompt 由分支自身决定，例如：
  - Titania 选了 `return_minion` 后，才打开“选哪个随从回手”
  - 这时 UI 不应再把“额外打出一个随从”与具体目标卡放在同一个 prompt 里
- 分支子交互结束后，统一回到 branch plan 恢复 helper。

### 5. Fairies Enchantment 走同语义的专用 continuation

- `Enchantment` 的最终结果不是“执行两个独立事件”，而是落成一个 `fairiesEnchantmentMode = plus | minus | both`。
- 因此它不直接复用“branch executor 立即执行事件”的默认分支逻辑，而是保留专用 continuation：
  - 第一次只给 `plus / minus`
  - 若升级可用，再给一次“剩余分支 + 跳过”
  - 两次都选完才写成 `both`

## Migration Plan

1. 先落地 Smash Up 域层 branching builder / pending plan / resume helper。
2. 先迁移 Fairies 中最典型的 OR 能力作为首批验证对象。
3. 用新增抽象替换 `Spirit of the Forest` 的散落特判。
4. 用 Titania 和 Fairy Ring 两条真实链路验证“先执行、再补选、可跳过”的最终 UX。

## Risks / Trade-offs

- Risk: 分支执行后若进入子交互，pending plan 容易在队列里丢失。
  - Mitigation: 把 pending plan 挂到当前/下一条 interaction 的 continuationContext，由 resume helper 统一恢复。

- Risk: 某些能力的最终效果不是“两个分支各自立即执行一次事件”。
  - Mitigation: 允许像 `Enchantment` 一样走专用 continuation，但仍遵守相同的串行补选语义。

- Risk: 玩家可能误以为“能补第二边”就代表已经消费升级。
  - Mitigation: 只在 follow-up 真选剩余分支时追加升级消费事件，跳过则不消费。
