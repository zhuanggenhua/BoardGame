# 架构设计文档

> 本文档描述 BordGame 桌游平台的整体架构设计，面向项目讲解与技术交接。
> 最后更新：2026-02-12

---

## 1. 项目概览

BordGame 是一个现代化桌游平台，核心解决"桌游教学"与"轻量级联机"两大场景。

**核心能力**：
- 多游戏支持：井字棋（TicTacToe）、骰子王座（DiceThrone）、召唤师战争（SummonerWars）、大杀四方（SmashUp）
- 两种对局模式：联机对战 / 教学引导
- 插件化系统：撤销 / 交互选择 / 响应窗口 / 回合管理 / 事件推送 / 教学 / 重赛 / 操作日志 / 选角 / 作弊调试
- 分步教学系统（步骤门控 + AI 自动行动 + 确定性随机）
- 事件溯源引擎（Command/Event 分离 + 管线 + 确定性回放）

**技术栈**：React 19 + TypeScript / Vite 7 / Tailwind CSS 4 / framer-motion / Canvas 2D 粒子引擎 / WebGL Shader / i18next / howler / socket.io / Node.js (Koa + NestJS) / MongoDB / Vitest + Playwright

---

## 2. 架构风格

项目采用 **事件溯源 + 管线 + 插件系统 + 分层架构** 的复合风格：

| 模式 | 体现 |
|------|------|
| **Command/Event Sourcing** | 玩家操作 → Command → validate → execute → Event[] → reduce → 新状态；所有状态变更通过事件驱动，可追溯、可回放、可撤销 |
| **Pipeline（管线）** | `executePipeline()` 8 步流水线处理每条命令，类似中间件管线 |
| **Plugin System（插件）** | 11 个系统通过 `beforeCommand` / `afterEvents` 钩子参与管线，按需组合 |
| **Layered Architecture** | 5 层严格分层，依赖方向单向 |
| **Registry Pattern** | 原语层（条件/效果/目标/能力）均使用注册器，游戏注册处理器，引擎负责调度 |
| **DomainCore 契约** | 每个游戏实现 4 个纯函数（setup/validate/execute/reduce）接入引擎 |

> 不是传统 MVC/MVVM，也不是纯 ECS。最接近的参考：Redux reducer 模式 + 游戏引擎系统插件化 + 自研传输层。

---

## 3. 宏观分层架构

```
┌──────────────────────────────────────────────────────────┐
│                    游戏层 (games/)                         │
│  每游戏独立目录：domain/ + Board.tsx + game.ts             │
│  实现 DomainCore 4 函数 + 选用原子能力 + 注册系统           │
├──────────────────────────────────────────────────────────┤
│                    引擎层 (engine/)                        │
│  pipeline · systems/ · primitives/ · fx/ · testing/       │
│  游戏无关的运行时：管线调度 + 系统插件 + 原子工具 + 特效     │
├──────────────────────────────────────────────────────────┤
│                  框架核心 (core/)                          │
│  类型契约 · 资源管理 · 游戏注册 · adapter（引擎适配器）      │
├──────────────────────────────────────────────────────────┤
│                    UI 层 (React)                           │
│  pages/ · components/game/framework/ · contexts/ · hooks/ │
│  骨架组件 · 全局状态 · 游戏↔UI 接口契约 · 特效渲染          │
├──────────────────────────────────────────────────────────┤
│                    服务端                                  │
│  server.ts (GameTransportServer + socket.io + Koa)        │
│  apps/api/ (NestJS REST API)                              │
│  MongoDB · Cloudflare R2 CDN                              │
└──────────────────────────────────────────────────────────┘
```

**依赖方向**（严格单向，禁止反向 import）：

```
游戏层 ──→ 引擎层 ──→ 框架核心
  │                      │
  └──→ UI 层（Board.tsx） │
         │               │
         └───→ 服务端 ←──┘
```

- 游戏层消费引擎层（使用管线、系统、原语）
- 游戏层提供 Board.tsx 给 UI 层渲染
- UI 层消费框架核心（类型契约、资源管理）
- 框架核心通过 adapter 连接自研传输层服务端（GameTransportServer）
- 引擎层不依赖 UI 层，不依赖服务端

---

## 4. 引擎层

位于 `src/engine/`。设计目标：**游戏无关、确定性、可序列化、支持撤销/回放/审计**。

