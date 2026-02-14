## Context

项目已自建完整引擎层（pipeline、systems、adapter），boardgame.io 仅作为状态同步和房间管理的中间层。server.ts 中 1,350+ 行代码有超过 800 行是绕过 boardgame.io 默认行为的 hack。移除后需要自建：状态同步传输层、React 客户端封装、REST API 路由、存储接口。

### 约束
- 必须保持 local/online/tutorial 三种模式兼容
- 必须保持现有 MongoDB 存储层（MongoStorage/HybridStorage）
- 必须保持现有 socket.io 大厅/重赛/聊天事件不受影响
- 迁移期间不能中断现有游戏功能

## Goals / Non-Goals

Goals:
- 移除 boardgame.io 依赖，消除类型安全黑洞
- 提供类型安全的命令分发（编译期捕获错误的命令名）
- 简化 server.ts（移除 recreateRequestStream、interceptLeave 等 hack）
- 统一 socket.io 使用（游戏状态同步与大厅共用同一 IOServer，不同 namespace）

Non-Goals:
- 不重构引擎管线（pipeline.ts、systems 保持不变）
- 不改变游戏领域层（domain/）
- 不改变存储数据结构（MongoDB 文档格式保持兼容）
- 不引入新的实时框架（继续使用 socket.io）

## Decisions

### D1: 传输层架构

采用 namespace 隔离模式：

```
IOServer (单实例)
├── /game — 游戏状态同步（替代 boardgame.io 的 /default namespace）
├── /lobby-socket — 大厅事件（保持不变）
└── 默认 namespace — 重赛/聊天（保持不变）
```

服务端：
- `src/engine/transport/server.ts` — `GameTransportServer` 类
  - 管理 match room（`game:<matchID>`）
  - 接收命令 → 执行 pipeline → 广播状态
  - playerView 过滤后分发给各玩家
- 客户端：
- `src/engine/transport/client.ts` — `GameTransportClient` 类
  - 连接 `/game` namespace
  - 发送命令、接收状态更新
  - 自动重连、凭证验证

替代方案：独立 WebSocket 服务器 — 拒绝，增加部署复杂度且 socket.io 已在用。

### D2: 类型安全命令分发

替换 `Record<string, Function>` 为泛型命令分发：

```typescript
// 引擎层提供
interface GameClient<TCore, TCommands extends Record<string, unknown>> {
  state: MatchState<TCore>;
  dispatch: <K extends keyof TCommands>(type: K, payload: TCommands[K]) => void;
  playerId: string | null;
}

// 游戏层定义命令映射
type SWCommandMap = {
  [SW_COMMANDS.MOVE_UNIT]: { unitId: string; position: Position };
  [SW_COMMANDS.ATTACK]: { attackerId: string; targetId: string };
  [SW_COMMANDS.ACTIVATE_ABILITY]: { unitId: string; abilityId: string };
  // ...
};

// Board 组件使用
const { dispatch } = useGameClient<SWCore, SWCommandMap>();
dispatch(SW_COMMANDS.ACTIVATE_ABILITY, { unitId, abilityId }); // 类型安全
dispatch('nonExistent', {}); // ❌ 编译错误
```

替代方案：保持 `Record<string, Function>` + lint 规则 — 拒绝，无法在编译期捕获错误。

### D3: React 客户端封装

替换 boardgame.io 的 `Client()` HOC 为 React Hook + Context：

```typescript
// 在线模式
<GameProvider matchId={matchId} playerId={playerId} credentials={credentials}>
  <Board />
</GameProvider>

// 本地模式
<LocalGameProvider game={gameImpl} numPlayers={2} seed={seed}>
  <Board />
</LocalGameProvider>

// Board 内部
function Board() {
  const { state, dispatch, playerId, isConnected } = useGameClient<MyCore, MyCommands>();
  // ...
}
```

替代方案：保持 HOC 模式 — 拒绝，Hook 模式更符合 React 19 惯例且类型推导更好。

### D4: REST API 路由

boardgame.io 提供的 REST API（`/games/:name/create`、`/join`、`/leave`）改为自建 Koa 路由。
当前 server.ts 已经拦截了 create/join/leave 做自定义逻辑，移除后直接在路由中实现，无需 `recreateRequestStream` hack。

路由结构保持不变（前端 URL 不变）：
- `POST /games/:name/create` — 创建房间
- `POST /games/:name/:matchID/join` — 加入房间
- `POST /games/:name/:matchID/leave` — 离开房间
- `POST /games/:name/:matchID/destroy` — 销毁房间（已是自建）
- `POST /games/:name/:matchID/claim-seat` — 占座（已是自建）
- `GET /games/:name/:matchID` — 获取房间信息（替代 LobbyClient.getMatch）

### D5: 存储层适配

保留 MongoStorage/HybridStorage 的 MongoDB 操作逻辑，但移除 boardgame.io `StorageAPI.Async` 接口约束。
简化为项目自有接口：

```typescript
interface MatchStorage {
  createMatch(matchID: string, data: MatchData): Promise<void>;
  fetch(matchID: string): Promise<{ state: MatchState; metadata: MatchMetadata } | null>;
  setState(matchID: string, state: MatchState): Promise<void>;
  setMetadata(matchID: string, metadata: MatchMetadata): Promise<void>;
  wipe(matchID: string): Promise<void>;
  listMatches(gameName: string): Promise<string[]>;
}
```

### D6: 随机数

保留 `createSeededRandom(seed)` 和 `RandomFn` 接口（已在 pipeline.ts 中实现）。
移除 adapter.ts 中对 boardgame.io `random` 对象的包装。
在线模式：服务端生成种子，客户端不需要随机数（所有计算在服务端执行）。

### D7: 迁移策略

分阶段迁移，每阶段可独立验证：

1. **Phase 1: 类型层** — 定义自建类型（GameBoardProps、MatchStorage、GameTransportClient），创建兼容 shim
2. **Phase 2: 服务端** — 重写 server.ts，实现 GameTransportServer，替换存储接口
3. **Phase 3: 客户端** — 实现 GameProvider/LocalGameProvider，替换 MatchRoom/LocalMatchRoom
4. **Phase 4: 游戏层** — 逐个游戏替换 BoardProps → GameBoardProps，替换 moves → dispatch
5. **Phase 5: 清理** — 移除 boardgame.io 依赖、adapter.ts 旧代码、LobbyClient 调用

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 状态同步可靠性（boardgame.io 经过多年验证） | 核心逻辑简单（服务端执行 → 广播状态），E2E 测试覆盖 |
| 重连/断线恢复 | socket.io 内置重连 + 服务端保存最新状态，客户端重连后拉取 |
| 并发命令冲突 | 服务端串行执行（单 match 单锁），与 boardgame.io 行为一致 |
| 迁移期间功能中断 | 分阶段迁移，每阶段独立可验证 |
| UGC 游戏兼容 | UGC 使用相同的 adapter 接口，同步替换 |

## Resolved Questions

- **REST API 路径**：保持 `/games/:name/...` 不变，避免前端大面积改动。
- **离线交互裁决**：保留。功能内置到 `GameTransportServer`——断线回调直接调用 pipeline 执行 `CANCEL_INTERACTION`，比现在绕道 boardgame.io `Master` 更简洁。不需要单独重构，作为迁移的一部分自然替换。
