# Change: 通用骰子物理与渲染分离

## Why
当前 DiceThrone 的棋盘 3D 骰子暴露了一个架构问题：物理插件既负责运动，又直接决定可见骰子样式，导致接入真实物理时会把游戏已确认的骰子视觉替换成插件默认样式。

## What Changes
- 将通用骰子能力拆成“物理状态源”和“游戏自定义渲染器”两层。
- 物理层只输出骰子位置、旋转、尺寸、落定状态与点击命中所需投影信息，不拥有最终可见样式。
- 游戏层可注册自己的骰子渲染器、骰面资源、选中态、尺寸规则与锁定态展示。
- DiceThrone 的圆角骰子样式作为首个接入案例：可继续使用历史 DiceThrone 视觉，同时复用物理状态。
- 明确禁止把第三方物理插件默认骰子样式作为跨游戏默认交付视觉。

## Impact
- Affected specs: `dice-system`
- Affected code:
  - `src/lib/dice-box-threejs/engine.ts`
  - `src/games/dicethrone/ui/Dice3D.tsx`
  - `src/games/dicethrone/ui/DiceTray.tsx`
  - `src/games/dicethrone/ui/BoardDiceBoxTray.tsx`
  - DiceThrone 3D 骰子截图脚本与 E2E 验收

## Non-Goals
- 不在本 change 中重写 DiceThrone 骰子美术风格。
- 不要求所有游戏立刻迁移到物理骰子。
- 不把 `@3d-dice/dice-box-threejs` 的默认可见骰子定为项目通用样式。
