## ADDED Requirements

### Requirement: Shared map renderer contract

系统 SHALL 为地图类游戏提供共享的 scene renderer contract，至少定义 viewport、scene geometry、interaction intent、生命周期和资源失败语义。

#### Scenario: Renderer receives canonical scene data

- **GIVEN** 游戏提供正式地图 geometry 和只读 scene read model
- **WHEN** renderer 挂载或更新
- **THEN** renderer 只消费这些数据，不通过 DOM 查询或测试选择器猜测业务坐标

#### Scenario: Renderer emits intent instead of commands

- **GIVEN** 玩家点击 Pixi 地区或 token
- **WHEN** 场景对象命中
- **THEN** renderer 发出带对象 ID 和屏幕 / 场景坐标的 interaction intent，由 React / 游戏 adapter 决定是否提交正式命令

### Requirement: Pixi map backend remains optional and scoped

系统 SHALL 允许游戏声明使用 Pixi map backend，但 Pixi MUST 只承担地图、token、路线、地图 FX 和对象级输入；规则状态、命令校验、HUD、教程状态机和产品壳仍由现有 owner 承担。

#### Scenario: Qidahen pilot uses Pixi for map scene

- **GIVEN** 七大恨启用 Pixi map backend
- **WHEN** 地图加载并交互
- **THEN** 主地图、地区 hit area、路线 / 高亮和地图 token 在 Pixi scene 中渲染，React HUD 与规则命令继续工作

#### Scenario: Other games keep current renderer

- **GIVEN** 其它游戏没有声明 Pixi backend
- **WHEN** 游戏进入对局
- **THEN** 系统继续使用其现有 renderer，不因共享 contract 的存在强制迁移

### Requirement: Single viewport truth

地图 renderer SHALL 与 React / mobile shell 共享唯一的 viewport state；本地逐帧 transform MAY 存在，但 MUST NOT 形成第二套业务 viewport 真相。

#### Scenario: Drag and inertia update one camera state

- **GIVEN** 玩家在地图上拖拽并松手
- **WHEN** renderer 执行拖拽和惯性
- **THEN** 场景实时更新，最终 viewport 通过正式 contract 回传，教程聚焦和移动端坐标读取同一份 pan / zoom

#### Scenario: Reduced motion disables inertial motion

- **GIVEN** 用户启用了 `prefers-reduced-motion`
- **WHEN** 地图发生拖拽或缩放
- **THEN** renderer 不播放惯性或缓动，只执行即时变换并保持命中坐标正确

### Requirement: Migration preserves user-visible map contracts

Pixi 试点 SHALL 保留地区选择、token 选择、教程目标、相机聚焦、资源失败可见性和行为型 E2E 入口；旧 DOM/SVG/canvas path 只有在新 path 完成同入口验证后才可删除。

#### Scenario: Tutorial source and target remain readable

- **GIVEN** 教程需要提示来源地区、目标地区和路线
- **WHEN** Pixi scene 播放教程高亮
- **THEN** 玩家在同一屏幕中能识别来源、目标、路线和下一步动作，且存在可验证的稳定态

#### Scenario: Asset failure is explicit

- **GIVEN** 地图或 token 纹理加载失败
- **WHEN** Pixi loader 返回错误
- **THEN** 系统展示明确错误 / 正式回退状态，不静默渲染空白对象
