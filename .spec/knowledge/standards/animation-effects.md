---
name: animation-effects
description: 动画与特效标准：FX、Shader、反馈包和性能边界——改视觉特效或动画系统时查
metadata:
  type: doc
  status: 已交付
---

# 动画与特效规范

本文件规定动画 / FX 的职责边界、技术选型、运行时架构和验收口径。引擎层表现与逻辑分离、数值冻结、实体保留和 EventStream 时序见 [`engine-visual-events`](engine-visual-events.md)。

## 基本原则

- 规则状态同步结算，表现层按动画节奏展示；动画不能写正式 HP、资源、骰面、区域或其它权威状态。
- 新增或重写动效先复用 `src/engine/fx/`、`src/components/common/animations/` 和现有 `fxSetup.ts` 适配模式；游戏侧只做参数、cue、锚点和规则语义适配。
- 特效必须由具体规则事件触发。不要把“能力 / 施法 / 结算”这类泛词直接映射成大特效；来源、目标、结果和反馈对象必须可解释。
- 治疗、恢复、增益、状态移除、资源返还等正向结果只要承担玩法证据，也必须由具体规则结果事件触发可见反馈；优先复用共享 FX / preset，不能只靠数值静默变化、日志或最终截图证明。
- 成熟共享组件默认保持旧消费者视觉等价。当前游戏需要差异时，在当前游戏配置传参或新增命名明确的 preset / renderer。
- 视觉信息不要复读：牌面、附件槽、token、状态图标已经表达的信息，不再用额外文字或大特效重复解释。

## 技术选型

| 需求 | 默认技术 | 边界 |
| --- | --- | --- |
| UI 进出场、hover、简单位移 / 缩放 / 透明度 | framer-motion / CSS | 少量 DOM 节点，非逐帧绘制 |
| 粒子、爆发、烟尘、召唤光粒 | Canvas 2D 粒子 / 自研动画组件 | 几十到几百粒子，需生命周期和预算 |
| 复杂轨迹、多阶段爆发、柔和气流 | Canvas 2D | 每帧重绘，但不需要逐像素 shader |
| 旋涡、火焰、护盾、溶解等流体效果 | WebGL Shader | 需要逐像素计算；必须有降级策略 |
| 精确美术逐帧动画 | Lottie 或素材驱动方案 | 只有已有素材和接入需求时使用 |

暂不把 PixiJS / Phaser / Cocos 作为默认特效后端。若某个游戏确实要引入外部渲染器，必须先写清它替代哪些 Board / FX 职责、如何接入状态与输入命令、如何回退和压测。

## FX 架构

- `FxCue`：分层 cue 名，例如 `fx.summon`、`fx.combat.hit`。
- `FxRegistry`：cue 到 renderer 的映射，精确匹配优先于通配符。
- `FxBus`：push / sequence / cancel 的运行时队列，负责并发上限、防抖和安全超时。
- `FxLayer`：统一渲染层，消费 registry 并触发 `onImpact` / `onComplete`。
- `FxRenderer`：把事件参数映射到底层动画组件 props。
- `FeedbackPack`：声明同一个 cue 的视觉、音效和震动反馈。
- `FxSurface` / `FxAnchorSnapshot`：注册真实可见对象锚点，并在 FX 生成时冻结来源 / 目标坐标。

新增游戏或新增主特效的默认接入工作量是：注册 surface / anchor，声明 cue、参数和 tuning；不得新建游戏私有坐标系统、动画总线或 DOM 查询框架。

## 坐标与锚点

- Board / table UI 通过共享锚点注册入口暴露可见对象：棋盘对象、卡牌、token、玩家面板、计分区、附件槽等。
- 一次性 FX 在 push 前捕获 `sourceSnapshot` / `targetSnapshot`；播放期间只读快照，不再查询业务 DOM。
- renderer 不得用 `querySelector`、私有 `data-testid` 或业务 DOM 结构临时找位置。
- 缺少必要快照时必须 fail-close：跳过、诊断或使用已声明 legacy adapter；禁止静默退回整格中心、牌桌中心、最近对象或随机屏幕坐标。
- 持续光环、buff、蓄力等跟随宿主的效果必须显式声明 tracking 策略；投射、命中、召唤、飘字不得隐式切成 live tracking。

## 时序与反馈

- 有冲击帧的动画，音效和震动必须在 `onImpact` 或等价关键帧触发；不要在事件生成时提前播放。
- 使用 `FeedbackPack` 时，如果 `timing: 'on-impact'`，renderer 必须调用 `onImpact`；否则音效 / 震动会静默丢失。
- 反馈是否触发若依赖运行时状态，由调用侧或拆分后的 cue 编排；不要把复杂条件塞进通用 FeedbackPack。
- 多步骤规则效果使用 FX sequence 顺序播放，例如“移除对象 -> 造成伤害 -> 离场”；不要并行 push 后让玩家看到同时发生。
- 条件渲染特效必须由组件自身 `onComplete` 关闭；不要用固定 timer 猜动画结束时间。