### 4.1 统一状态形状 MatchState

```typescript
interface MatchState<TCore> {
    sys: SystemState;   // 系统状态（跨游戏通用）
    core: TCore;        // 游戏领域状态（由各游戏定义）
}
```

`SystemState` 包含：`undo`（快照栈+握手）、`interaction`（阻塞式交互队列，替代旧 PromptSystem）、`log`（审计日志）、`eventStream`（实时事件通道）、`actionLog`（玩家可见操作日志）、`rematch`（重赛投票）、`responseWindow`（多玩家响应队列）、`tutorial`（教程步骤+AI行动+随机策略）、`phase`（当前阶段，单一权威）、`turnNumber`、`gameover`（游戏结束结果，由管线自动检测写入）。

### 4.2 Command/Event 模型

```
Command（玩家意图）→ validate → execute → Event[]（权威后果）→ reduce → 新状态
```

- **Command**：`{ type, playerId, payload, timestamp?, skipValidation? }`
- **GameEvent**：`{ type, payload, sourceCommandType?, timestamp, audioKey?, audioCategory? }`
- **reduce**：确定性纯函数，仅作用于 core

保证：可追溯（事件记录）、可撤销（快照回滚）、可回放（命令序列重放）、可替代（interceptEvent 拦截/替换/吞噬事件）。

### 4.3 执行管线 (Pipeline)

`executePipeline()` 定义在 `src/engine/pipeline.ts`，8 步流水线：

```
① 命令到达
② Systems.beforeCommand hooks（可 halt 拦截/消费命令）
   halt 时跳过 ③④⑤，直接进入 ⑥
③ Domain.validate（校验合法性）
④ Domain.execute → Event[] + Domain.postProcess（派生事件，类似万智牌 SBA）
⑤ Domain.interceptEvent → Domain.reduce（逐事件应用到 core）
⑥ Systems.afterEvents hooks（多轮迭代，最多 10 轮）
   每轮：系统产生新事件 → postProcessSystemEvents → reduce 进 core
⑦ 返回 PipelineResult { success, state, events }
```

关键设计：系统消费命令（halt）、多轮 afterEvents 迭代、`postProcessSystemEvents`（领域层对系统事件追加派生）、事件拦截（替代效果）。

### 4.4 适配器 (Adapter)

`createGameEngine()` 将 DomainCore + Systems 组装为 `GameEngineConfig`（供 `GameTransportServer` 使用），是**纪律执行点**。

职责：Domain + Systems 组装、系统配置注入、commandTypes 自动合并系统命令、playerView 分层过滤。

```typescript
export const DiceThrone = createGameEngine({
    domain: DiceThroneDomain,
    systems: [...createBaseSystems(config), createFlowSystem(flowHooks)],
    commandTypes: ['ROLL_DICE', 'USE_CARD', 'ATTACK', ...],
});
```

### 4.5 领域内核接口 (DomainCore)

```typescript
interface DomainCore<TState, TCommand, TEvent> {
    gameId: string;
    setup(playerIds, random): TState;
    validate(state, command): ValidationResult;           // 可读 sys.phase
    execute(state, command, random): TEvent[];            // 可读 sys.phase
    reduce(state, event): TState;                         // 纯函数，仅作用于 core
    postProcess?(state, events): TEvent[];                // 派生事件（SBA）
    postProcessSystemEvents?(state, events, random): TEvent[];  // 系统事件后处理
    interceptEvent?(state, event): TEvent | TEvent[] | null;    // 替代效果
    playerView?(state, playerId): Partial<TState>;
    isGameOver?(state): GameOverResult | undefined;
}
```

领域层目录（`src/games/<gameId>/domain/`）：`types.ts`（类型）→ `ids.ts`（常量表）→ `commands.ts`（validate）→ `reducer.ts`（execute+reduce）→ `rules.ts`（阶段规则）→ `index.ts`（组装导出）

---

## 5. 系统层 (Systems)

系统以插件方式承载跨游戏能力，通过 hook 参与管线。位于 `src/engine/systems/`。

### 5.1 系统接口

```typescript
interface EngineSystem<TCore> {
    id: string;
    name: string;
    priority?: number;       // 越小越先执行，默认 100
    setup?(playerIds): Partial<SystemState>;
    beforeCommand?(ctx: PipelineContext): HookResult | void;
    afterEvents?(ctx: PipelineContext): HookResult | void;
    playerView?(state, playerId): Partial<SystemState>;
}
```

