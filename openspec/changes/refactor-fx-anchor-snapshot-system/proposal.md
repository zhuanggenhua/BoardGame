# Change: Refactor FX anchor snapshot system

## Why
当前 FX 系统已经有 `FxBus`、`FxLayer`、共享动画 preset 和游戏侧 renderer，但定位模型仍偏“renderer 播放时临时读 DOM / 读格子”。这会导致两类结构性问题：

- 有地图的游戏里，单位被结算移除、移动或密排变化后，命中 / 召唤 / 推拉等一次性特效会丢失对象本体锚点并退回格子中心。
- 没有地图的牌桌游戏里，例如 Smash Up，卡牌、基地、弃牌、计分区、VP 飞行等特效只能靠 screen 坐标或游戏私有写法拼接，无法复用统一的“来源对象 → 目标对象 → 过程帧 → 命中 / 完成”模型。

这不是单个游戏的 UI 微调，而是表现系统需要对齐游戏引擎常见模型：一次性特效在生成时冻结来源 / 目标坐标快照，持续附着特效才显式跟随对象。

## What Changes
- 新增 `fx-rendering-system` capability，定义跨游戏 FX surface、anchor registry、spawn snapshot 与 tracking lifecycle。
- 在 `src/engine/fx/` 中引入通用锚点解析边界：
  - 支持 `board-local` / `table-local` / `screen` / `ui` 等 surface，而不是只支持棋盘格。
  - 游戏 Board / table UI 注册可见对象锚点，FX 生成前将实体锚点解析为 surface-local 坐标快照。
  - 一次性特效默认消费不可变 `sourceSnapshot` / `targetSnapshot`，播放期间不再查业务 DOM。
  - 只有显式声明为 `tracking` / `attached` 的持续特效才允许运行期跟随锚点。
- 迁移共享 preset，使攻击、召唤、命中、飞行、飘字、VP 飞行等都能消费同一类 anchor snapshot。
- 以 Mage Wars 作为棋盘 / 格子型接入样例，以 Smash Up 作为无地图 / 牌桌型接入样例。
- 更新项目动效规范，明确“spawn snapshot vs tracking anchor”作为引擎级默认模型。

## Impact
- Affected specs:
  - `fx-rendering-system`
- Affected code:
  - `src/engine/fx/`
  - `src/components/common/animations/BoardFxPresets.tsx`
  - `src/components/common/animations/` 中消费坐标的共享组件 / preset
  - `src/games/mage-wars/ui/fxRenderers.tsx`
  - `src/games/mage-wars/ui/useGameEvents.ts`
  - `src/games/mage-wars/Board.tsx`
  - `src/games/smashup/Board.tsx`
  - Mage Wars / Smash Up 相关 Vitest 与 Playwright E2E
  - `.spec/knowledge/standards/animation-effects.md`
  - `.spec/knowledge/standards/engine-visual-events.md`

## Non-Goals
- 不引入 Unity、Pixi、Phaser、Cocos 或其它外部游戏引擎。
- 不重做 Mage Wars 或 Smash Up 的 UI 布局。
- 不重写所有游戏的 FX，一次只迁移能证明模型成立的代表链路。
- 不把规则结算延迟到动画结束；领域状态仍同步结算，表现层用快照和视觉生命周期承接。
- 不把所有 card spotlight / modal / toast 都纳入 FX；本 change 只处理视觉特效、飞行、命中、附着反馈等表现链路。
