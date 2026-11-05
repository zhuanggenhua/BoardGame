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

### Requirement: Mixed scene layers share the displayed transform

系统 SHALL 使 Pixi 与保留的 DOM 地图对象在过渡中消费同一实际显示变换，命中、路线、token 和教程锚点 MUST 同帧对齐。目标相机与平滑显示相机 MAY 分开计算，但 MUST NOT 分别驱动同屏地图对象。固定 HUD MUST NOT 随场景平移缩放。

#### Scenario: Inertial middle frame keeps tokens aligned

- **GIVEN** 地图仍同时包含 Pixi 地区及 DOM token/路线
- **WHEN** 拖动或缩放处于中间帧
- **THEN** 地区、token、路线和命中使用同一显示投影，不能只在停稳后对齐
- **AND** 固定手牌和任务提示保持界面锚点

### Requirement: Map gestures preserve decision state

系统 SHALL 分离相机查看与对象选择权限，确保一次手势仅有一个输入 owner。拖动 MUST NOT 在结束后触发选择；检视关闭 MUST 保留镜头及仍合法的选择。满载部署时当前目标与主操作区 MUST 可读可点。

#### Scenario: Disabled selection still permits map inspection

- **GIVEN** 当前阶段禁止地区提交但允许查看地图
- **WHEN** 玩家拖动并滚轮缩放
- **THEN** 地图仍响应查看，既不提交地区动作也不叠加处理一次滚轮

#### Scenario: Close inspection returns to the same deployment

- **GIVEN** 玩家调整镜头并选择了合法部署对象后打开详情
- **WHEN** 关闭详情且规则状态未变化
- **THEN** 原镜头和部署选择保留，目标仍可操作，不新增重复提交入口

### Requirement: Performance promotion requires comparable evidence

系统 MUST 在同代码、同入口、同状态、同视口和同资源门禁下比较旧路径与试点路径，记录用户可感知延迟及直接性能指标。隐藏 legacy 层 MUST NOT 被报告为卸载；无法采集的指标 MUST 标为未测。

#### Scenario: Hidden legacy layer is not a completed migration

- **GIVEN** 旧地图节点仍挂载但设为不可见
- **WHEN** 评估试点性能与迁移完成度
- **THEN** 记录仍有的旧消费者和开销，不把视觉隐藏当作退出生命周期
- **AND** 只有实际消费者迁移、资源状态及交互验收完成后才卸载旧层