### 5.2 内置系统清单

| 系统 | ID | 优先级 | 钩子 | 职责 |
|------|------|--------|------|------|
| UndoSystem | `undo` | 10 | 前置 | 自动快照 + 多人握手撤销 |
| ResponseWindowSystem | `responseWindow` | 15 | 前置+后置 | 多玩家响应队列（防御/反击窗口） |
| InteractionSystem | `interaction` | — | 前置 | 阻塞式玩家选择（替代旧 PromptSystem），可扩展 kind |
| FlowSystem | `flow` | 25 | 前置+后置 | 阶段流程管理（ADVANCE_PHASE） |
| TutorialSystem | `tutorial` | — | 前置 | 教程步骤管理 + AI 行动 + 命令门控 |
| LogSystem | `log` | — | 后置 | 持久化全量命令/事件日志（审计） |
| EventStreamSystem | `eventStream` | — | 后置 | 实时事件消费通道（驱动 UI 特效/音效） |
| ActionLogSystem | `actionLog` | — | 后置 | 结构化操作日志（玩家可见，支持卡牌预览） |
| RematchSystem | `rematch` | — | 前置 | 重赛投票状态 |
| CheatSystem | `cheat` | — | 前置 | 开发模式作弊（资源/骰子/阶段） |
| CharacterSelectionSystem | — | — | 前置 | 角色选择流程（选角/准备/开始） |

### 5.3 默认系统集合

```typescript
function createBaseSystems<TCore>(config?): EngineSystem<TCore>[] {
    return [
        createLogSystem(),
        createActionLogSystem(config?.actionLog),
        createUndoSystem(config?.undo),
        createInteractionSystem(),
        createRematchSystem(),
        createResponseWindowSystem(),
        createTutorialSystem(),
        createEventStreamSystem(),
    ];
}
```

游戏可追加：FlowSystem、CheatSystem、CharacterSelectionSystem 等。

### 5.4 FlowSystem（阶段管理）

复杂游戏的核心系统，通过 `FlowHooks` 实现游戏特化：

```typescript
interface FlowHooks<TCore> {
    initialPhase: string;
    canAdvance?(args): CanAdvanceResult;
    getNextPhase(args): string;
    onPhaseExit?(args): GameEvent[] | PhaseExitResult | void;
    onPhaseEnter?(args): GameEvent[] | void;
    getActivePlayerId?(args): PlayerId;
    onAutoContinueCheck?(args): { autoContinue: boolean; playerId: string } | void;
}
```

设计原则：`sys.phase` 单一权威 → `ADVANCE_PHASE` 由 FlowSystem 消费 → 游戏层只通过 FlowHooks 定义规则 → 支持阶段覆盖/跳过/自动推进。

### 5.5 UndoSystem（撤销系统）

基于快照撤销（`beforeCommand` 存储完整状态）、白名单机制（`snapshotCommandAllowlist`）、多人握手（请求→批准/拒绝/取消）、撤销时清空 EventStream（防特效重播）。

**白名单拆分规范（强制）**：`ActionLogSystem` 和 `UndoSystem` 必须使用**独立的白名单**，不得共享同一个 `ACTION_ALLOWLIST`。

- `ACTION_ALLOWLIST`（操作日志用）：记录所有有意义的玩家操作，包括连锁操作（技能激活、弃牌、阶段推进等）。
- `UNDO_ALLOWLIST`（撤回快照用）：**只包含玩家主动决策点命令**，连锁/系统命令不产生独立快照。

**判断标准**：一个命令是否应进入 `UNDO_ALLOWLIST`，取决于它是否是玩家的独立决策——即玩家主动选择触发，而非由前一个命令的结果自动触发。

