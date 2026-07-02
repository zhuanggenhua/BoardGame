# DiceThrone 3D 骰子接入说明

## 目标

DiceThrone 的棋盘 3D 骰子使用 `@3d-dice/dice-box-threejs` 承接真实物理投掷、重投和预定结果，但项目业务层不能直接散连第三方内部类、事件名或配置字段。

当前分层：

- 第三方物理底座：`@3d-dice/dice-box-threejs`
- 本地薄适配：`src/lib/dice-box-threejs/engine.ts`
- DiceThrone 样式 profile：`src/games/dicethrone/ui/diceBoxStyleProfiles.ts`
- DiceThrone 骰面皮肤：`src/games/dicethrone/ui/diceThroneDiceBoxSkins.ts`
- DiceThrone 棋盘入口：`src/games/dicethrone/ui/BoardDiceBoxTray.tsx`
- 正式截图链：`scripts/infra/capture-dicethrone-3d-reroll-flow.ts`

## 样式扩展规则

3D 骰子的材质、重力、灯光等环境样式必须通过 `DiceBoxStyleProfile` 扩展，不允许在业务组件里直接写第三方配置字段。

DiceThrone 的骰面不能使用 dice-box-threejs 默认数字样式。骰面必须通过 `diceThroneDiceBoxSkins.ts` 从现有 DiceThrone 骰子图集中生成 1-6 面贴图，再由 `DiceBoxThreeEngine.setDieSkins()` 写入 dice-box-threejs 创建出的真实骰子材质。也就是说：

- 物理、碰撞、投掷、重投、位置和姿态来自 `@3d-dice/dice-box-threejs`
- 骰面、颜色基调、选中反馈继续使用 DiceThrone 自己的视觉语言
- 业务组件只传骰子定义和本地 profile，不直接接触第三方 mesh / material / geometry

正确做法：

```ts
import type { DiceBoxStyleProfile } from '../../../lib/dice-box-threejs/engine';

export const DICETHRONE_DICE_BOX_STYLE_PROFILE = {
  id: 'dicethrone-board-classic',
  surface: 'green-felt',
  colorset: 'white',
  texture: '',
  material: 'plastic',
  customColorset: {
    name: 'dicethrone-board-parchment',
    foreground: '#2b1a0a',
    background: ['#fff1c2', '#d7a44d', '#f5df9a', '#8f5b22'],
    outline: '#fff3c2',
    texture: 'none',
    material: 'plastic',
  },
} satisfies DiceBoxStyleProfile;
```

业务组件只传本地 profile：

```ts
await DiceBoxThreeEngine.create(container, {
  styleProfile: DICETHRONE_DICE_BOX_STYLE_PROFILE,
});
```

禁止做法：

- 在 `BoardDiceBoxTray.tsx` 里硬编码 `theme_surface` / `theme_material` / `theme_texture` / `theme_customColorset`
- 让游戏业务层直接 `import '@3d-dice/dice-box-threejs'`
- 为某个英雄或某个骰面在组件内部临时塞第三方配置字段
- 为了让截图好看，把物理投掷降级回 `Dice3D.tsx` 的自研运动学
- 直接交付 dice-box-threejs 默认数字骰样式，冒充 DiceThrone 骰子样式

## 物理与结果规则

- 首次投掷用 `rollToValues(values)`，内部转成 `Xd6@...` 预定结果。
- 重投用 `rerollToValues(indices, values)`，必须走 dice-box-threejs 的 `reroll()` 改变位置/姿态；重投完成后再把 DiceThrone 权威结果写回骰面，不能只改 DOM 位置或只换骰面。
- 游戏结果仍以 DiceThrone 权威状态为准；第三方引擎只负责物理表现和可点击投影层。
- 棋盘 3D 只展示未锁定骰子；一旦骰子被锁定，该骰子必须回到右侧传统骰盘，棋盘中的可见骰子数量随之减少。
- `已锁定` 这类提示只能作为独立 overlay 跟随骰子，不能写进点击层内部，更不能改变骰子点击层的宽高或位置。
- 如果要改碰撞区、重力、缩放、材质或骰子样式，先改 `DiceBoxStyleProfile` 或 `DiceBoxThreeEngine`，不要改业务组件。

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

验收时必须同时看：

- 页面存在 `data-testid="dicethrone-board-dice-box-canvas"`
- 骰子点击层 `data-render-mode="engine"`
- 截图 05 中骰子位置或姿态相对 04 有真实变化
- 关闭 3D 开关时仍走原右侧 2D 骰盘

## 文档入口

- 工具入口：`docs/tools.md` 的 “DiceThrone 3D 骰子截图链”
- 资源约束：`docs/ai-rules/asset-pipeline.md`
- UI 状态清晰约束：`design-system/game-ui/MASTER.md`
