# Design: add-ui-engine-framework

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Game Board Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  DiceThrone     │  │   TicTacToe     │  │   Future Game   │  │
│  │  Board.tsx      │  │   Board.tsx     │  │   Board.tsx     │  │
│  │  (皮肤/布局)     │  │  (皮肤/布局)     │  │  (皮肤/布局)     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              UI Engine Framework (骨架层)                    ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         ││
│  │  │ useGameBoard │ │ useHandArea  │ │ useDiceTray  │   ...   ││
│  │  │   (hook)     │ │   (hook)     │ │   (hook)     │         ││
│  │  └──────────────┘ └──────────────┘ └──────────────┘         ││
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         ││
│  │  │PhaseIndicator│ │ PlayerPanel  │ │ ResourceTray │   ...   ││
│  │  │  (骨架组件)   │ │  (骨架组件)   │ │  (骨架组件)   │         ││
│  │  └──────────────┘ └──────────────┘ └──────────────┘         ││
│  └─────────────────────────────────────────────────────────────┘│
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Common Animations & Interactions                ││
│  │  FlyingEffect │ ShakeContainer │ PulseGlow │ ModalStack     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Core Type Definitions

### 1. GameBoardProps 契约

```typescript
// src/core/ui/types.ts

import type { GameBoardProps } from '@/engine/transport/protocol';

/**
 * 游戏 Board 的标准 Props 契约
 * 所有游戏 Board 组件必须接收此类型的 Props
 */
export interface GameBoardProps<G = unknown> {
  // 引擎 Props 已包含: G, dispatch, playerID, isConnected, ...
}

/**
 * 通用阶段信息
 */
export interface PhaseInfo {
  id: string;
  label: string;
  description?: string[];
}

/**
 * 通用玩家面板数据
 */
export interface PlayerPanelData {
  playerId: string;
  displayName?: string;
  avatar?: string;
  resources: Record<string, number>;  // { health: 50, energy: 3, ... }
  statusEffects?: Record<string, number>;
}

/**
 * 手牌区配置
 */
export interface HandAreaConfig<TCard = unknown> {
  cards: TCard[];
  maxCards?: number;
  canDrag?: boolean;
  onPlayCard?: (cardId: string) => void;
  onSellCard?: (cardId: string) => void;
  renderCard: (card: TCard, index: number) => React.ReactNode;
}

/**
 * 资源托盘配置（骰子/棋子/token）
 */
export interface ResourceTrayConfig<TItem = unknown> {
  items: TItem[];
  canInteract?: boolean;
  onItemClick?: (itemId: string | number) => void;
  renderItem: (item: TItem, index: number) => React.ReactNode;
}
```

### 2. 骨架组件接口

```typescript
// src/components/game/framework/types.ts

/**
 * 阶段指示器骨架 Props
 */
export interface PhaseIndicatorSkeletonProps {
  phases: PhaseInfo[];
  currentPhaseId: string;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  renderPhaseItem?: (phase: PhaseInfo, isActive: boolean) => React.ReactNode;
}

/**
 * 玩家面板骨架 Props
 */
export interface PlayerPanelSkeletonProps {
  player: PlayerPanelData;
  isCurrentPlayer?: boolean;
  className?: string;
  renderResource?: (key: string, value: number) => React.ReactNode;
  renderStatusEffect?: (effectId: string, stacks: number) => React.ReactNode;
}

/**
 * 手牌区骨架 Props
 */
export interface HandAreaSkeletonProps<TCard = unknown> extends HandAreaConfig<TCard> {
  className?: string;
  dealAnimation?: boolean;
  dragThreshold?: number;
}

/**
 * 资源托盘骨架 Props
 */
export interface ResourceTraySkeletonProps<TItem = unknown> extends ResourceTrayConfig<TItem> {
  className?: string;
  layout?: 'row' | 'column' | 'grid';
}

/**
 * 特写骨架 Props
 * 用于中心展示重要内容（骰子结果、卡牌打出、技能激活等）
 */
export interface SpotlightSkeletonProps {
  /** 是否显示 */
  isVisible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 自动关闭延迟 (ms)，不传则手动关闭 */
  autoCloseDelay?: number;
  /** 标题 */
  title?: React.ReactNode;
  /** 描述/效果文字 */
  description?: React.ReactNode;
  /** 特写内容 */
  children: React.ReactNode;
  /** 入场动画配置 */
  enterAnimation?: AnimationConfig;
  /** 出场动画配置 */
  exitAnimation?: AnimationConfig;
  /** 背景遮罩样式 */
  backdropClassName?: string;
  /** 容器样式 */
  containerClassName?: string;
  /** 点击背景关闭 */
  closeOnBackdrop?: boolean;
}
```

### 3. Hook 契约