```
✅ 进入 UNDO_ALLOWLIST（玩家决策点）：
  - 打出随从/行动卡/事件卡（PLAY_MINION / PLAY_ACTION / PLAY_EVENT）
  - 移动/召唤/建造（MOVE_UNIT / SUMMON_UNIT / BUILD_STRUCTURE）
  - 宣告攻击（DECLARE_ATTACK）
  - 选择技能（SELECT_ABILITY）
  - 卖卡（SELL_CARD）

❌ 不进入 UNDO_ALLOWLIST（连锁/系统操作）：
  - 技能激活（ACTIVATE_ABILITY）——由攻击/阶段结束触发
  - 血契召唤步骤（BLOOD_SUMMON_STEP）——召唤的连锁子步骤
  - 殉葬火堆治疗（FUNERAL_PYRE_HEAL）——回合开始触发
  - 弃牌至上限（DISCARD_TO_LIMIT）——阶段推进的连锁操作
  - 阶段推进（ADVANCE_PHASE）——视游戏而定（见下）
```

**`ADVANCE_PHASE` 的特殊处理**：
- **DiceThrone**：玩家手动点击推进阶段（main1→offensiveRoll 等），是独立决策，**进入** `UNDO_ALLOWLIST`。
- **SmashUp**：触发整个回合结束链条（scoreBases→draw→endTurn→startTurn），撤回应回到最后一次出牌前，**不进入** `UNDO_ALLOWLIST`。
- **SummonerWars**：系统自动推进，**不进入** `UNDO_ALLOWLIST`。

**`_noSnapshot` 跳过快照（通用机制）**：当一个命令是前一个操作的"后续动作"（如移动后触发的技能），UI 层在 dispatch 时给 payload 加 `_noSnapshot: true`，UndoSystem 会跳过该命令的快照创建，使其与前一个命令共享同一个撤回点。撤回时两个操作作为一个原子单元一起回退。此机制适用于任何游戏，不依赖特定技能/命令类型。

### 5.6 ActionLogSystem 约束

- 只负责收集日志；文案由游戏层 `formatEntry` 提供
- 支持命令级 + 事件级多条日志，覆盖所有玩家可见状态变化
- 日志使用 i18n key；卡牌类日志用 `ActionLogSegment` card 片段供 hover 预览
- 事件级日志从事件 payload/棋盘解析实体信息，禁止依赖 UI 状态

---

## 6. 引擎原语层 (Primitives)

位于 `src/engine/primitives/`，提供跨游戏复用的纯函数工具库（15 个模块）。

**核心原则**：复用工具函数，不复用领域概念。提供框架让游戏注册自己的处理器，而非预定义效果类型。

| 模块 | 职责 |
|------|------|
| `ability.ts` | 能力框架（AbilityRegistry + ExecutorRegistry，注册/查找/检查/调度） |
| `actionRegistry.ts` | 统一的 actionId → handler 注册表 |
| `attribute.ts` | 属性系统（基础值 + 修饰器叠加） |
| `condition.ts` | 条件评估（布尔组合 + 比较 + 自定义处理器注册） |
| `dice.ts` | 骰子操作（创建/掷骰/统计/顺子判断） |
| `effects.ts` | 效果执行框架（游戏注册处理器，引擎只负责调度） |
| `expression.ts` | 表达式树求值（算术 + 变量 + 条件） |
| `grid.ts` | 棋盘格（坐标/距离/邻接） |
| `modifier.ts` | 修饰器系统（叠加/优先级/过期） |
| `resources.ts` | 资源管理（get/set/modify/canAfford/pay + 边界钳制） |
| `tags.ts` | 标签系统（分类/过滤/匹配） |
| `target.ts` | 目标解析框架（内置 self/opponent/all + 自定义解析器） |
| `uiHints.ts` | UI 提示生成（可操作性/高亮/禁用原因） |
| `visual.ts` | 视觉资源解析器（基于实体定义自动解析图片/动画） |
| `zones.ts` | 卡牌区域操作（hand/deck/discard 间的标准移动） |

**注册器模式**（以 condition 为例）：

```typescript
// 引擎层：提供框架
const registry = createConditionHandlerRegistry();
// 游戏层：注册自定义处理器
registerConditionHandler(registry, 'hasDiceSet', (params, ctx) => { /* 游戏特定逻辑 */ });
// 引擎层：评估（不关心具体语义）
evaluateCondition(node, ctx, registry);
```

---

## 7. 游戏层

每个游戏位于 `src/games/<gameId>/`，结构如下：

