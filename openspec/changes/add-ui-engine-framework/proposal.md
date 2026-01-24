# Proposal: add-ui-engine-framework

## Summary
定义 UI 引擎框架规范，作为所有游戏 Board UI 的抽象基座层。提供标准化的 Props 契约、通用 UI 骨架接口、动效/拖拽/弹窗 hook 契约，确保多游戏风格并存的同时复用交互骨架能力。

## Motivation
当前 DiceThrone Board.tsx 约 2000 行代码，包含大量可复用逻辑（阶段指示、玩家面板、手牌区、骰子托盘、技能槽位等）。直接拆分缺乏顶层设计，可能导致：
1. 抽取的模块接口不够通用，后续新游戏接入需返工
2. DiceThrone 特定逻辑意外混入"通用"模块
3. 各游戏 Board 实现风格不一致，维护成本高

## Goals
1. **定义 GameBoard 抽象接口**：标准化 Props 契约（G/ctx/moves/playerID/...）
2. **定义通用 UI 骨架接口**：阶段指示器、玩家面板、手牌区、资源托盘等的抽象 Props
3. **定义动效/拖拽/弹窗 hook 契约**：统一交互能力的 API
4. **分离皮肤层与骨架层**：游戏特定美术/布局放 `games/<gameId>/`，通用骨架放 `components/game/`

## Non-Goals
- 不强制所有游戏使用相同布局（允许完全自定义 Board）
- 不引入新的状态管理库
- 暂不实现 3D 渲染框架

## Scope
- 新增 `src/core/ui/` 目录存放框架类型定义
- 新增 `src/components/game/framework/` 存放通用骨架组件
- 重构 DiceThrone 作为框架首个实现验证

## Risks
- 过度抽象可能降低开发效率
- 需要同时维护框架层和游戏皮肤层

## Dependencies
- 依赖现有 boardgame.io 类型系统
- 依赖现有动效组件（FlyingEffect/Shake/PulseGlow）

## Success Criteria
1. DiceThrone 重构后 Board.tsx < 500 行
2. TicTacToe 可选择性接入框架（验证通用性）
3. 新游戏接入时有清晰的脚手架指引
