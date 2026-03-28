# ugc-runtime Specification

## Purpose
TBD - created by archiving change add-ugc-prototype-builder. Update Purpose after archive.
## Requirements
### Requirement: UGC 运行时双沙箱隔离
系统 SHALL 在服务端沙箱执行 UGC 规则代码，并在客户端 iframe 沙箱渲染 UGC 视图，二者不得直接访问宿主进程资源。

#### Scenario: 服务端规则隔离
- **WHEN** 系统加载 UGC 规则模块
- **THEN** 模块 MUST 在服务端沙箱中执行并禁止访问 `fs/net/process`

#### Scenario: 客户端视图隔离
- **WHEN** 系统渲染 UGC 游戏视图
- **THEN** 系统 MUST 使用独立 iframe 作为渲染容器，且每个 UGC 游戏实例只绑定一个 iframe

### Requirement: 受限 SDK 通信边界
系统 SHALL 仅允许 UGC 视图通过受限 SDK 与宿主通信，宿主在执行动作前必须校验来源与参数。

#### Scenario: 视图发起动作
- **WHEN** UGC 视图请求出牌/目标选择/结束回合等动作
- **THEN** 视图 MUST 通过 SDK 发送消息，宿主验证后执行

#### Scenario: 禁止直接操纵宿主
- **WHEN** UGC 视图尝试直接访问宿主 DOM 或全局状态
- **THEN** 系统 MUST 阻止该访问或使其不可见

### Requirement: 视图网络访问限制
系统 SHALL 允许外链图片加载，但禁止 UGC 视图发起任意外部网络请求。

#### Scenario: 外链图片允许
- **WHEN** UGC 视图加载 `https://` 图片资源
- **THEN** 系统 MUST 允许该图片加载

#### Scenario: 外部请求禁止
- **WHEN** UGC 视图尝试通过 `fetch`/`XHR` 访问外部 API
- **THEN** 系统 MUST 阻止该请求并返回受限错误

### Requirement: 视图入口契约
系统 SHALL 要求 UGC 视图包提供标准入口以完成挂载与卸载。

#### Scenario: 视图入口存在
- **WHEN** 系统加载 UGC 视图包
- **THEN** 该包 MUST 暴露 `mount` 与 `unmount` 方法以供宿主调用

### Requirement: 预览与运行统一容器
系统 SHALL 提供统一运行容器供预览与运行复用，保证接口与行为一致。

#### Scenario: 预览复用容器
- **WHEN** 用户进入预览模式
- **THEN** 系统 MUST 使用与运行时一致的容器与接口

### Requirement: 动作钩子执行通道
系统 SHALL 允许视图通过受限 SDK 触发动作钩子，并由宿主验证后执行。

#### Scenario: 动作钩子请求
- **WHEN** 视图触发动作钩子
- **THEN** 系统 MUST 通过受限 SDK 发送并由宿主校验

### Requirement: 预览与运行时共享布局解析路径
系统 SHALL 让 Builder 预览与 Runtime 视图共用同一套布局解析与渲染路径，以保证锚点布局在两端表现一致。

#### Scenario: Builder 预览解析锚点布局
- **WHEN** Builder 预览渲染包含 `anchor/pivot/offset` 的布局组件
- **THEN** 系统 MUST 使用统一布局解析器计算实际矩形

#### Scenario: Runtime 复用预览布局渲染
- **WHEN** Runtime 视图从状态中提取 `builderPreviewConfig`
- **THEN** 系统 MUST 复用与 Builder 预览相同的布局渲染路径来展示布局组件

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

