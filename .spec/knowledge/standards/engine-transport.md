---
name: engine-transport
description: 传输层标准：在线状态、服务端权威、恢复和反馈过滤——改联网链路时查
metadata:
  type: doc
  status: 已交付
---

# 引擎传输层与 Board Props 规范

### 传输层架构（强制理解）

项目使用自研传输层：

| 组件 | 路径 | 职责 |
|------|------|------|
| `GameTransportServer` | `src/engine/transport/server.ts` | 服务端：管理对局生命周期、执行管线、playerView 过滤 + 传输裁剪（`stripStateForTransport`）、广播状态、持久化 |
| `GameTransportClient` | `src/engine/transport/client.ts` | 客户端：socket.io 连接（MsgPack 序列化）、命令发送、状态同步 |
| `GameProvider` / `LocalGameProvider` | `src/engine/transport/react.tsx` | React 集成：在线 Provider + 教程用 LocalProvider + BoardBridge |
| `GameBoardProps` | `src/engine/transport/protocol.ts` | Board 组件 Props 契约 |
| `createGameEngine` | `src/engine/adapter.ts` | 适配器工厂：Domain + Systems → GameEngineConfig |
| `OptimisticEngine` | `src/engine/transport/latency/optimisticEngine.ts` | 客户端乐观更新引擎：本地预测 + 服务端调和 |
| `CommandBatcher` | `src/engine/transport/latency/commandBatcher.ts` | 命令批处理（合并高频命令减少网络往返） |
| `LatencyOptimizationConfig` | `src/engine/transport/latency/types.ts` | 延迟优化配置类型（每个游戏的 `latencyConfig.ts`） |

传输层有一个必须守住的边界：

- `当前本地视角玩家`：只表示本地页面正在代谁看/代谁点，属于 `LocalGameProvider` 壳层语义。
- `命令执行者`：真正写进 command 的执行玩家，是 transport 命令解析语义。
- `教程指定执行者`：教程 AI 为了替某个座位发命令时的显式指定来源。

这三者不能混成同一个字段，更不能在 `provider`、`local transport`、`server transport` 各自维护一套不同优先级。凡是修改这层逻辑，必须先锁唯一解析入口，再决定哪些来源有资格参与解析。

测试桥 / TestHarness 也适用同一原则：测试页面默认起局、URL 参数自动建局、`LocalGameProvider` 壳层自动推进，都只能算“测试壳现场”，不能直接当业务真相源。凡是断言某个初始 core、起手牌数、当前阶段、自动摸牌结果的 E2E，用例必须显式注入 `domain.setup(...)` 或明确状态构造器，不能一条用例吃默认现场、另一条用例又吃手工注入现场。测试桥如果需要指定“由谁发命令”，应优先走 `command.playerId` 或等价正式入口；`__tutorialPlayerId` 只允许留给教程 AI 命令，不得再拿它充当普通测试/调试覆盖字段。

#### 乐观更新引擎（Optimistic Engine）

客户端延迟优化子系统，通过本地预测 + 服务端调和实现低延迟交互体验。

核心流程：
1. 玩家操作 → `processCommand()` 本地执行 `executePipeline` 预测状态 → 立即更新 UI
2. 命令同时发送到服务端 → 服务端执行并广播确认状态
3. `reconcile()` 对比确认状态与预测状态 → 一致则保持，不一致则回滚

关键机制：
- **Random Probe 自动检测**：包装 `RandomFn` 追踪 pipeline 执行期间是否调用了随机数。调用了 → 丢弃乐观结果（等服务端确认）；未调用 → 保留乐观结果。游戏层无需手动声明 `commandDeterminism`（可选覆盖）。
- **`commandDeterminism` 显式声明陷阱（强制理解）**：显式声明 `'deterministic'` 会**跳过 Random Probe**，比不声明更危险。若命令实际调用了 `random`（如掷骰子），乐观预测结果与服务端不一致，导致 `sys.gameover` 等关键状态不同步。**开发环境会自动检测此错误**（`console.error` 报警）。规则：
  - ✅ 不声明 → Random Probe 自动检测（推荐，最安全）
  - ✅ 声明 `'non-deterministic'` → 跳过预测，等服务端确认（随机命令的正确做法）
  - ⚠️ 声明 `'deterministic'` → 跳过 probe，**必须确保命令真的不调用 `random`**，否则产生静默 bug
  - **教训**：SummonerWars `DECLARE_ATTACK` 被错误声明为 `'deterministic'`（注释写"不含掷骰"），实际 execute 里就是掷骰子的地方，导致打死召唤师后胜利画面延迟到下一回合才出现。
