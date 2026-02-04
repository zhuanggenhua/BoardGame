## ADDED Requirements

### Requirement: UGC 联机/教程入口复用大厅
系统 SHALL 复用现有大厅/房间与教程路由作为 UGC 的联机与教学入口。

#### Scenario: 进入 UGC 联机
- **WHEN** 用户在大厅选择 UGC 游戏并创建/加入房间
- **THEN** 系统 MUST 以 packageId 作为 gameId 进入现有 /play/:gameId/match/:matchId 流程

#### Scenario: 进入 UGC 教程
- **WHEN** 用户在详情页点击“教程”
- **THEN** 系统 MUST 进入 /play/:gameId/match/:matchId/tutorial 并加载 UGC 教程内容

### Requirement: 服务端动态注册 UGC 游戏
系统 SHALL 在服务端启动或刷新时，将已发布 UGC 包动态注册为可对局游戏。

#### Scenario: 服务端启动
- **WHEN** 服务端加载已发布 UGC 包
- **THEN** 系统 MUST 将 packageId 注册为可对局 gameId 并可被大厅创建房间

### Requirement: UGC 包入口文件
系统 SHALL 从 UGC 包内文件读取规则/视图/教程入口，并用于运行时加载。

#### Scenario: 读取入口文件
- **WHEN** 系统加载 UGC 包
- **THEN** 规则入口 MUST 使用 domain.js，视图入口 MUST 使用 index.html/main.js，教程入口 MUST 使用 tutorial.js 且导出 TutorialManifest 结构

### Requirement: 包来源与发布校验
系统 SHALL 仅允许加载服务器已发布的 UGC 包，未发布或不存在时必须拒绝进入。

#### Scenario: 包未发布
- **WHEN** 用户请求未发布或不存在的 packageId
- **THEN** 系统 MUST 返回错误并阻止进入运行时

### Requirement: 宿主桥接与 iframe 挂载
系统 SHALL 在 UGC 通用 Board 内使用 iframe 承载 UGC 视图，并通过 UGCHostBridge/UGCViewSdk 建立通信与生命周期管理。

#### Scenario: 进入与退出
- **WHEN** 用户进入 UGC 对局
- **THEN** 宿主 MUST 创建 iframe 并绑定宿主桥接；离开时 MUST 调用视图卸载并销毁桥接

### Requirement: 运行时音频与资源路径
系统 SHALL 在宿主侧处理 SFX/BGM 请求并使用 `/assets/*` 资源路径归一化规则加载资源。

#### Scenario: 视图请求播放音效
- **WHEN** 视图通过 SDK 发送 PLAY_SFX 请求
- **THEN** 宿主 MUST 解析资源路径并播放对应音效

### Requirement: 本地预览限定
系统 SHALL 仅在 Builder 预览场景允许使用本地数据，运行时入口不得直接读取本地包。

#### Scenario: Builder 预览
- **WHEN** 用户在 Builder 中预览
- **THEN** 系统 MAY 使用本地数据渲染

#### Scenario: 运行时入口
- **WHEN** 用户进入运行时入口
- **THEN** 系统 MUST 仅使用服务器已发布包
