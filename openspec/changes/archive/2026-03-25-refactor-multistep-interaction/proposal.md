# Change: 为 InteractionSystem 引入 multistep-choice

## Why
旧交互层主要覆盖 `simple-choice` / `slider-choice` 这类“一次选择即结算”的模型，不适合“本地连续调整 -> 预览 -> 最终确认”这类多步交互。DiceThrone 的骰子修改与重掷曾经因此绕行到游戏私有交互模型和 UI 本地补丁，形成了难以复用的实现。

当前仓库已经实际落地：
- `InteractionSystem` 原生支持 `multistep-choice`
- 引擎提供 `useMultistepInteraction` Hook
- DiceThrone 骰子修改 / 选骰交互已迁移到该模型

但 change 文档仍停留在“未实施”的旧状态，且部分 design 细节已经与代码现实不一致。

## What Changes
- 为 `interaction-system` 新增 `multistep-choice` 交互能力
- 为 UI 层新增 `useMultistepInteraction` Hook，用于管理本地中间步骤、确认与取消
- 将 DiceThrone 的骰子修改类与选骰重掷类交互迁移到 `multistep-choice`
- 保留 `dt:card-interaction` 作为 DiceThrone 状态选择类交互的兼容通道，不再承载骰子交互
- 为测试/序列化边界补齐兼容处理：
  - 函数型 `localReducer` / `toCommands` 在客户端补水
  - 非 React 场景下由引擎/游戏系统补足 auto-confirm 行为

## Impact
- Affected specs:
  - `interaction-system`
- Affected code:
  - `src/engine/systems/InteractionSystem.ts`
  - `src/engine/systems/MultistepChoiceSystem.ts`
  - `src/engine/systems/useMultistepInteraction.ts`
  - `src/engine/systems/index.ts`
  - `src/engine/systems/__tests__/useMultistepInteraction.test.ts`
  - `src/games/dicethrone/domain/systems.ts`
  - `src/games/dicethrone/ui/RightSidebar.tsx`
  - `src/games/dicethrone/ui/DiceTray.tsx`
  - `src/games/dicethrone/Board.tsx`
  - `src/games/*/game.ts`
