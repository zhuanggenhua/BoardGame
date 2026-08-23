---
name: engine-transport
description: 传输层标准：在线状态、服务端权威、恢复和反馈过滤——改联网链路时查
metadata:
  type: doc
  status: 已交付
---

# 引擎传输层与 Board Props 规范

本文件规定传输层、乐观更新、在线 AI 决策视图、系统反馈和 Board props 的长期合同。

## 架构入口

| 组件 | 路径 | 职责 |
| --- | --- | --- |
| `GameTransportServer` | `src/engine/transport/server.ts` | 对局生命周期、服务端执行、playerView、传输裁剪、广播、持久化 |
| `GameTransportClient` | `src/engine/transport/client.ts` | socket.io 连接、命令发送、状态同步 |
| `GameProvider` / `LocalGameProvider` | `src/engine/transport/react.tsx` | 在线 Provider、本地 Provider、Board bridge |
| `GameBoardProps` | `src/engine/transport/protocol.ts` | Board 组件契约 |
| `createGameEngine` | `src/engine/adapter.ts` | Domain + Systems 组装为 `GameEngineConfig` |
| `OptimisticEngine` | `src/engine/transport/latency/optimisticEngine.ts` | 本地预测与服务端调和 |
| `CommandBatcher` | `src/engine/transport/latency/commandBatcher.ts` | 高频命令批处理 |

## 身份边界

传输层必须区分三种身份：

- **本地视角玩家**：当前页面代谁看 / 代谁点，属于 Provider 壳层语义。
- **命令执行者**：写进 command 的真实玩家，属于命令解析语义。
- **教程指定执行者**：教程或自动脚本替某个座位发命令时的显式来源。

这三者不能混成一个字段，也不能在 provider、本地 transport 和服务端 transport 各维护一套优先级。修改命令来源解析时，先锁唯一解析入口，再决定哪些来源可参与解析。

测试桥 / TestHarness 也遵守同一原则：默认起局、URL 参数建局和本地壳自动推进只算测试现场，不是业务真相源。断言初始 core、起手牌、当前阶段或自动结果的 E2E，必须显式注入 `domain.setup(...)` 或明确状态构造器。

## 业务事务与批量命令

传输层必须区分两类批量：

- **业务事务批次**：一次玩家确认、一次 AI 决策或一次规则机会产生的多条命令，现实含义是同一个动作意图。
- **网络合包批次**：为了减少请求数量，把短时间内的独立命令合并发送；它不改变业务语义。

业务事务批次必须走显式批量入口，并满足以下合同：

- 客户端不得把同一次确认产生的多条业务命令逐条送进普通 dispatch；否则第一条命令进入 optimistic pending 后可能阻断或覆盖后续命令。
- 若批次同时包含规则命令和关闭 / 确认交互命令，它们仍属于同一业务事务；不能让关闭命令单独穿过 pending，而规则命令被拦截。
- 服务端按批次前状态建立快照，串行执行批次内命令；任一命令失败时必须回滚到批次前状态，并同步恢复 stateID、随机数游标 / 随机数生成器、可见状态缓存，再持久化回滚结果并广播权威状态。
- 客户端收到批次拒绝时必须走唯一回滚 / 重同步入口；不得用静默跳过、只保留第一条成功结果或 fallback 成功状态冒充完成。
- 本地 Provider、在线 Provider、AI 执行、测试桥如果消费同一种“动作产生多命令”合同，必须保持相同事务边界；临时测试循环只能作为测试构造，不能代表玩家或 AI 的正式传输语义。

审计此类改动时，最低证据必须覆盖：调用发起、传输接受、服务端确认 / 拒绝、回滚或占用释放四段；只证明调用了 `sendCommand` / `sendBatch`，不能证明业务事务已正确完成。

## 乐观更新

- 乐观更新流程：本地 `processCommand()` 预测状态并立即更新 UI；服务端执行后广播确认；客户端 `reconcile()` 对比，不一致则回滚。
- 随机命令默认由 Random Probe 自动检测。命令调用随机数时，丢弃乐观结果并等待服务端确认。
- 不声明 `commandDeterminism` 是默认安全做法。若显式声明 `deterministic`，必须证明命令不会调用随机数；随机结算命令应声明 `non-deterministic` 或不声明。
- `AnimationMode` 控制 EventStream 是否乐观触发：`optimistic` 保留乐观动画，`wait-confirm` 等服务端确认，默认 `wait-confirm`。
- UI 动画最短播放时间是 UI 层关注点；框架层不得为了动画延迟 `setState`。
- 服务端确认后基于新状态 replay 剩余 pending 命令；不得直接覆盖仍未确认的合法队列。