## 视觉实体与数值

- 数值变化动画使用 `useVisualStateBuffer`：正式值先进入 core，UI 用缓冲显示动画前值，impact 后释放回正式值。
- 对象已从规则状态移除但画面仍需参与命中、碎裂、飘字或离场时，使用 `useVisualEntityBuffer`；不要在游戏 hook 里复制私有 `dying / held` 状态。
- live list 中仍存在的对象不得再渲染 held visual，避免同帧重影。
- 同一对象被多个 FX owner 持有时，任一 owner 完成只能释放自己的持有权；最后一个 owner 释放后对象才退场。

## 表现质量

- 特效尺寸和锚点必须贴合本次反馈对象的可见本体，不默认贴整格、整行、整屏或参考游戏截图。
- 来源和目标都应可见。结果骰、伤害数字、徽章或飘字不得压住正在证明的来源、目标或合法交互对象。
- 召唤、攻击、投射、对象移动、翻页、拖拽等连续动效验收优先短录屏 / GIF；关键帧截图只作 AI 自检和证据索引。
- 对象转移、抽走、击败或收入另一区域时，原区域必须有离场承接；不能让对象瞬间消失后只在目标区播放进入动画。
- 信息揭示动效只用于从隐藏 / 未知变公开的对象；已公开对象不得重新播放翻开 / 揭示制造假信息变化。
- 外部参考动效必须先拿动态证据，并拆成动作语法：触发源如何醒目、路径 / 能量是否存在、目标本体如何变化、是否有后续连环触发。
- 颜色来自参考帧证据或项目语义色；不能用“更有游戏感”随意添加高饱和随机色。

## 性能边界

- 新增特效前先写清玩家可见语义和成本来源：渲染数量、布局测量、绘制属性、图片 / shader 预热、跨组件刷新。
- 性能优化只能减少真实工作量、隔离重渲染、使用合成属性、预热资源或改渲染载体；改变强度、节奏、时机、位置或可见对象属于表现变更。
- Canvas、WebGL、粒子和投射物路径接入共享 FX 帧时钟；普通 React UI 反馈、hover、glow、轻量 timer 不把 FX 帧时钟当通用 `setTimeout`。
- 优先动画 `transform`、`opacity`、必要时 `filter`；避免 `transition-all`、频繁动画 `border-*`、`box-shadow` 和布局属性。
- `transition` 与 `@keyframes` 不要同时控制同一属性；同一元素只能有一个权威动画源。
- 毛玻璃保持静态，若要动效只动遮罩层透明度，不反复改变 blur 半径。

## Canvas 与 Shader

- 棋盘层粒子使用俯视角物理：平面扩散、减速、淡出；不要默认重力下坠。全屏庆祝和 UI 装饰层可使用符合屏幕直觉的重力模型。
- 棋盘层 Canvas 特效取布局尺寸优先 `offsetWidth / offsetHeight`；`getBoundingClientRect()` 会受父级 transform 缩放影响。
- 特效 Canvas 天然可能超出挂载目标，默认不要用 `overflow: hidden` 裁切主体表现。
- Shader 组件负责注册、预编译、uniform 映射和 WebGL 降级；游戏侧只注册 cue 和参数。
- 浏览器不支持 WebGL 时，shader 效果必须自动完成或降级，不能卡住规则流程。

## 通用组件

- 通用特效放 `src/components/common/animations/`；游戏特有语义只通过 props、tuning、cue 或素材注入。
- 受击反馈优先使用通用 `useImpactFeedback` 或同层原子 hook；不要在单个 Board 里手写多套 `useState + setTimeout`。
- 游戏侧 FX renderer 只做适配。若主效果算法出现在 `Board.tsx`、游戏私有 CSS 或游戏私有 timer，默认先判职责放错层。
- 新增通用特效或 preset 后，同步 devtools 预览入口；不能只导出组件就声称进入特效库。

## 验收

- 技术存在性不是视觉通过。`data-testid`、canvas 存在、事件被消费、截图落盘只证明链路触发。
- 验收证据必须来自真实运行入口，并能肉眼看到主体表现、来源、目标、过程、命中 / 结果和稳定态。
- 空画布、弱到不可辨的像素、只露最终态、对象被反馈层遮住、重影、假揭示、瞬移和残留 ghost 都判不达标。
- 若用户要求看实际效果，最终展示走项目看图 / 看视频入口，并使用已通过 AI 图面核验的录屏或截图。