```
src/games/<gameId>/
├── domain/              # 领域层（纯逻辑，无 UI 依赖）
│   ├── types.ts         # 领域类型
│   ├── ids.ts           # 常量表
│   ├── commands.ts      # 命令校验
│   ├── reducer.ts       # 事件处理
│   ├── rules.ts         # 规则计算
│   └── index.ts         # DomainCore 导出
├── ui/                  # UI 子组件
├── __tests__/           # 领域测试
├── rule/                # 规则文档（Markdown）
├── Board.tsx            # 棋盘 UI 组件
├── game.ts              # 游戏定义（适配器组装）
├── manifest.ts          # 游戏清单元数据
├── tutorial.ts          # 教程配置
└── types.ts             # 对外类型重导出
```

### 7.1 游戏注册

采用**清单驱动**的注册机制：

1. `manifest.ts`：纯数据元信息（id、标题、分类、是否启用等）
2. `manifest.generated.ts` / `manifest.client.generated.tsx` / `manifest.server.generated.ts`：脚本生成的权威清单聚合
3. `registry.ts`：运行时从清单构建 `GameImplementation` 映射表
4. 服务端 / 客户端各有独立清单和类型（`manifest.server.ts` / `manifest.client.tsx`）

### 7.2 游戏复杂度梯度

| 游戏 | 复杂度 | 使用的系统 |
|------|--------|-----------|
| TicTacToe | 简单 | 默认 8 系统 |
| DiceThrone | 复杂 | 默认 + FlowSystem + CheatSystem + CharacterSelectionSystem |
| SummonerWars | 复杂 | 默认 + FlowSystem + CheatSystem + 能力注册表 |
| SmashUp | 复杂 | 默认 + FlowSystem + CheatSystem + 能力注册表 |

---

## 8. UI 层

### 8.1 Context 系统

全局状态通过 React Context 注入，位于 `src/contexts/`（11 个）：

| Context | 职责 |
|---------|------|
| `AuthContext` | JWT 登录态、用户信息 |
| `AudioContext` | 音频管理（BGM/SFX/音量） |
| `ModalStackContext` | 弹窗栈管理 |
| `ToastContext` | Toast 通知（去重 + TTL） |
| `SocialContext` | 好友/消息/在线状态 |
| `RematchContext` | 重赛投票（socket 层） |
| `UndoContext` | 撤销 UI 桥（`useSyncExternalStore`） |
| `TutorialContext` | 教程 UI 桥 |
| `GameModeContext` | 模式注入（local/online/tutorial） |
| `DebugContext` | 调试玩家视角切换 |
| `MatchRoomExitContext` | 对局退出确认 |

### 8.2 三层 UI 复用模型

```
/core/ui/                        → 类型契约层（接口定义）
/components/game/framework/      → 骨架组件层（跨游戏复用）
/games/<gameId>/                 → 游戏层（样式注入、配置覆盖）
```

骨架组件（`/components/game/framework/`）：

| 组件 | 职责 |
|------|------|
| `HandAreaSkeleton` | 手牌区（拖拽、选中、过滤） |
| `PlayerPanelSkeleton` | 玩家信息面板 |
| `ResourceTraySkeleton` | 资源栏 |
| `PhaseIndicatorSkeleton` | 阶段指示器 |
| `PhaseHudSkeleton` | 阶段 HUD |
| `SpotlightSkeleton` | 聚光灯高亮 |
| `ActionBarSkeleton` | 操作按钮栏 |
| `CharacterSelectionSkeleton` | 选角界面 |
| `BoardLayoutRenderer` | 布局渲染器 |
| `BoardLayoutEditor` | 布局编辑器（开发工具） |
| `BuffSystem` | Buff/状态效果显示 |
| `CriticalImageGate` | 关键图片加载门控 |
| `InteractionGate` / `InteractionGuard` | 交互门控 |
| `TutorialSelectionGate` | 教程选择门控 |
| `PlayerOccupancyBadge` | 玩家占位徽章 |

**调试工具**（`/components/game/framework/debug/`）：

| 工具 | 职责 |
|------|------|
| `cardNameResolver` | 通用卡牌名称解析器（支持三种游戏数据结构） |

框架层 Hooks（`/components/game/framework/hooks/`）：

| Hook | 职责 |
|------|------|
| `useGameBoard` | 棋盘核心状态（视角、连接、布局） |
| `useHandArea` | 手牌区状态（拖拽、选中、过滤） |
| `useResourceTray` | 资源栏状态 |
| `useDragCard` | 卡牌拖拽交互 |
| `useAutoSkipPhase` | 无可用操作时自动跳过阶段，内置多步骤交互守卫 |
| `useVisualSequenceGate` | 视觉序列门控（beginSequence/endSequence/scheduleInteraction） |

