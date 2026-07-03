## ADDED Requirements
### Requirement: Dice Physics State Source
系统 SHALL 支持骰子物理状态源与最终可见渲染分离；物理状态源只负责提供骰子的运动、位置、姿态、尺寸、落定状态与命中投影，不得强制决定游戏最终展示的骰子样式。

#### Scenario: Game renders its own dice from physics state
- **GIVEN** 一个游戏已经定义自己的骰子视觉、骰面资源和选中态
- **WHEN** 该游戏启用通用骰子物理状态源
- **THEN** 游戏 MUST 能使用物理状态中的位置、姿态和落定信息驱动自己的渲染器
- **AND** 第三方物理插件的默认骰子材质、形状和数字样式 MUST NOT 替换该游戏的已定义视觉

#### Scenario: Physics source exposes settled state without owning visuals
- **GIVEN** 物理状态源完成一次投掷或重投
- **WHEN** 游戏 UI 读取骰子状态
- **THEN** 状态 MUST 包含每颗骰子的屏幕投影、三维旋转、运动中/落定状态和建议点击尺寸
- **AND** UI MAY 使用这些状态渲染任意游戏自定义骰子样式

### Requirement: Game Dice Renderer Contract
系统 SHALL 为游戏层提供骰子渲染器契约，使每个游戏可以定义自己的骰子外观、骰面贴图、选中态、锁定态、尺寸规则与点击承接方式。

#### Scenario: Different games keep different dice styles
- **GIVEN** 两个游戏分别定义了不同的骰子样式
- **WHEN** 它们启用同一个物理状态源
- **THEN** 每个游戏 MUST 仍显示自己的骰子外观
- **AND** 通用物理层 MUST NOT 把某个游戏或某个插件的样式变成全局默认

#### Scenario: DiceThrone preserves approved rounded dice style
- **GIVEN** DiceThrone 已有经确认的圆角 3D 骰子样式和选中投影
- **WHEN** DiceThrone 使用物理状态源驱动棋盘骰子
- **THEN** 可见骰子 MUST 保持 DiceThrone 的圆角骰子、骰面资源、尺寸与选中态
- **AND** 不得回退到第三方插件默认硬立方体或默认数字骰样式

### Requirement: Third-Party Dice Physics Adapter Boundary
系统 SHALL 将第三方骰子物理插件封装为适配器；适配器可以提供物理结果，但其默认 renderer 只能作为调试或内部层，不能作为跨游戏交付视觉。

#### Scenario: Third-party renderer remains hidden for production UI
- **GIVEN** 一个物理插件自带 renderer
- **WHEN** 游戏使用该插件作为物理状态源
- **THEN** 项目 MUST 能隐藏或隔离插件自带 renderer
- **AND** 用户可见层 MUST 由游戏注册的骰子渲染器负责

#### Scenario: Plugin renderer can be used only as debug evidence
- **GIVEN** 开发者需要排查物理碰撞或落点
- **WHEN** 打开调试模式
- **THEN** 插件 renderer MAY 作为调试证据显示
- **AND** 该调试画面 MUST NOT 被标记为正式 UI 验收截图
