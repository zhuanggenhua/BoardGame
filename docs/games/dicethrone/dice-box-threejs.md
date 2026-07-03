# DiceThrone 3D 骰子物理与渲染分离说明

## 目标

DiceThrone 的棋盘 3D 骰子使用 `@3d-dice/dice-box-threejs` 承接真实物理投掷、重投和预定结果，但正式 UI 不使用插件自带骰子样式。第三方插件只能作为物理状态源，前台骰子必须继续由游戏自己的渲染器负责。

当前分层：

- 第三方物理底座：`@3d-dice/dice-box-threejs`
- 本地物理适配：`src/lib/dice-box-threejs/engine.ts`
- 通用物理状态源：`src/lib/dice-physics/DiceBoxPhysicsSource.tsx`
- 通用物理/渲染契约：`src/lib/dice-physics/types.ts`
- DiceThrone 前台渲染器：`src/games/dicethrone/ui/Dice3D.tsx`
- DiceThrone 棋盘入口：`src/games/dicethrone/ui/DiceTray.tsx`
- 正式截图链：`scripts/infra/capture-dicethrone-3d-reroll-flow.ts`

## 通用分层规则

共享层只负责四类物理事实：

- 骰子 id 与结果值
- 屏幕投影位置和尺寸
- 三维姿态与运动状态
- 是否已经落定

共享层不得决定正式视觉样式。每个游戏必须能定义自己的骰子外观，包括骰面、材质、选中态、锁定态、点击层和辅助投影。DiceThrone 当前正式做法是：

- `DiceBoxPhysicsSource` 隐藏运行 dice-box-threejs，只输出 `DicePhysicsState[]`
- `DiceField3D` 接收 `physicsStates`，用 DiceThrone 历史圆角 WebGL 骰子渲染
- 插件 canvas 必须是不可见的 `physics-only` 状态，不得出现在正式截图里
- DiceThrone 选中反馈继续使用底部跟随投影的弧形光

这条规则是跨游戏约束：以后其他游戏接入物理骰子时，也只能复用通用物理状态源，不能被迫继承 DiceThrone 或 dice-box-threejs 的视觉样式。

## DiceThrone 样式规则

DiceThrone 的正式骰子样式由 `Dice3D.tsx` 和既有 DiceThrone 视觉资产决定，不再把 dice-box-threejs 默认 renderer 当成 UI。也就是说：

- 物理、碰撞、投掷、重投、位置和姿态来自 `@3d-dice/dice-box-threejs`
- 骰面、颜色基调、圆角形体、阴影、选中反馈继续使用 DiceThrone 自己的视觉语言
- 业务组件只接收通用物理状态，不直接接触第三方 mesh / material / geometry
- 棋盘 3D 选中反馈必须是骰子底部跟随投影的弧形光，不是方框、包边、整块背景、CSS ring 或描边外框。截图里只要选中骰子出现方框/包边，就视为视觉回归，不能作为收口图。

正确做法：

```ts
import { DiceBoxPhysicsSource } from '../../../lib/dice-physics/DiceBoxPhysicsSource';

<DiceField3D dice={visibleOverlayDice} physicsStates={dicePhysicsStates} scenePreset="board-topdown" />
<DiceBoxPhysicsSource dice={visiblePhysicsDice} onPhysicsStatesChange={setDicePhysicsStates} />
```

禁止做法：

- 让 `BoardDiceBoxTray.tsx` 或 dice-box-threejs canvas 成为正式棋盘 UI
- 让游戏业务层直接 `import '@3d-dice/dice-box-threejs'`
- 为某个英雄或某个骰面在组件内部临时塞第三方配置字段
- 为了保留 DiceThrone 样式，把物理投掷降级回 `Dice3D.tsx` 的自研运动学
- 直接交付 dice-box-threejs 默认数字骰样式，冒充 DiceThrone 骰子样式
- 在没核对合并期代码或历史截图的情况下，凭感觉重画骰子大小、位置、选中态或材质
- 用方框、包边、ring、高亮背景替代合并期确定的底部弧形选中光

## 物理与结果规则

- 首次投掷和重投由 `DiceBoxPhysicsSource` 驱动 `DiceBoxThreeEngine`。
- `DiceBoxThreeEngine` 通过 `getPhysicsState(index, id, settled)` 输出位置、尺寸和姿态。
- 游戏结果仍以 DiceThrone 权威状态为准；第三方引擎只负责物理表现，前端只加透明点击按钮层承接点击，点击层不得参与排版或改变骰子位置。
- 棋盘 3D 只展示未锁定骰子；一旦骰子被锁定，该骰子必须以右侧传统骰盘为真实承接位置，棋盘中的可见骰子数量随之减少。
- 锁定回右侧必须是“棋盘骰子 → 右侧传统骰盘”的真实目标动画；禁止做成在棋盘边缘淡出、消失、飞向虚拟位置，或用提示层冒充回到右侧。
- `已锁定` 这类提示只能作为独立 overlay 跟随骰子，不能写进点击层内部，更不能改变骰子点击层的宽高或位置。
- 如果要改碰撞区、重力或投影转换，优先改通用物理适配层；如果要改骰子样式、选中态或点击层，必须留在具体游戏渲染器里。

## 验证用法

在仓库根目录执行：

```powershell
npx tsx scripts/infra/capture-dicethrone-3d-reroll-flow.ts
```

输出目录：

```text
temp/dice3d-reroll-flow/
```

关键截图：

- `04-打出选任意骰子重投卡牌-选择两个骰子.png`：验证选骰反馈跟随真实 3D 投影层。
- `05-点击重投后.png`：验证重投后仍是棋盘 3D 骰子，并且位置/姿态来自真实物理重投。

视觉收口前必须先人工核图：

- 骰子必须是 DiceThrone 圆角 WebGL 样式，不是尖角平面备用骰。
- 骰面必须来自 DiceThrone 图集/皮肤，不得是 dice-box-threejs 默认数字骰。
- 选中效果必须是底部弧形光，且跟随骰子落点；不得出现方框、包边、整块背景或 CSS ring。
- 骰子必须处在棋盘中央骰台区域，大小与合并期视觉相近，不压右侧技能区。
- 截图必须是投掷完成/稳定态；中途飞行、位移中、未落稳状态不能作为最终达标图。
- 未达标候选图不得直接打开给用户；只有自检达标后，才执行真实开图动作。

验收时必须同时看：

- 前台存在 `data-testid="dice-field-3d-canvas"`
- 前台 canvas 标记 `data-dice-physics-source="dice-box-threejs"` 与 `data-dice-physics-mode="physics-only"`
- 后台存在 `data-testid="dicethrone-board-dice-physics-source"`，且它是不可见的物理源
- 骰子点击层 `data-render-mode="engine"`
- 不存在 dice-box-threejs 默认骰子或 `data-testid="dicethrone-board-dice-box-fallback"` 作为最终收口骰子层
- 截图 05 中骰子位置或姿态相对 04 有真实变化
- 关闭 3D 开关时仍走原右侧 2D 骰盘

## 文档入口

- 工具入口：`docs/tools.md` 的 “DiceThrone 3D 骰子截图链”
- 资源约束：`docs/ai-rules/asset-pipeline.md`
- UI 状态清晰约束：`design-system/game-ui/MASTER.md`
