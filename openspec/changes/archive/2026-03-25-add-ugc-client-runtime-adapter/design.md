## Context

当前项目已经具备一条完整但文档滞后的 UGC 客户端运行时链路：

- 客户端可从 UGC manifest 解析 `rules/view` 入口和玩家人数元数据
- Builder 沙箱可用同一套客户端工厂构造 draft runtime
- 在线 MatchRoom 可针对已注册的 UGC 包走单独的加载与渲染分支
- 运行时视图与宿主状态之间已通过 HostBridge / ViewSdk 建立受限通信

本次收口目标不是继续设计未来架构，而是把 change 调整为与这些既有实现一致。

## Goals / Non-Goals

- Goals:
  - 用真实代码路径描述 UGC 客户端 runtime adapter 的当前能力边界。
  - 明确在线对局只对 registry 中的已发布 UGC 生效，草稿继续走 Builder 沙箱。
  - 为归档留下准确 spec delta，避免把已完成能力长期挂在 active changes。
- Non-Goals:
  - 不把未看到的额外联机测试或更强的发布态校验硬写进文档。
  - 不把这次收口扩展成新的 UGC 架构升级。

## Decisions

### Decision: manifest 解析由客户端 loader 统一负责

- `loadUgcRuntimeConfig()` 负责请求 manifest，并解析 `entryPoints.rules/view`、`commandTypes`、玩家人数范围。
- 资源入口统一基于 `UGC_ASSET_BASE_URL` 解析，相对路径默认挂到 `/assets` 下。

### Decision: 客户端运行时工厂与远端宿主板分离

- `createUgcClientGame()` / `createUgcDraftGame()` 负责装配规则代码与运行时配置。
- `createUgcRemoteHostBoard()` 负责把在线对局状态桥接到 runtime view，不在 Board 组件内部自行运行规则沙箱。
- 包内 `view` 缺失时，Board 默认回退到内置 runtime view 页面。

### Decision: MatchRoom 只在已注册 UGC 包上启用客户端适配链

- 前端 registry 通过 `refreshUgcGames()` 只吸收已发布 UGC 包，并标记 `isUgc`。
- `MatchRoom` 根据 `gameConfig.isUgc` 进入 UGC 在线分支，异步装配 UGC board，并提供 loading / error 态。
- 未进入 registry 的草稿包不走在线 MatchRoom 分支，继续由 Builder 预览/沙箱消费。

## Risks / Trade-offs

- `createUgcClientGame()` 当前会在客户端加载规则代码；这对 Builder 沙箱和 UGC runtime bootstrap 有利，但也意味着入口缺失会在前端直接暴露为加载失败。
- 已发布包限制主要通过注册表暴露范围实现，而不是在 MatchRoom 内部再做一套独立的“草稿包拒绝”文案分支；文档应如实描述这条边界。
