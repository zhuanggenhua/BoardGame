## Context
DiceThrone 的棋盘 3D 骰子证明了“物理引擎 renderer”和“游戏视觉合同”不能绑定。第三方物理插件适合提供碰撞、重投轨迹、落点和姿态，但它的默认硬立方体样式不能覆盖每个游戏自己的骰子美术。

## Goals
- 建立跨游戏可复用的骰子物理状态源契约。
- 允许每个游戏保留自己的骰子渲染器与视觉规则。
- 让 DiceThrone 后续能同时拥有真实物理感与历史圆角骰子样式。

## Non-Goals
- 不在共享层定义统一骰子美术。
- 不要求所有游戏一次性迁移。
- 不把 dice-box-threejs 的默认 renderer 当正式交付 UI。

## Decisions
- Decision: 物理层输出数据，渲染层由游戏注册或传入。
  - Reason: 游戏骰子样式差异大，DiceThrone 已有明确视觉合同。
- Decision: 第三方插件 renderer 默认隐藏或仅作调试层。
  - Reason: 插件默认视觉不等价于项目内游戏美术。
- Decision: DiceThrone 作为首个落地案例，但共享类型不得写死 DiceThrone 字段。
  - Reason: 该能力需要给后续骰子游戏复用。

## Risks / Trade-offs
- 物理状态到游戏渲染器的坐标/旋转映射可能需要校准。
  - Mitigation: 保留屏幕投影、世界姿态和建议尺寸三类数据，E2E 同时验收稳定态与截图。
- 隐藏插件 renderer 后调试物理会变难。
  - Mitigation: 保留显式 debug renderer 模式，但不作为正式验收证据。
