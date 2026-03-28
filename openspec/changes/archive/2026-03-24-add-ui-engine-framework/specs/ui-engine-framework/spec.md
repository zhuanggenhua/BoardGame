## ADDED Requirements

### Requirement: GameBoard Props 契约
系统 SHALL 定义 `GameBoardProps<G>` 作为所有游戏 Board 组件的标准 Props 契约。

#### Scenario: 新游戏 Board 类型校验
- **GIVEN** 开发者创建新游戏 Board 组件
- **WHEN** 组件 Props 类型设为 `GameBoardProps<MyGameState>`
- **THEN** TypeScript 校验通过，且包含 G/ctx/moves/playerID 等标准属性

### Requirement: 阶段指示器骨架
系统 SHALL 提供 `PhaseIndicatorSkeleton` 组件，接收阶段列表与当前阶段 ID，通过 `renderPhaseItem` 函数渲染各阶段样式。

#### Scenario: 渲染自定义阶段样式
- **GIVEN** 游戏定义了 5 个阶段
- **WHEN** 使用 `PhaseIndicatorSkeleton` 并传入 `renderPhaseItem` 函数
- **THEN** 每个阶段调用 `renderPhaseItem(phase, isActive)` 渲染，当前阶段 `isActive=true`

### Requirement: 玩家面板骨架
系统 SHALL 提供 `PlayerPanelSkeleton` 组件，接收 `PlayerPanelData`（资源/状态效果），通过 render 函数渲染各资源与状态。

#### Scenario: 渲染玩家资源
- **GIVEN** 玩家数据包含 `{ health: 50, energy: 3 }`
- **WHEN** 使用 `PlayerPanelSkeleton` 并传入 `renderResource` 函数
- **THEN** 对每个资源调用 `renderResource(key, value)` 渲染

### Requirement: 手牌区骨架
系统 SHALL 提供 `HandAreaSkeleton` 组件，封装拖拽/发牌动画逻辑，通过 `renderCard` 函数渲染卡牌样式。

#### Scenario: 拖拽打出卡牌
- **GIVEN** 手牌区包含 3 张卡牌
- **WHEN** 用户向上拖拽卡牌超过阈值
- **THEN** 触发 `onPlayCard(cardId)` 回调

#### Scenario: 发牌动画
- **GIVEN** 手牌从 2 张变为 3 张
- **WHEN** `dealAnimation=true`
- **THEN** 新卡牌从指定起点飞入手牌区

### Requirement: 资源托盘骨架
系统 SHALL 提供 `ResourceTraySkeleton` 组件，封装点击/选择逻辑，通过 `renderItem` 函数渲染资源项样式。

#### Scenario: 切换资源锁定状态
- **GIVEN** 托盘包含 5 个骰子
- **WHEN** 用户点击某骰子
- **THEN** 触发 `onItemClick(itemId)` 回调

### Requirement: 特写骨架
系统 SHALL 提供 `SpotlightSkeleton` 组件，用于中心展示重要内容（骰子结果、卡牌打出、技能激活等），支持自动/手动关闭和动画序列。

#### Scenario: 骰子结果特写（自动关闭）
- **GIVEN** 玩家投掷额外骰子
- **WHEN** 使用 `SpotlightSkeleton` 并设置 `autoCloseDelay=3000`
- **THEN** 骰子结果在屏幕中央展示，3 秒后自动淡出并调用 `onClose`

#### Scenario: 卡牌特写（手动关闭）
- **GIVEN** 敌方打出技能卡
- **WHEN** 使用 `SpotlightSkeleton` 不设置 `autoCloseDelay`，设置 `closeOnBackdrop=true`
- **THEN** 卡牌在屏幕中央展示，点击背景或关闭按钮后调用 `onClose`

#### Scenario: 动画序列
- **GIVEN** 特写内容需要入场/出场动画
- **WHEN** 设置 `enterAnimation` 和 `exitAnimation`
- **THEN** 内容按配置播放入场动画，关闭时播放出场动画

### Requirement: 底层 Hook 契约
系统 SHALL 提供 `useHandArea`/`useResourceTray` 等底层 Hook，供完全自定义 UI 时使用。

#### Scenario: 自定义手牌区实现
- **GIVEN** 游戏需要完全自定义手牌布局
- **WHEN** 使用 `useHandArea` hook
- **THEN** 获得拖拽状态管理（draggingCardId/handleDragStart/handleDragEnd）而无需使用骨架组件

### Requirement: 骨架组件无默认样式
系统 SHALL 确保所有骨架组件无内置 CSS 样式，样式完全由 `className` 和 render 函数注入。

#### Scenario: 不同游戏使用不同主题
- **GIVEN** DiceThrone 使用暗色主题，TicTacToe 使用亮色主题
- **WHEN** 两游戏均使用 `PhaseIndicatorSkeleton`
- **THEN** 各自通过 `className` 和 `renderPhaseItem` 实现不同视觉风格

### Requirement: 类型安全泛型
系统 SHALL 对骨架组件使用泛型约束（如 `HandAreaSkeleton<TCard>`），确保 render 函数参数类型正确。

#### Scenario: 卡牌类型校验
- **GIVEN** 游戏定义 `AbilityCard` 类型
- **WHEN** 使用 `HandAreaSkeleton<AbilityCard>` 并传入 `renderCard`
- **THEN** `renderCard` 参数类型为 `(card: AbilityCard, index: number) => ReactNode`
