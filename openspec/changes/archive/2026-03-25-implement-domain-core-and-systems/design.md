## Context

当前代码库已经不再处于“讨论是否引入域内核”的阶段，而是已经在运行：

- `DomainCore` 负责游戏规则主体
- `pipeline` 负责命令执行与事件归约
- `systems` 负责跨游戏平台能力
- `transport` 负责在线/本地对局运行时

因此本次收口不再记录过渡方案，而是只保留已经成为现行架构事实的能力。

## Final Decisions

### 1. 对局状态统一为 `MatchState = { sys, core }`

- `core` 保存游戏领域状态
- `sys` 保存框架层状态，例如阶段、撤回、交互、事件流、教程、重赛、响应窗口等

这已经是当前引擎与游戏实现共享的统一状态形状。

### 2. 规则主体放在游戏自己的 `domain/`

每个游戏在 `src/games/<gameId>/domain/` 下实现自己的领域模块，核心职责是：

- `setup`
- `validate`
- `execute`
- `reduce`
- `playerView`
- `isGameOver`

平台层不再把规则主体塞进 UI 或 dispatch 入口。

### 3. Command / Event 必须是可序列化的纯数据

当前自研引擎通过传输层、日志、训练数据、测试注入、重放等链路消费命令与事件，因此它们必须保持纯数据边界。

### 4. 系统层负责跨游戏平台能力

当前引擎已把以下能力沉到系统层：

- Flow
- Undo
- Interaction / SimpleChoice / MultistepChoice
- EventStream
- ActionLog
- ResponseWindow
- Tutorial
- Rematch
- Cheat

系统通过 `beforeCommand`、`afterEvents`、`playerView` 等生命周期参与执行。

### 5. 过渡项与未来项不随本次归档进入正式 spec

以下内容不再作为本 change 的正式范围：

- `boardgameio-adapter` 这种过渡期命名
- `ugc-optional` 这种尚未形成现行能力的未来项

它们要么已经被后续 change 取代，要么仍应单独立项。