### 8.3 FX 特效系统

位于 `src/engine/fx/`，提供事件驱动的特效调度：

- **FxRegistry**：Cue 注册表（事件类型 → 渲染器映射）
- **useFxBus**：事件总线 Hook（消费 EventStream 触发特效）
- **FxLayer**：特效渲染层
- **WebGL Shader 子系统**：`ShaderCanvas` + `ShaderMaterial` + GLSL 噪声库

---

## 9. 服务端架构

### 9.1 双服务入口

项目有两个独立的服务端进程：

**游戏服务（`server.ts`）**：
- GameTransportServer — 游戏状态同步（WebSocket / socket.io + MsgPack 序列化）
- socket.io namespace — 大厅/重赛/聊天实时通道
- HybridStorage — 状态持久化（MongoDB）
- 清单驱动注册 — 只加载 `enabled=true` 的游戏
- 对局归档 — `onGameOver` 回调自动写入 MatchRecord
- 座位认领 — `claimSeat` + `joinGuard`
- 离线交互裁决 — `offlineInteractionAdjudicator`

**REST API 服务（`apps/api/`，NestJS）**：

| 模块 | 职责 |
|------|------|
| `auth` | JWT 认证（注册/登录/刷新） |
| `admin` | 管理后台（用户/对局/UGC 审核） |
| `friend` | 好友系统 |
| `message` | 站内消息 |
| `invite` | 邀请链接 |
| `review` | 评论/评分 |
| `custom-deck` | 自定义卡组 |
| `layout` | 棋盘布局持久化 |
| `ugc` | UGC 内容管理（暂搁置） |
| `sponsor` | 赞助 |
| `feedback` | 反馈收集 |
| `user-settings` | 用户设置 |
| `health` | 健康检查 |

### 9.2 实时通信

| 通道 | 文件 | 用途 |
|------|------|------|
| lobbySocket | `src/services/lobbySocket.ts` | 房间列表实时订阅 |
| matchSocket | `src/services/matchSocket.ts` | 对局内重赛投票 + 聊天 |
| socialSocket | `src/services/socialSocket.ts` | 好友在线/消息/邀请 |

### 9.3 存储层

- **HybridStorage**（`src/server/storage/`）：游戏状态持久化到 MongoDB（MongoStorage + 内存缓存）
- **MongoDB**：用户数据、对局记录、自定义卡组、好友关系
- **Cloudflare R2**：图片/音频/国际化文件 CDN 分发

---

## 10. 测试架构

### 10.1 测试分层

| 层级 | 框架 | 目录 | 覆盖范围 |
|------|------|------|---------|
| 领域测试 | Vitest + GameTestRunner | `src/games/<gameId>/__tests__/` | 游戏规则、命令校验、状态流转 |
| 系统测试 | Vitest | `src/engine/systems/__tests__/` | 引擎系统逻辑 |
| 原语测试 | Vitest | `src/engine/primitives/__tests__/` | 引擎原语函数 |
| API 测试 | Vitest | `apps/api/test/` | NestJS API 集成 |
| E2E 测试 | Playwright | `e2e/` | 完整用户流程 + 交互面 |

### 10.2 GameTestRunner

引擎级通用测试运行器（`src/engine/testing/`），通过 `executePipeline` 执行测试：

```typescript
const runner = new GameTestRunner({
    domain: MyGameDomain,
    systems: [...],
    playerIds: ['0', '1'],
    assertFn: myAssertFn,
});

runner.runAll([
    { name: '正常流程', commands: [...], expect: { winner: '0' } },
    { name: '非法操作', commands: [...], expect: { expectError: { command: 'CLICK_CELL', error: 'cell_occupied' } } },
]);
```

---

## 11. 关键数据流

### 11.1 玩家操作的完整链路

