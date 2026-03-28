## ADDED Requirements

### Requirement: 客户端可解析 UGC 运行时配置
系统 SHALL 在客户端根据 UGC manifest 解析运行时入口和基础元数据，用于启动 UGC 运行时链路。

#### Scenario: 解析运行时入口
- **WHEN** 客户端请求 `/ugc/packages/:packageId/manifest`
- **THEN** 系统 MUST 解析 `entryPoints.rules`、`entryPoints.view`、`commandTypes` 和玩家人数范围

### Requirement: UGC 资源入口使用统一基座
系统 SHALL 使用统一的 UGC 资源基座来解析相对入口路径，默认基座为 `/assets`。

#### Scenario: 使用默认资源基座
- **WHEN** 客户端未显式配置 UGC 资源基座
- **THEN** 系统 MUST 使用 `/assets` 解析相对 `rules/view` 入口

### Requirement: UGC 在线对局复用远端宿主板
系统 SHALL 在在线 UGC 对局中使用远端宿主板把宿主状态和命令桥接到运行时视图。

#### Scenario: 包内 view 存在
- **WHEN** manifest 提供 `entryPoints.view`
- **THEN** 系统 MUST 加载包内 view 并通过受限桥接协议与宿主通信

#### Scenario: 包内 view 缺失
- **WHEN** manifest 未提供 `entryPoints.view`
- **THEN** 系统 MUST 回退到内置 runtime view 页面

### Requirement: MatchRoom 为已注册 UGC 包提供在线启动分支
系统 SHALL 为前端注册表中标记为 `isUgc` 的 UGC 包提供专用的在线加载分支，并显示明确的加载或失败状态。

#### Scenario: UGC 在线启动
- **WHEN** 用户进入一个已注册的 UGC 对局房间
- **THEN** 系统 MUST 异步加载 UGC 运行时并在完成后渲染对应 board

#### Scenario: UGC 加载失败
- **WHEN** UGC 运行时构建失败
- **THEN** 系统 MUST 显示 UGC 加载失败状态而不是直接进入普通游戏分支
