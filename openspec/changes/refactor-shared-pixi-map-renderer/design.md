## Context

BoardGame 的游戏逻辑已经由 DomainCore + Pipeline 承担，React 负责页面组合和 UI 状态，但地图类游戏的表现层仍混合了多种坐标和输入实现。当前七大恨的 `MapSceneLayer` 同时渲染主地图、SVG 路线、透明 canvas 像素命中、React token、教程锚点和区域信息提示；外层 `ZoomPanViewport` 再负责 CSS transform、拖拽、缩放和聚焦。这个结构可以交付有限对象数量的地图，但继续增加 token、路线、粒子和对象级动画时，输入延迟、重渲染和坐标漂移风险会叠加。

参考站采用 PixiJS 8 场景图和 `@pixi/react`，把可视地图对象放在同一个 world container 中，以 `eventMode="static"` 做对象级命中，用 ticker 驱动相机缓动 / 惯性，并通过 render group 降低大量子对象的变换成本。该实现证明的是职责划分和运行时能力，不证明它可以直接替换 BoardGame 的规则、HUD 或测试合同。

## Goals / Non-Goals

### Goals

- 让地图、路线、token、地图 FX 和相机共享一个场景坐标系。
- 让高频拖拽 / 惯性不再依赖每个 pointer sample 的 React render。
- 保留现有 DomainCore、命令、教程状态机、React HUD 和移动端壳层职责。
- 让未来新游戏可以复用同一套 renderer contract，而不是复制 Qidahen 私有实现。
- 用七大恨真实入口证明可交互、可聚焦、可回退、可测试和可观测。

### Non-Goals

- 不承诺 Pixi 对所有 UI 或所有游戏都更快。
- 不在本 change 内把所有现有游戏一次性迁移到 Pixi。
- 不引入 Phaser、Cocos 或另一套完整游戏引擎。
- 不通过隐藏 DOM、影子状态或双写事件维持永久兼容。

## Decisions

### Decision 1：采用混合架构，不采用全量 Pixi 化

```text
React：规则状态、HUD、按钮、教程文案、可访问性补充、命令 wiring
Pixi：地图背景、地区 hit area、token、路线、高亮、地图 FX、场景相机
DomainCore：validate → execute → reduce → systems
```

原因：Pixi 适合高频 2D 场景和对象级命中；React 更适合面板、文字、表单、可访问性和产品壳。混合边界可以把性能收益集中在地图，同时保留已有行为合同。

### Decision 2：以正式 contract 连接 React 与 Pixi

现有 `GameBoardRenderer` / `BoardBridge` 是整块 Board 的 imperative renderer seam，不能因为已经有 `engine: 'pixi'` 字段就把它扩大成地图 renderer。七大恨需要保留 React HUD、教程和命令 wiring，因此本 change 新增独立的 `MapSceneRenderer` owner；整块 Board renderer 继续保持现有语义。

建议的共享类型职责如下：

| 合同 | 旧承载 | 新承载 | 验证 |
| --- | --- | --- | --- |
| 地图视觉 | DOM image / SVG / canvas | `PixiMapScene` world container | 同入口截图与像素定位 |
| 地区命中 | canvas 像素检测 + DOM 事件 | Pixi `Graphics` / hit area `eventMode="static"` | 地区选择 E2E |
| token 点击 | React token DOM | Pixi token display object | token 选择 / 调度 E2E |
| 路线 / 高亮 | SVG path / DOM guide anchor | Pixi route layer / highlight layer | 教程中间帧与稳定态 |
| 相机 | `ZoomPanViewport` CSS transform | `MapViewportState` + Pixi world transform | 拖拽、缩放、惯性、聚焦 |
| 规则动作 | Board handler | React handler 接收 `MapInteractionIntent` | 命令与最终状态 |
| HUD / 提示 | React | React 保留 | 视觉与无障碍验收 |
| 资源失败 | 图片加载层 | Pixi asset loader error surface + React 状态 | 失败可见、无静默空图 |

`MapInteractionIntent` 只描述用户意图（如 `select-region`、`select-token`、`hover-region`），不直接修改领域状态。React 仍是命令 owner，Pixi 不知道具体游戏命令名。

### Decision 3：只保留一个相机真相源

地图容器、Pixi world、教程聚焦和移动端壳层必须使用同一份逻辑视口：

```ts
type MapViewportState = {
  zoom: number;
  panX: number;
  panY: number;
};
```

渲染器可以在本地逐帧应用 transform，但不能生成第二份业务 viewport。React 只在需要同步、聚焦或持久化时读取最终状态。`prefers-reduced-motion` 必须让惯性和缓动退化为即时变换。

