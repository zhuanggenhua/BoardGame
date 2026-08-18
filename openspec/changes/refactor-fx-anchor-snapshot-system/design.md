## Context
当前引擎 FX 层提供 cue 注册、并发预算、反馈包、统一帧时钟和 React/backend 渲染入口，但坐标来源仍分散在游戏 renderer 里：

- 棋盘型游戏通常从 `cell` 算格子百分比，再临时读 DOM 来修正对象中心。
- 牌桌型游戏通常直接传 screen 坐标或由游戏私有 UI 计算。
- renderer 在播放阶段仍可能访问业务 DOM，导致对象已移除、重排或响应式变化时，特效位置和生命周期不稳定。

游戏引擎常见做法是：FX manager 在 spawn 时拿到世界 / 局部坐标，创建独立 effect actor；actor 播放期间不再依赖被命中的对象是否仍存在。只有持续光环、buff、附件等才显式绑定 transform 并跟随。

本项目不照搬 Unity 的组件模型，但需要吸收这条边界：**一次性特效消费 spawn-time snapshot，持续特效才 tracking**。

## Final Design Decision

最终选择：**Web 原生 FX Surface + Anchor Snapshot 系统**。

实现上保留现有 `FxBus`、`FxLayer`、FeedbackPack、FrameClock 和共享 preset，不引入 Unity / Unreal / Godot / Phaser，也不把 React UI 重建成完整游戏场景图。新增的只是一个轻量表现系统合同：

- 游戏 UI 注册可见对象锚点到某个 `FxSurface`，例如棋盘、牌桌、玩家托盘或 UI overlay。
- FX 生成时把来源 / 目标锚点解析成 surface-local 的不可变 `FxAnchorSnapshot`。
- 一次性 FX 只读 spawn snapshot，播放期间不再追业务 DOM。
- 持续附着 FX 必须显式声明 `tracking`，并声明宿主消失后的生命周期策略。
- renderer / preset 只消费快照和调参，不知道 Mage Wars、Smash Up 或其它游戏的 DOM 结构。

参考取舍：

- **主要实现参考**：Phaser / Godot 的轻量场景对象、container-local / node-local 坐标和显式粒子跟随模型，因为它们最接近当前 Web / React 游戏形态。
- **只作为边界校验**：Unity / Unreal 的 one-shot spawn 与 attached tracking 分离，用来确认设计方向，不作为本项目实现模板。
- **不采用**：完整外部引擎、完整场景图、renderer 播放时 query DOM、全局 screen 坐标兜底、每个游戏各写一套坐标系统。

## Goals
- 建立跨游戏通用的 FX surface 模型，兼容棋盘格、牌桌区域、屏幕坐标和 UI overlay。
- 建立 anchor registry，让游戏 UI 能注册“实体 / 卡牌 / 基地 / 法师 / 单位 / token / 附件槽”的可见锚点。
- 在 `fxBus.push` 前或 push 入口内部生成不可变 `FxAnchorSnapshot`。
- 让共享 renderer / preset 只消费坐标快照，不再直接查业务 DOM。
- 保持现有 `FxBus`、`FxLayer`、FeedbackPack、FrameClock 和 Canvas / Shader 组件可复用。
- 用 Mage Wars 和 Smash Up 分别证明“有地图”和“无地图”两种模式都能接入。

## Non-Goals
- 不改变领域 pipeline 的同步结算原则。
- 不把 React 布局系统替换成完整游戏场景图。
- 不要求所有游戏一次性迁移。
- 不把纯阅读型卡牌特写改成 FX。

## Decisions

### Decision: 新增 `FxSurface`，不把所有坐标都叫 `cell`
理由：
- Mage Wars / Summoner Wars 需要棋盘本地坐标。
- Smash Up / Dice Throne 可能没有棋盘格，但仍有牌桌、基地列、玩家托盘、骰盘等本地坐标空间。
- `screenPos` 可以保留，但不能成为无地图游戏的唯一正式路径。

方向：
- `FxSurfaceId` 标识一个 FX root，例如 `arena`, `table`, `player-tray`, `screen-overlay`。
- 每个 surface 提供 root DOM / backend host 与坐标转换能力。
- `FxAnchorSnapshot` 记录 `surfaceId`、`box`、`center`、`size`、`anchorKind`、`entityRef`、`capturedAt` 等最小信息。

