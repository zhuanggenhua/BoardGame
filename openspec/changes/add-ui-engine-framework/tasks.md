# Tasks: add-ui-engine-framework

## Phase 1: 定义类型与接口
- [ ] 创建 `src/core/ui/types.ts` - GameBoardProps/PhaseInfo/PlayerPanelData/HandAreaConfig/ResourceTrayConfig
- [ ] 创建 `src/core/ui/hooks.ts` - hook 契约类型定义
- [ ] 创建 `src/core/ui/index.ts` - 统一导出
- [ ] 创建 `src/components/game/framework/types.ts` - 骨架组件 Props 类型

## Phase 2: 实现骨架组件
- [ ] 实现 `PhaseIndicatorSkeleton` - 阶段指示器骨架（纯逻辑，无样式）
- [ ] 实现 `PlayerPanelSkeleton` - 玩家面板骨架
- [ ] 实现 `HandAreaSkeleton` - 手牌区骨架（含拖拽/发牌动画逻辑）
- [ ] 实现 `ResourceTraySkeleton` - 资源托盘骨架
- [ ] 创建 `src/components/game/framework/index.ts` - 统一导出

## Phase 3: 实现底层 Hooks
- [ ] 实现 `useGameBoard` hook - 基础状态管理
- [ ] 实现 `useHandArea` hook - 手牌区交互逻辑
- [ ] 实现 `useResourceTray` hook - 资源托盘交互逻辑
- [ ] 实现 `useDragCard` hook - 卡牌拖拽逻辑抽取

## Phase 4: 重构 DiceThrone
- [ ] 迁移 DiceThrone 使用新类型定义
- [ ] 重构 PhaseIndicator 基于骨架组件
- [ ] 重构 PlayerStats 基于骨架组件
- [ ] 重构 HandArea 基于骨架组件
- [ ] 重构 DiceTray 基于骨架组件
- [ ] 重构 AbilityOverlays（技能槽位）
- [ ] Board.tsx 精简至 <500 行

## Phase 5: 验证与文档
- [ ] TicTacToe 可选接入验证（简单游戏）
- [ ] 更新 `docs/framework/frontend.md` 添加 UI 引擎框架说明
- [ ] 创建新游戏接入脚手架指引

## Validation
- [ ] DiceThrone 功能回归测试
- [ ] TicTacToe 功能回归测试
- [ ] ESLint 无新增错误
