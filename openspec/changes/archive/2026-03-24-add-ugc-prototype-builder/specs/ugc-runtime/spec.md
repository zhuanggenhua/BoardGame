## ADDED Requirements

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