## 传输裁剪

服务端先做 playerView，再做传输裁剪。裁剪只动 `G.sys`，不碰 `G.core`。

| 裁剪项 | 客户端保留 | 原因 |
| --- | --- | --- |
| `sys.undo.snapshots` | `snapshotCount` | 快照含完整状态和隐藏信息 |
| `sys.eventStream.entries` | `nextId` | 客户端用 cursor 实时消费，不需要历史全量 |
| `sys.tutorial.steps` | `totalSteps` | 客户端只需要当前 step 和数量 |

对手手牌、牌库等隐藏信息由 playerView 负责；传输裁剪不是隐私过滤替代品。

## 在线 AI 决策视图

在线 AI 决策状态由两层组成：

- **authoritative shared**：phase、turnNumber、currentPlayer、公共棋盘、公共资源、公开 setup 等公共事实。
- **private overlay**：隐藏 interaction、座位专属 option、私有手牌、私有候选和 seat 专属 prompt。

默认判断：

- 公开 setup / 公开决策走 shared；seat overlay stale 时仍可继续。
- response window、当前 AI 专属 interaction、隐藏候选、私有 responder queue 走 private-required；overlay 缺失或 stale 时必须阻止 AI 出手。
- runtime override 只能处理框架无法稳定推断的少量情况；禁止把所有 phase 做成游戏白名单。
- response window 中 responder 不一定是 currentPlayer，freshness 校验要按窗口语义对齐。

修改在线 AI 决策、seat freshness、watchdog 或 legal-action recovery 时，至少覆盖：

- shared 决策在 seat stale 下仍可继续。
- private-required 决策在 seat stale 下必须阻断。
- responder 不是 activePlayer 时，response window 仍能生成合法动作或明确拒绝。

## AI 语义接入

凡 `sys.interaction.current` 可能分配给 AI 座位，交互必须声明 `ai.status`：

| 状态 | 含义 |
| --- | --- |
| `semantic` | 交互携带 `AiDecisionDescriptor[]`，AI 可直接生成合法动作 |
| `adapter` | 游戏 AI runtime 有明确 adapter 消费该 interaction kind |
| `unsupported` | 人类专用，正常 AI 对局不得分配给 AI 座位 |

规则：

- AI 不以 UI 外壳、option label、按钮文案、数组下标、`targetType` 或翻译文案作为业务语义主源。
- 候选 ID 必须是当前决策内稳定业务 ID，例如玩家 ID、对象实例 ID、区域稳定 ID、位置 ID、骰子 ID。
- 多选、顺序、跳过、必须跳过和不可跳过必须显式声明；不能让 AI 猜 `skip / pass / cancel` 字符串。
- 隐藏信息只能来自该 AI 可见状态；不得把他人私有候选或牌库顺序塞进 shared 快照。
- 新增 AI 可控阻塞交互时，至少有测试或诊断证明它能生成合法动作、明确 fallback，或被 `unsupported` 拦住。

## 系统反馈闭环

处理 watchdog、force-end-turn、legal-action recovery、unsatisfiable interaction 或其它自动反馈时，按顺序判断：

1. 当前反馈能否直接定位真实业务问题。
2. 不能定位时，先补诊断字段和快照。
3. 已证伪业务 bug 后，反馈链本身才是 bug。

能定位时直接修业务；不能定位时，下一次同类 incident 至少应能回答：卡在哪个 phase / interaction、progress marker / fingerprint、尝试了什么命令、为什么失败、active player / responder / AI seat / 候选上下文是什么。

宣称系统反馈已修前，必须说明命中的是业务 bug 还是反馈链 bug、当前反馈是否足以定位同类问题、复跑了哪条 transport / watchdog 测试、恢复态 / 误报为什么不会继续入库。

## Board Props

`GameBoardProps` 只保留当前传输合同：

- `G`：完整 `MatchState`，包含 `core` 和 `sys`。
- `dispatch`：类型安全命令分发，新代码优先使用。
- `moves`：过渡期兼容层。
- `playerID`：当前客户端玩家 ID，不等于当前回合玩家。
- `matchData`、`isMultiplayer`、`isConnected`、`locale`、`reset`：展示和壳层辅助。

禁止项：

- 不再传 `ctx` prop；`ctx.currentPlayer`、`ctx.gameover`、`ctx.phase` 都不是当前合同。
- 当前规则玩家从 `G.core` 或规则 helper 读取。
- 阶段读取 `G.sys.phase`。
- 游戏结束读取 `G.sys.gameover`，见 [`engine-gameover`](engine-gameover.md)。