### Decision 4：几何来自游戏作者源，Pixi 不自行猜坐标

地区边界、token 锚点、路线拓扑和教程目标继续来自 Qidahen 的正式 geometry / runtime read model。Pixi 只把它们投影为 `Graphics`、`Sprite` 或 `Container`。禁止在 renderer 中通过 DOM 查询、测试选择器或私有 CSS 结构反推坐标。

### Decision 5：先迁移可证明的场景层，再删除旧实现

第一阶段接管主地图、地区 hit area、路线 / 高亮和 token；React 继续保留区域 tip、选择 banner、教程文字和命令提交。只有同一真实入口覆盖桌面、移动、缩放拖拽、惯性、教程聚焦、对象命中、资源失败和 E2E 选择器后，才允许删除旧 DOM/SVG/canvas path。

现有 `CriticalImageGate` 只证明 React 图片链路，不能自动证明 Pixi texture 已 ready；Pixi renderer 必须把纹理 ready / failure 接回同一个资源状态合同。现有 `MapToken` 还承担 `role="button"`、ARIA、tabIndex 和键盘行为，纯 canvas 替换会直接丢失这些用户可见合同，因此试点必须保留 DOM accessibility bridge 或正式的键盘区域列表。

## Contract Ledger

迁移前必须逐条记录以下旧合同：

1. 玩家在地图上点地区时，最终提交现有 `onSelectRegion` 语义。
2. 玩家点 token 时，保留当前 pending committed troop / 调度选择语义。
3. 教程高亮同时表达来源、目标、路线和动作，且中间帧可见。
4. 自动聚焦在移动端壳层缩放下仍把目标投到正确屏幕位置。
5. 地图资源加载失败时有可见错误或正式回退，不得静默空白。
6. 现有 E2E 选择器能定位地图 host、缩放、平移、区域结果和教程目标；迁移后选择器面向行为合同，不面向旧 DOM 结构。

## Alternatives Considered

### A. 继续优化 DOM/SVG/canvas

风险最低，可以继续改善 `ZoomPanViewport` 和 React 更新节流，但地图对象仍分散在多层，路线、命中和 token 仍然需要同步坐标。适合作为当前版本止血，不适合作为未来新游戏的统一底座。

### B. 所有游戏一次性改成 Pixi

表面上统一，实际上会同时触发 HUD、教程、移动端壳层、测试选择器和资源加载迁移。没有一套经过真实入口验证的 contract 时，回归面不可控。

### C. 共享 contract + Qidahen 试点（推荐）

先把真实地图职责收敛到一个新 renderer owner，再以四类证据决定是否推广：交互正确性、视觉 / 教程、性能指标、维护复杂度。失败时可以只撤回试点 renderer，不影响其它游戏。

## Risks / Trade-offs

- Pixi 不是 DOM，直接依赖 `querySelector` 的旧测试和无障碍语义需要迁移。
- 现有 Qidahen 移动 E2E 有一部分直接导入 `Board.tsx`，只会覆盖 React 路径；真实 renderer 入口必须补进同一套测试，否则会出现“旧路径通过、新路径未测”。
- WebGL/WebGPU 初始化、纹理加载和 context loss 需要正式错误路径。
- React 与 Pixi 双运行时仍有边界成本；如果把规则或 HUD 迁入 Pixi，复杂度会扩大。
- 大地图纹理、透明层和过多 `Graphics` 仍可能成为 GPU / fill-rate 瓶颈，需要真实 trace，不凭引擎名称宣称更快。

## Migration Plan

1. 建立 proposal、contract types 和 Qidahen geometry adapter。
2. 引入依赖，挂载独立 `PixiMapScene` host，先只渲染背景和一个可点击地区。
3. 逐层接入路线、高亮、token、教程聚焦和相机；每步保留行为合同测试。
4. 跑真实 Qidahen 桌面 / 移动 E2E 与性能基线，修复坐标和输入回归。
5. 通过验收后切换默认 renderer；再删除旧路径中不再有消费者的入口。
6. 把 contract 和试点结果固化为未来新游戏模板，后续游戏默认从 Pixi scene adapter 开始。

## Open Questions

- Pixi 依赖是否固定到参考站的 `pixi.js 8.2.6`，还是选择当前仓库统一验证后的 8.x patch 版本？
- 首轮是否要求保留键盘可达的 DOM region list，还是先以 React tip / banner 满足当前产品无障碍合同？
- 地图 FX 是否在本 change 内接入 Pixi，还是先保留现有 FxLayer 并仅验证地图 scene？
