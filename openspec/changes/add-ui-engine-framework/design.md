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

import type { BoardProps } from 'boardgame.io/react';

/**
 * 游戏 Board 的标准 Props 契约
 * 所有游戏 Board 组件必须接收此类型的 Props
 */
export interface GameBoardProps<G = unknown> extends BoardProps<G> {
  // boardgame.io 原生 Props 已包含: G, ctx, moves, playerID, isActive, ...
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

## Open Questions
1. 是否需要提供默认主题（可选使用）？
2. 动画参数是否需要标准化（duration/easing）？
3. 是否需要支持 SSR？