- **AnimationMode**：按命令粒度控制 `'optimistic'`（保留 EventStream 立即触发动画）或 `'wait-confirm'`（剥离 EventStream 等确认后触发）。默认 `'wait-confirm'`。
- **骰子动画最短播放时间**：乐观预测会瞬间产生新状态（如 `rollCount` 变化），但骰子翻滚动画需要时间。**不在框架层延迟 `setState`**（会阻塞 EventStream 事件传递，破坏伤害/治疗等动画），而是在 UI 层（如 `DiceActions`）用 `MIN_ROLL_ANIMATION_MS` + `rollStartTimeRef` 保护最短播放时间。这是纯 UI 层关注点，不属于框架层职责。
- **EventStream 水位线**（`optimisticEventWatermark`）：记录已通过乐观动画播放的最大事件 ID，回滚时过滤已播放事件防止动画重复。
- **Pending 命令队列 + Replay**：服务端确认后基于新状态重放剩余 pending 命令，而非直接覆盖。`snapshotPhase` 校验防止已执行命令被重复 replay。

游戏层接入：在 `src/games/<gameId>/latencyConfig.ts` 导出 `LatencyOptimizationConfig`。大多数情况下只需空配置（Random Probe 自动处理），仅在需要强制声明确定性或自定义动画模式时才配置。

#### 传输优化

**序列化**：所有 socket.io 连接（游戏/大厅/社交）统一使用 `socket.io-msgpack-parser`（MsgPack 二进制序列化），比 JSON 减少 ~28% 体积。

**传输裁剪**（`stripStateForTransport`）：服务端在 `playerView` 过滤之后、`socket.emit` 之前，统一裁剪客户端不需要的大体积 sys 数据：

| 裁剪项 | 裁剪方式 | 客户端保留 | 原因 |
|--------|---------|-----------|------|
| `sys.undo.snapshots` | 清空数组 | `snapshotCount`（快照数量） | 快照含完整 MatchState 深拷贝，泄漏隐私（对手手牌/牌库） |
| `sys.eventStream.entries` | 清空数组 | `nextId`（cursor 水位线） | 客户端通过 cursor 实时消费，重连/广播时不需要历史 |
| `sys.tutorial.steps` | 清空数组 | `totalSteps`（步骤总数） | 客户端只用 `step`（当前步骤）和 `stepIndex` |

> ⚠️ 裁剪只动 `sys` 层，不碰 `core`（游戏领域状态）。卡牌预览（`previewRef`）、弃牌堆等展示数据不受影响。对手手牌隐藏是 `playerView` 的职责，不是传输裁剪。

#### 在线 AI 决策视图（强制）

在线 AI 不能再在“整份 `sharedState`”与“整份 seat `latestState`”之间粗暴二选一。当前统一口径是：

- **authoritative shared**：`phase`、`turnNumber`、`currentPlayer`、公共棋盘、公共资源、公开 setup 状态，永远以当前权威 shared 为准。
- **private overlay**：hidden interaction、seat 专属 options、私有手牌、seat 私有候选，只从该 seat 的私有 overlay 读取。

##### 默认决策语义

- `shared`
  - 公开 setup / 公开决策。
  - 即使 seat overlay 缺失或 stale，AI 也可以继续基于 authoritative shared 决策。
- `private-required`
  - hidden interaction、response window、seat 专属 option 列表或其它私有候选。
  - seat overlay 缺失或 stale 时，必须阻止 AI 出手，不能回退到共享视角乱决策。

##### 默认推断规则

- 看到 `sharedState.sys.responseWindow.current`，默认视为 `private-required`。
- 看到 shared 侧 `interaction.current.playerId === 当前 AI`，默认视为 `private-required`。
- 看到 shared 侧 `interaction.isBlocked === true` 且当前交互未公开暴露给当前 AI，默认视为 `private-required`。
- 看到 private overlay 内当前 AI 专属 interaction / responder queue，默认视为 `private-required`。
- 其余默认按 `shared` 处理。

##### 运行时扩展点

- 游戏 runtime 可通过 `resolveOnlineDecisionVisibility()` 做少量 override。
- 只有当框架无法从结构稳定推断时才允许 override，禁止把所有 phase / 所有情况做成游戏白名单表。

##### 实现要求