```
用户点击 UI
  → Board.tsx 调用 dispatch('ATTACK', { target: 'B' })
    → GameProvider 拦截命令
      ├─ 乐观引擎 processCommand()
      │   ├─ Random Probe 检测：pipeline 未调用随机数 → 确定性命令
      │   │   → 本地 executePipeline 预测状态 → 立即更新 UI（零延迟）
      │   │   → AnimationMode 决定是否保留 EventStream（乐观动画 or 等确认）
      │   └─ Random Probe 检测：pipeline 调用了随机数 → 非确定性命令
      │       → 丢弃乐观结果，等待服务端确认
      └─ GameTransportClient 发送 socket 'command' 事件
           → GameTransportServer.executeCommandInternal 构造 Command
             → executePipeline(config, state, command, random, playerIds)
               → Systems.beforeCommand（Undo 快照、Flow 拦截等）
               → Domain.validate → Domain.execute → Event[]
               → Domain.reduce（逐事件更新 core）
               → Systems.afterEvents（多轮：Log/EventStream/ActionLog/Flow 自动推进）
               → applyGameoverCheck（检测游戏结束，写入 sys.gameover）
             ← PipelineResult { success, state, events }
           → 持久化状态到 MongoDB
         → GameTransportServer 广播状态（经 playerView 过滤 + stripStateForTransport 裁剪 sys 层大体积数据）
    → GameProvider.reconcile() 对比确认状态与预测状态
      ├─ 一致 → 保持乐观状态，丢弃已确认的 pending 命令
      └─ 不一致 → 回滚到确认状态，基于新状态 replay 剩余 pending 命令
         → 携带 optimisticEventWatermark 过滤已播放的动画事件
  → React 重渲染 Board.tsx
```

### 11.2 EventStream 消费链路（特效/音效）

```
事件产生 → EventStreamSystem 追加 entry（带自增 id）
  → UI 层 useEffect 监听 G.sys.eventStream.entries
    → useEventStreamCursor 管理游标（自动处理：首次挂载跳过历史、Undo 回退重置、乐观引擎 entries 暂空）
      → consumeNew() 返回新事件 + didReset 标志
        → FxRegistry 查找渲染器 → 播放特效
        → AudioManager 查找音效 key → 播放音效
```

---

## 12. 模式差异

| 特性 | local | online | tutorial |
|------|-------|--------|----------|
| 入口 | `/play/:gameId/local` | MatchRoom | MatchRoom |
| 领域校验 | `skipValidation=true`（跳过权限，保留规则） | 严格校验 | `skipValidation=true` |
| 玩家身份 | hotseat（`core.currentPlayer`） | 按 `playerID` 限制 | hotseat + AI 行动（`aiActions`） |
| 随机数 | 确定性种子随机 | 确定性种子随机 | `TutorialRandomPolicy` 覆盖 |
| 旁观者 | 不适用 | 阻止命令（`isSpectator` 检测） | 不适用 |
| playerId 解析 | `core.currentPlayer` | 显式 `playerID` | 同 local + `__tutorialPlayerId` 覆盖 |

---

## 13. 目录结构总览

```
/ (repo root)
├── server.ts                     # 游戏服务入口（GameTransportServer + socket.io + Koa）
├── apps/
│   └── api/                      # NestJS REST API 服务
│       └── src/modules/          #   13 个业务模块
├── src/
│   ├── engine/                   # 引擎层
│   │   ├── adapter.ts            #   引擎适配器工厂（createGameEngine）
│   │   ├── pipeline.ts           #   Command/Event 执行管线
│   │   ├── types.ts              #   核心类型定义
│   │   ├── notifications.ts      #   引擎通知分发
│   │   ├── systems/              #   系统层（11 个系统）
│   │   ├── primitives/           #   原语层（15 个纯函数模块）
│   │   ├── testing/              #   GameTestRunner
│   │   ├── hooks/                #   引擎级 React Hooks
│   │   └── fx/                   #   特效系统（Canvas + WebGL Shader）
│   ├── core/                     #   框架核心（类型契约 + AssetLoader + 游戏注册）
│   ├── games/                    #   游戏实现
│   │   ├── tictactoe/            #     井字棋（简单示例）
│   │   ├── dicethrone/           #     骰子王座（复杂）
│   │   ├── summonerwars/         #     召唤师战争（复杂）
│   │   ├── smashup/              #     大杀四方（复杂）
│   │   ├── manifest*.ts          #     清单系统（客户端/服务端/生成）
│   │   └── registry.ts           #     运行时注册表
│   ├── components/               #   通用 UI 组件
│   │   ├── game/                 #     游戏 UI（GameHUD/UndoFab/EndgameOverlay 等）
│   │   ├── game/framework/       #     跨游戏复用骨架（15+ 组件 + 6 Hooks）
│   │   ├── common/               #     通用组件（动画/弹窗/媒体）
│   │   └── system/               #     系统级 UI（悬浮球/Toast/Modal）
│   ├── contexts/                 #   全局 Context（11 个）
│   ├── pages/                    #   页面入口（首页/房间/对战/开发工具）
│   ├── services/                 #   socket 通信封装（lobby/match/social）
│   ├── hooks/                    #   通用 Hooks
│   ├── lib/                      #   底层工具库（i18n/audio/utils）
│   ├── server/                   #   服务端共享模块（存储/认证/聊天）
│   ├── shared/                   #   前后端共享类型
│   └── types/                    #   全局类型声明
├── e2e/                          #   Playwright E2E 测试
├── docs/                         #   研发文档
│   └── ai-rules/                 #     AI 助手专项规范
├── openspec/                     #   变更规范与提案
├── public/                       #   静态资源（图片/音频/国际化）
└── scripts/                      #   工具脚本（资源处理/音频/数据库）
```