### Decision: 一次性 FX 默认使用 spawn snapshot
理由：
- 攻击、召唤、飞行、命中、销毁、VP 飞行等效果的开始点和结束点应在事件生成时稳定。
- 对象被规则移除后，命中爆发仍应打在刚才对象所在的可见本体位置，而不是退回格子中心。

方向：
- `fxBus.push` 支持 `anchors` 输入，或由游戏事件消费层先调用 resolver 生成 `params.sourceSnapshot / targetSnapshot`。
- renderer 只消费 snapshot；如果 snapshot 缺失，必须显式失败或使用被声明的降级策略，不能静默 retarget 到格子中心。

### Decision: tracking 是显式模式，不是默认模式
理由：
- 默认跟随 DOM 会让一次性特效受响应式、列表重排、对象死亡、密排补位影响。
- buff、光环、持续附件、蓄力环这类效果确实需要跟随宿主，但它们必须有不同生命周期。

方向：
- `FxAnchorMode = 'spawn-snapshot' | 'tracking'`。
- `tracking` renderer 可以订阅 anchor registry 更新。
- 对象销毁时，tracking FX 必须通过 lifecycle 策略决定完成、转移或结束。

### Decision: 游戏层注册锚点，引擎层解析坐标，renderer 层只播放
理由：
- 业务 UI 最知道哪个 DOM 代表“对象本体”“附件槽”“基地”“VP 托盘”。
- 引擎层负责把这些锚点转换成 surface-local snapshot。
- renderer 不能知道 Mage Wars 的 `[data-object-id]` 或 Smash Up 的基地 DOM 结构。

方向：
- 提供 `useFxAnchorRegistry(surfaceId)` 或等价 hook。
- 游戏组件用统一 API 注册锚点，而不是让 renderer 用 querySelector。
- 迁移后游戏 renderer 文件只做 cue → preset 参数适配。

### Decision: 视觉保留仍存在，但职责下沉为 lifecycle
理由：
- snapshot 能解决“命中位置”稳定问题，但销毁 / 离场动画仍需要在画面上保留对象影子或 held object。
- 该能力不应是 Mage Wars 私有补丁。

方向：
- 将“对象离场前快照 / held visual”作为视觉生命周期能力登记到 FX / visual events 边界。
- 一次性 FX 可只依赖坐标 snapshot；需要对象本体参与碎裂 / 摧毁 / 震动时，使用 held visual。

## Compatibility
- Mage Wars / Summoner Wars：surface 是棋盘或竞技场，entity anchor 可以落到单位、法师、附件槽或区域。
- Smash Up：surface 是牌桌或基地列，entity anchor 可以落到基地、仆从、行动卡、弃牌堆、VP 计分区、玩家面板；不要求存在 row/col。
- Dice Throne：surface 可以是玩家面板、骰盘、技能卡区域或屏幕 overlay。
- 无 UI anchor 的系统事件仍可用 screen/ui snapshot，但必须显式声明这是 UI 层特效。

## Risks / Trade-offs
- DOM 测量时机不稳定。
  - 缓解：anchor snapshot 只能在 surface root 已布局后生成；E2E 覆盖首帧和 responsive 变化。
- API 过重导致游戏不愿接入。
  - 缓解：第一版只提供 box/center snapshot、surface id、spawn/tracking 两种模式，不做完整场景图。
- 迁移期间新旧坐标并存。
  - 缓解：提供 compatibility adapter，但新 renderer 不得新增业务 DOM 查询。

## Migration Plan
1. 定义 `fx-rendering-system` spec。
2. 在引擎 FX 层新增 surface / anchor / snapshot 类型与最小 hook。
3. 改共享 preset 消费 snapshot，保留旧 `cell` adapter 作为迁移层。
4. 迁移 Mage Wars 召唤、攻击、推斥、传送、直接伤害链路。
5. 迁移 Smash Up 至少一条无地图牌桌 FX 链路，例如基地 / 卡牌 / VP 飞行锚点。
6. 更新动效规范和视觉事件规范。
7. 通过单测与聚焦 E2E 后，再逐步迁移其它游戏。

## Open Questions
- 第一版 snapshot 是否只支持 DOM surface，还是同时给 Canvas/backend surface 留接口？
- Smash Up 第一条迁移链路选 VP 飞行、力量飘字，还是行动卡展示？
- 旧 `ctx.cell` 是否立即标记 legacy，还是保留为棋盘 adapter 的正式输入？