- `MatchRoom`、`resolveNextAiAction`、服务端 watchdog / legal-action recovery 必须复用同一套决策视图 helper。
- 私有决策的 freshness gate 只允许拦 `private-required`，不得再一刀切阻断整个在线 AI。
- 新增在线 AI 决策点时，先判断它依赖公共真相还是私有 overlay，再决定是否允许 shared fallback。
- **响应窗口特例（强制）**：`responseWindow` 场景下，freshness 校验不得把 `currentPlayer === responder` 当成硬条件。必须按窗口语义对齐（`windowType/sourceId/currentResponder`），因为响应者本来就可能不是当前行动玩家（如 DiceThrone 防御/干扰响应）。
- **response-loop 升级门禁（强制）**：watchdog 只有在确认是**纯 AI 响应循环**时，才允许把 `response-window` 升级成 `response-loop` 并执行 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`。最低要求同时满足：① 同一 incident 已有失败/重开证据；② 当前 `responderQueue` 里**没有 human**；③ 若 tracker 已从 `response-window` 升到 `response-loop`，后续 tick 必须沿同一 incident continuity 继续 hard-close，不能因为 key 前缀变化又降回 `RESPONSE_PASS`。凡修改 `resolveOnlineAiRecoveryCandidate()` 或 `runOnlineAiRecoverySequence()` 的 response-loop 逻辑，必须补两类直测：`human still queued -> 不得 hard-close`，以及 `existing response-loop / accumulated failureCount -> 不得空转降级`。

##### 回归门禁（强制）

- 任何触碰在线 AI 决策视图、seat freshness、watchdog legal-action recovery 的改动，至少补并通过以下三类测试：
- `shared` 决策：seat stale 下仍可继续（例如 faction/setup）。
- `private-required` 决策：seat stale 下必须阻断。
- `responseWindow` 决策：responder 不是 activePlayer 时仍可决策（并验证 watchdog 能执行 `RESPONSE_PASS`/等价动作）。
- 推荐统一门禁命令：`npm run test:ai:decision-view`（合并执行上述四类回归）。

##### AI 决策语义接入（新游戏强制）

- **新游戏阻塞交互必须声明 AI 支持状态**：凡 `sys.interaction.current` 可能分配给 AI 座位，必须在交互上声明 `ai.status`：
  - `semantic`：交互自身携带 `AiDecisionDescriptor[]`，例如 `select-player` / `select-card` / `select-object` / `select-dice` / `choose-option`。
  - `adapter`：游戏 AI runtime 有明确适配器消费该 interaction kind。
  - `unsupported`：明确人类专用，并写清原因；正常 AI 对局不得把该交互分配给 AI 座位。
- **新游戏禁止把 UI 外壳当 AI 语义来源**：AI 不得以 `interaction.kind === 'simple-choice'`、`data.type === 'selectPlayer'`、option label、数组下标、按钮文案这类 UI/展示形态作为主要业务语义。UI 可以继续使用自己的 `kind/data`，但 AI 必须消费规则决策语义或显式 adapter。
- **候选身份必须稳定**：AI 候选 ID 必须是当前决策内稳定业务 ID（playerId/cardUid/minionUid/base stable ref/dieId 等），禁止用 label、翻译文案、数组 index 作为唯一身份。数组 index 只能作为附加去重片段。
- **复杂选择必须声明边界**：多选必须声明 `min/max`，有顺序语义时必须声明 `ordered`；可跳过/必须跳过/不可跳过必须通过 skip policy 或明确候选表达，禁止让 AI 猜 `skip/pass/cancel` 字符串。
- **隐藏信息仍以 playerView/seat overlay 为边界**：AI 语义描述只能来自该 AI 可见状态，不得把隐藏手牌、牌库顺序、他人私有 prompt、私有候选塞进 shared 快照。
- **诊断门禁**：新增 AI 可控阻塞交互时，必须至少有一条测试或诊断证明：该交互能生成合法动作、明确 cancel/fallback，或被 `unsupported` 明确拦住；空 legalActions 不能被当作正常 idle。

##### AI 交互反模式（新游戏禁止）

```typescript
// ❌ AI 直接识别 UI 外壳，新增另一个 UI kind 后会漏掉同一条规则决策
if (current.kind === 'simple-choice') {
  return current.data.options.map(optionToAiAction);
}

// ❌ 用 option label / 翻译文案 / 数组下标当目标身份
const targetId = current.data.options[0].label;

// ❌ 只给 UI 写 targetType，不声明 AI 这一步是在 select-player / select-card / select-object
createSimpleChoice(id, playerId, title, options, { targetType: 'player' });