---

## 14. 设计决策

### 14.1 为什么 Command/Event 而非直接 Reducer

- **可审计**：所有状态变更都有对应事件记录
- **可撤销**：快照基于完整状态，事件流用于回放验证
- **系统介入点**：beforeCommand/afterEvents hook 让系统在不侵入领域代码的情况下参与
- **派生事件**：postProcess/interceptEvent 支持复杂规则交互（万智牌式 SBA、替代效果）

### 14.2 为什么 sys/core 分离

- **系统状态独立**：Undo/Interaction/Tutorial 等系统不会与游戏状态耦合
- **领域纯净**：reduce 只操作 core，系统状态由系统自己在 afterEvents 中更新
- **playerView 分层**：领域层和系统层各自过滤，互不干扰

### 14.3 为什么原语层不预定义效果类型

- **避免过早抽象**：不同游戏的"伤害""治疗"语义差异大
- **注册器模式**：游戏注册自己的处理器，引擎只负责调度

### 14.4 确定性保证

- 所有随机数通过 `RandomFn` 接口注入（由 `createTrackedRandom` 提供确定性种子随机）
- 教程模式通过 `TutorialRandomPolicy` 覆盖随机数（fixed/sequence 两种模式）
- `reduce` 必须是纯函数，禁止读取外部状态
- 时间戳由管线统一分配（基于日志最后条目递增），不使用 `Date.now()`

### 14.5 传输优化

- **MsgPack 序列化**：所有 socket.io 连接使用 `socket.io-msgpack-parser`，比 JSON 减少 ~28% 体积
- **传输裁剪**（`stripStateForTransport`）：广播前裁剪 `sys` 层大体积数据（undo.snapshots → `snapshotCount`、eventStream.entries → `nextId`、tutorial.steps → `totalSteps`），不碰 `core`
- **playerView 过滤**：领域层隐藏对手手牌/牌库内容（`previewRef` 置空），弃牌堆公开
- 实测体积：DiceThrone ~44 KB（MsgPack）、SummonerWars ~16 KB（MsgPack），每步操作 Delta ~0.6 KB，但绝对体积小不值得做增量同步

---

## 附录：关键文件索引

| 用途 | 路径 |
|------|------|
| 引擎核心类型 | `src/engine/types.ts` |
| 执行管线 | `src/engine/pipeline.ts` |
| 适配器工厂 | `src/engine/adapter.ts` |
| 系统层入口 | `src/engine/systems/index.ts` |
| 原语层入口 | `src/engine/primitives/index.ts` |
| 特效系统入口 | `src/engine/fx/index.ts` |
| 框架核心类型 | `src/core/types.ts` |
| 资源加载器 | `src/core/AssetLoader.ts` |
| 游戏清单 | `src/games/manifest.ts` |
| 游戏注册表 | `src/games/registry.ts` |
| 测试运行器 | `src/engine/testing/index.ts` |
| 骨架组件入口 | `src/components/game/framework/index.ts` |
| 游戏服务入口 | `server.ts` |
| REST API 入口 | `apps/api/src/main.ts` |
| 测试规范 | `docs/automated-testing.md` |
| 引擎系统规范 | `docs/ai-rules/engine-systems.md` |
| 架构可视化数据 | `src/pages/devtools/arch/archData.ts` |
