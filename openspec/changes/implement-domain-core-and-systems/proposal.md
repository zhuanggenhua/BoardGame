# Proposal: 引入领域内核与系统层（激进引擎化）

## 背景
当前项目已经具备多游戏运行基础，并且平台能力在快速增长：

- 游戏发现与单一权威清单：`scripts/generate_game_manifests.js` 扫描 `src/games/<id>/manifest.ts`，生成 `src/games/manifest.*.generated.*`，同时生成 i18n namespaces。
- 服务端注册与大厅推送：`server.ts` 从 `GAME_SERVER_MANIFEST` 注册游戏，并维护 lobby socket 的缓存与推送。
- 跨游戏能力已经出现共享代码雏形：
  - 撤销：已迁移到 `src/engine/systems/UndoSystem.ts`（自动快照）。
  - 技能/效果：`src/systems/AbilitySystem` 已被 `src/games/dicethrone/game.ts` 使用。

随着计划覆盖更多类型桌游（骰子对战、卡牌驱动、德式计分、隐藏信息/推理），平台能力将继续扩张（撤销、教程、回放/审计、统一 prompt/choice、成就、统计、AI 等）。如果这些能力继续散落在每个 `game.ts` 里，会导致维护成本急剧上升。

## 问题
目前 Boardgame.io 被用作“主要规则运行时”，游戏规则通常直接写在 moves/turn/stage 内，并直接修改 `G`。

平台能力的实现方式存在两个问题：

- 依赖游戏自觉遵守约定（旧的 `UndoManager.saveSnapshot(G)` 模式已被 `UndoSystem` 自动快照替代）。
- 产生游戏特有结构（例如各自维护 `pendingChoice`、`availableAbilityIds` 等），导致同一平台能力出现 N 份实现且行为不一致。

这会使得以下目标越来越难：

- 跨游戏一致的撤销语义、choice/prompt 交互、日志与审计。
- 跨游戏可复用的确定性回放。
- 对隐藏信息游戏的安全处理（player view / redaction）。
- 新平台能力的低成本落地（一次实现，多游戏收益）。

## 目标
采用激进的引擎化架构：

- 引入自研“领域内核（Domain Core）”：command -> events -> reduce 的确定性规则模型。
- 引入“系统层（Systems）”：以插件方式承载撤销、prompt/choice、日志、能力/效果等跨游戏能力。
- 保留 Boardgame.io 作为“网络/会话驱动器”，但将其降级为适配层：Boardgame.io moves 只做输入翻译与管线调用，不承载规则本体。
- 为现有游戏（tictactoe、dicethrone）提供分阶段迁移路径，不阻塞新增游戏。

## 非目标
- 不替换现有 manifest/registry 机制（继续使用 `generate_game_manifests.js` 作为权威清单来源）。
- 不构建万能规则 DSL。
- 不要求一次性迁移全部游戏；改造会分阶段推进。

## UGC 可选能力（Phase 2）

> UGC 作为可选扩展，不阻塞核心引擎化。以下能力在核心引擎完成后接入。

### UGC 沙箱执行
- UGC 规则代码**只在服务端执行**
- 沙箱隔离：禁用 `require/fs/net/child_process/process.env`
- 资源限制：内存上限、执行超时、CPU 配额
- UGC 模块只暴露 Domain Core 契约

### UGC 通用 UI
- 第一阶段**不开放自定义 React 组件**
- 提供平台通用 UI 组件（卡牌区、骰子区、计分轨、Prompt 面板、目标选择器）
- UGC 游戏通过数据驱动通用 UI

### UGC 资产绘制
- 用户可**直接绘制**卡牌/Token 等素材（无需上传图片）
- 提供 Canvas 绘制编辑器（卡牌框模板 + 文字/图形工具）
- 绘制结果导出为 SVG/PNG，存储为资产 hash
- 裁切参数数据化：`{ crop: { x, y, scale }, assetId }`

### Effect DSL
- 卡牌/技能效果走**数据驱动**而非代码
- 提供 Effect Schema + 校验
- AI 生成配置数据（JSON）而非代码
- 效果执行由 `EffectSystem` 解释

## 方案概览

### 1) 统一 Match 状态形状：`G.sys` + `G.core`
所有游戏统一将 `G` 拆成两部分：

- `G.sys`：平台系统状态（matchId、schemaVersion、undo 历史、event log、prompt 队列、rng seed、debug flags 等）。
- `G.core`：游戏领域状态（棋盘、手牌、资源、角色状态等）。

这样可以消除类似 `__matchID` 注入到随机字段的做法，并为通用系统提供稳定落点。

### 2) 领域内核（Domain Core）契约
定义与运行时无关的规则接口：

- Command：玩家意图（纯数据）
- Event：权威后果（纯数据）
- reduce(state, event) -> newState（确定性）
- validate(state, command, actor) -> ok|error

游戏提供一个 Domain Core 模块（纯 TS），不依赖 Boardgame.io 的 ctx/events/random。

### 3) 系统层（Systems）
系统通过 hook 参与 command/event 管线：

- `beforeCommand` / `afterEvents`
- `playerView` / redaction（隐藏信息）
- 可选 `uiHints` 用于驱动统一 prompt 渲染

第一批系统（结合现有代码与近期需求）：

- UndoSystem：自动快照与多人撤销握手（不需要游戏手动 saveSnapshot）。
- PromptSystem：统一 prompt/choice 协议（替换游戏自定义 `pendingChoice`）。
- LogSystem：统一事件日志格式（回放/审计/调试）。
- Ability/Effect System：将 `AbilitySystem` 演进为可选系统，服务骰子/卡牌类游戏。

### 4) Boardgame.io 适配层
为每个游戏提供一个 Boardgame.io Game 定义，但规则主体由 Domain Core + Systems 承担：

- 将 move 调用翻译为 Domain Command
- 运行管线：Systems.beforeCommand -> Core.validate -> Core.produceEvents -> reduce -> Systems.afterEvents
- 将结果写回 `G.core`/`G.sys`

### 5) 迁移策略（分阶段产出）
- 阶段 1：引入 Domain Core 骨架、`G.sys` 形状、通用适配器。
- 阶段 2：迁移 TicTacToe，验证撤销“自动化”有效。
- 阶段 3：引入 PromptSystem，迁移 Dicethrone 的 choice 结构。
- 阶段 4：扩展归档/回放：基于统一 log 完成重放与审计。

## 风险与缓解
- 风险：短期复杂度上升（两层运行时）。
  - 缓解：明确规则：moves 只做适配；Domain Core 才能改规则。
- 风险：迁移成本。
  - 缓解：提供 adapter 工具与逐游戏迁移；先迁移小游戏验证。
- 风险：隐藏信息泄露。
  - 缓解：将 playerView/redaction 作为系统契约的一部分，并在适配层强制执行。

## 成功指标
- 新增游戏只需新增 `src/games/<id>/` 目录（manifest + domain core + Board UI），无需在平台层改多处。
- 撤销、prompt、日志等平台能力可以按游戏开关启用，不需要每个游戏重写。
- 可以通过回放存储的 Commands/Events（或 Events）得到一致的最终状态。