```typescript
// src/core/ui/hooks.ts

/**
 * useGameBoard - 游戏 Board 基础状态管理
 */
export interface UseGameBoardReturn<G> {
  G: G;
  ctx: Ctx;
  isMyTurn: boolean;
  currentPhase: string;
  canInteract: boolean;
}

/**
 * useHandArea - 手牌区交互逻辑
 */
export interface UseHandAreaReturn<TCard> {
  visibleCards: TCard[];
  draggingCardId: string | null;
  handleDragStart: (cardId: string) => void;
  handleDragEnd: (cardId: string) => void;
  handleDrag: (cardId: string, offset: { x: number; y: number }) => void;
}

/**
 * useResourceTray - 资源托盘交互逻辑
 */
export interface UseResourceTrayReturn<TItem> {
  items: TItem[];
  selectedItemId: string | number | null;
  handleItemClick: (itemId: string | number) => void;
  handleItemToggle: (itemId: string | number) => void;
}
```

## Directory Structure

```
src/
├── core/
│   └── ui/
│       ├── types.ts          # 核心类型定义
│       ├── hooks.ts          # hook 契约类型
│       └── index.ts          # 统一导出
├── components/
│   └── game/
│       └── framework/
│           ├── PhaseIndicatorSkeleton.tsx
│           ├── PlayerPanelSkeleton.tsx
│           ├── HandAreaSkeleton.tsx
│           ├── ResourceTraySkeleton.tsx
│           ├── SpotlightSkeleton.tsx   # 特写骨架
│           └── index.ts
└── games/
    └── dicethrone/
        ├── ui/
        │   ├── assets.ts         # 游戏特定资产
        │   ├── PhaseIndicator.tsx # 基于骨架的皮肤实现
        │   ├── PlayerStats.tsx
        │   ├── HandArea.tsx
        │   ├── DiceTray.tsx
        │   └── ...
        └── Board.tsx             # 组合各 UI 模块
```

## Implementation Strategy

### Phase 1: 定义类型与接口
1. 创建 `src/core/ui/types.ts` 定义核心类型
2. 创建骨架组件 Props 类型
3. 创建 hook 契约类型

### Phase 2: 实现骨架组件
1. `PhaseIndicatorSkeleton` - 纯交互逻辑，无样式
2. `PlayerPanelSkeleton` - 资源/状态显示逻辑
3. `HandAreaSkeleton` - 拖拽/发牌动画逻辑
4. `ResourceTraySkeleton` - 点击/选择逻辑
5. `SpotlightSkeleton` - 中心特写展示（自动/手动关闭、动画序列）

### Phase 3: 重构 DiceThrone
1. 基于骨架组件实现皮肤层
2. Board.tsx 仅负责组合与布局
3. 验证可扩展性

### Phase 4: 验证通用性
1. TicTacToe 可选接入（简单游戏验证）
2. 文档与脚手架

## Design Decisions

### D1: 骨架组件 vs 纯 Hook
**选择**：提供骨架组件 + 底层 Hook 双层 API
**理由**：
- 骨架组件：快速接入，内置最佳实践
- 底层 Hook：完全自定义需求时使用

### D2: 渲染函数 vs Children
**选择**：使用 renderItem/renderCard 函数
**理由**：
- 类型安全（泛型约束）
- 更灵活的渲染控制
- 避免 children 类型推断问题

### D3: 样式方案
**选择**：骨架组件无默认样式，通过 className 和 render 函数注入
**理由**：
- 不限制游戏美术风格
- 避免 CSS 覆盖冲突
- 保持骨架层纯粹

## Design Decisions (Continued)

### D4: 复用已有 Modal 系统
**选择**：DiceThrone 的 ChoiceModal/ConfirmSkipModal 应基于 `ConfirmModal` 或 `ModalBase` 重构
**理由**：
- 已有成熟的 `src/components/common/overlays/ModalBase.tsx`
- 已有 `ConfirmModal.tsx` 支持主题定制
- 避免重复实现动画/backdrop 逻辑

### D5: 默认主题
**决定**：暂不提供默认主题
**理由**：
- 桌游美术风格差异大
- 强制使用默认主题会增加覆盖成本
- 通过文档示例指导即可

### D6: 动画参数
**决定**：提供可选的标准化动画配置
**方案**：
```typescript
export interface AnimationConfig {
  duration?: number;  // 默认 300ms
  easing?: string;    // 默认 'ease-out'
}
```
骨架组件接受 `animationConfig` 可选参数，不传则使用默认值。

### D7: SSR 支持
**决定**：暂不支持
**理由**：
- 当前项目为纯 SPA
- 游戏 Board 依赖浏览器 API（拖拽/动画）
- 未来如需支持可渐进改造