// ❌ AI 无动作时直接返回 []，导致 AI 座位静默卡死
if (!supportedInteraction) return [];
```

```typescript
// ✅ 交互声明 AI 语义，UI kind 仍然可以保持 simple-choice
createSimpleChoice(id, playerId, title, options, {
  targetType: 'player',
  ai: {
    status: 'semantic',
    decisions: [{
      kind: 'select-player',
      interactionId: id,
      actorPlayerId: playerId,
      selection: { min: 1, max: 1 },
      skipPolicy: 'forbidden',
      candidates: visibleTargets.map(target => ({
        id: `player:${target.playerId}`,
        playerId: target.playerId,
      })),
    }],
  },
});

// ✅ 历史或复杂自定义交互先明确 adapter，再逐步迁移到 semantic
queueInteraction(state, {
  id,
  kind: 'game:custom-targeting',
  playerId,
  ai: { status: 'adapter', adapterId: 'game.custom-targeting' },
  data,
});
```

##### 系统反馈闭环（强制）

- **触发条件**：处理 `online-ai-watchdog`、`force-end-turn-failed`、`legal-action-recovered`、`unsatisfiable interaction` 或其他系统自动反馈时。
- **单一处理顺序**：必须按 `先看能否直接定位业务问题 -> 不能定位就补诊断能力 -> 已证伪业务 bug 才修反馈链本身` 的顺序推进，禁止把三类问题混在一起处理。
- **能定位时直接修业务**：如果当前 feedback 已经带有足以命中的 `reason / fingerprint / stateSnapshot / command failure / player surface`，并能明确落到某个业务 bug、共享合同缺口或恢复逻辑缺口，则本轮主目标就是修该真实问题，而不是先改反馈文案、关闭反馈或重写 reporter。
- **不能定位时先补诊断**：如果 feedback 只能证明“卡了/失败了”，但仍无法回答“卡在哪个 phase / interaction / legal-action surface / 命令失败原因”，则先增强 feedback 本身的可定位性。至少应补到下一次同类 incident 能直接回答以下问题中的大部分：
- `当前卡点在哪个 phase / interaction kind / sourceId`
- `watchdog 当时看到的 progress marker / fingerprint / continuity`
- `试图执行了什么命令，为什么失败`
- `当前 active player / responder / AI seat / defender-choice options` 等关键上下文
- **证伪业务 bug 后，系统反馈本身就是 bug**：如果已经用本地定向复现、命令回放、共享合同测试或线上快照证明业务链路本身正确，但系统反馈仍误报、重复上报、对恢复态继续入库、缺字段导致无法定位，必须把 reporter / dedupe / recovery closeout / persisted feedback filter 当作正式 bug 修，而不是把这类记录归为“正常噪音”。
- **最低收口证据**：宣称“系统反馈已修”前，至少要能说明 ① 命中的是真实业务 bug 还是 feedback 链 bug；② 现在的 feedback 是否已足以定位同类问题；③ 本轮新增或复跑了哪条 transport/watchdog 直测；④ 若是恢复态/误报类问题，为什么以后不会继续生成相同 open feedback。
- **推荐测试落点**：优先在 `src/engine/transport/__tests__/server.test.ts` 增补或复跑 watchdog / automatic feedback / persisted feedback 相关直测；若根因落在具体游戏 legal-action 生成或 interaction 可解性，再补对应游戏的命令级回归，避免只在服务端层看到“已恢复”但不知道恢复的到底是不是正确动作。

#### GameBoardProps 契约（强制）

```typescript
interface GameBoardProps<TCore, TCommandMap> {
    G: MatchState<TCore>;           // 完整状态（core + sys）
    dispatch: (type, payload) => void; // 类型安全命令分发
    moves: Record<string, Function>;   // 兼容层（过渡期保留）
    playerID: string | null;
    matchData?: MatchPlayerInfo[];
    isMultiplayer?: boolean;
    isConnected?: boolean;
    locale?: string;
    reset?: () => void;
}
```

- **不再有 `ctx` prop**：`ctx`（含 `ctx.currentPlayer`、`ctx.gameover`、`ctx.phase` 等）已不存在。
- **当前玩家**：从 `G.core` 中读取（各游戏自定义字段，如 `G.core.currentPlayer`），`playerID` prop 为当前客户端的玩家 ID。
- **游戏结束**：使用 `G.sys.gameover`（见下方「游戏结束检测」节）。
- **阶段**：使用 `G.sys.phase`。
- **新代码应使用 `dispatch`**，`moves` 为过渡期兼容层。

---
