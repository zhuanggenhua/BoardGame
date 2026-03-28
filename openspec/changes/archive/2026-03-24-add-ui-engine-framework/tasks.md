# Tasks: add-ui-engine-framework

## Phase 1: 定义类型与接口 ✅
- [x] 创建 `src/core/ui/types.ts` - GameBoardProps/PhaseInfo/PlayerPanelData/HandAreaConfig/ResourceTrayConfig
- [x] 创建 `src/core/ui/hooks.ts` - hook 契约类型定义
- [x] 创建 `src/core/ui/index.ts` - 统一导出
- [x] 创建 `src/components/game/framework/types.ts` - 骨架组件 Props 类型

## Phase 2: 实现骨架组件 ✅
- [x] 实现 `PhaseIndicatorSkeleton` - 阶段指示器骨架（纯逻辑，无样式）
- [x] 实现 `PlayerPanelSkeleton` - 玩家面板骨架
- [x] 实现 `HandAreaSkeleton` - 手牌区骨架（含拖拽/发牌动画逻辑）
- [x] 实现 `ResourceTraySkeleton` - 资源托盘骨架
- [x] 实现 `SpotlightSkeleton` - 特写骨架（骰子结果/卡牌打出/技能激活等中心展示）
- [x] 创建 `src/components/game/framework/index.ts` - 统一导出

## Phase 3: 实现底层 Hooks ✅
- [x] 实现 `useGameBoard` hook - 基础状态管理
- [x] 实现 `useHandArea` hook - 手牌区交互逻辑
- [x] 实现 `useResourceTray` hook - 资源托盘交互逻辑
- [x] 实现 `useDragCard` hook - 卡牌拖拽逻辑抽取

## Phase 4: 重构 DiceThrone ✅
- [x] 重构 PhaseIndicator 基于骨架组件
- [x] 重构 PlayerStats 基于骨架组件 + 预设函数
- [x] 重构 ChoiceModal 复用 ModalBase
- [x] 重构 ConfirmSkipModal 复用 ConfirmModal
- [x] 重构 BonusDieOverlay 基于 SpotlightSkeleton + 预设样式
- [x] 提取 Dice3D 共享组件（DiceTray/BonusDieOverlay 复用）
- [x] 创建 presets.tsx 预设渲染函数（UGC/快速开发友好）
- [x] Board.tsx 检查完成，无累赘代码
- [~] HandArea - 逻辑复杂且特化，不适合骨架组件
- [~] DiceTray - 已精简，3D骰子不适合 ResourceTraySkeleton
- [~] AbilityOverlays - DiceThrone 特有的技能槽系统，不适合通用化

## Phase 5: 验证与文档
- [ ] TicTacToe 可选接入验证（简单游戏）
- [ ] 更新 `docs/framework/frontend.md` 添加 UI 引擎框架说明
- [ ] 创建新游戏接入脚手架指引

## Validation
- [ ] DiceThrone 功能回归测试
- [ ] TicTacToe 功能回归测试
- [ ] ESLint 无新增错误
