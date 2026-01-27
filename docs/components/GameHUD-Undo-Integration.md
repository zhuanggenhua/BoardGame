# GameHUD 撤回功能集成指南

## 概述

撤回功能已集成到 GameHUD 悬浮球中，通过 `UndoContext` 实现状态共享。只有一个悬浮球（右下角），撤回控件在展开菜单中显示。

## 特性

✅ **统一的悬浮球** - 所有功能在一个悬浮球内  
✅ **红点提醒系统** - 有撤回请求待审批时显示红点  
✅ **自动显隐** - 只在游戏进行中且有撤回操作时显示  
✅ **展开时隐藏红点** - 悬浮球展开时红点消失  

## 架构

```
MatchRoom.tsx
├── <GameHUD />  ← 从 UndoContext 读取撤回状态
└── <GameClient>
    └── <Board>
        └── <UndoProvider>  ← 提供撤回状态
            └── 游戏界面
```

## 使用方法

### 1. 在 Board 组件中包裹 UndoProvider

```tsx
import { UndoProvider } from '../../contexts/UndoContext';

export const YourGameBoard: React.FC<Props> = ({ G, ctx, moves, playerID, ... }) => {
    const isGameOver = ctx.gameover;
    
    return (
        <UndoProvider value={{ G, ctx, moves, playerID, isGameOver: !!isGameOver }}>
            {/* 你的游戏界面 */}
        </UndoProvider>
    );
};
```

### 2. GameHUD 自动获取撤回状态

GameHUD 会自动：
- 从 UndoContext 读取状态
- 在面板中显示撤回控件
- 在悬浮球上显示红点（有待处理请求时）

**无需修改 GameHUD 的调用代码！**

## 红点系统

### 显示规则

| 情况 | 是否显示红点 |
|------|-------------|
| 对方请求撤回，需要我审批 | ✅ 显示 |
| 我是申请者，等待批准 | ❌ 不显示 |
| 可以发起撤回请求 | ❌ 不显示 |
| 悬浮球展开时 | ❌ 隐藏（通过 FabMenu 机制）|
| 游戏结束 | ❌ 不显示 |

### 实现

```tsx
// 红点在悬浮球图标上
<FabMenu
    icon={
        <div className="relative">
            {ModeIcon}
            {hasAnyNotification && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
        </div>
    }
>
```

## 三种撤回状态

### 1. 申请状态（canRequest）
- **条件**：有历史 + 无请求 + 不是当前玩家
- **UI**：显示"申请撤回"按钮
- **红点**：❌ 不显示

### 2. 审批状态（canReview）
- **条件**：有请求 + 不是发起者 + 是当前玩家
- **UI**：显示"同意/拒绝"按钮
- **红点**：✅ 显示（提醒用户处理）

### 3. 等待状态（isRequester）
- **条件**：我是请求发起者
- **UI**：显示等待动画 + "取消申请"按钮
- **红点**：❌ 不显示

## 示例：井字棋集成

```tsx
// src/games/tictactoe/Board.tsx
import { UndoProvider } from '../../contexts/UndoContext';

export const TicTacToeBoard: React.FC<Props> = ({ G, ctx, moves, playerID, ... }) => {
    const isGameOver = ctx.gameover;
    
    return (
        <UndoProvider value={{ G, ctx, moves, playerID, isGameOver: !!isGameOver }}>
            <div className="game-board">
                {/* 游戏界面 */}
            </div>
        </UndoProvider>
    );
};
```

**就这么简单！** GameHUD 会自动显示撤回功能。

## API 参考

### UndoProvider

```tsx
interface UndoProviderProps {
    children: ReactNode;
    value: {
        G: MatchState<unknown>;      // 游戏状态
        ctx: any;                     // boardgame.io context
        moves: any;                   // boardgame.io moves
        playerID: string | null;      // 当前玩家 ID
        isGameOver: boolean;          // 游戏是否结束
    };
}
```

### useUndo Hook

```tsx
// 获取撤回状态（如果不在游戏中返回 null）
const undoState = useUndo();

if (undoState) {
    const { G, ctx, moves, playerID, isGameOver } = undoState;
}
```

### useUndoStatus Hook

```tsx
// 获取撤回状态类型和红点标记
const { status, hasNotification } = useUndoStatus();

// status: 'canRequest' | 'canReview' | 'isRequester' | null
// hasNotification: boolean
```

## 迁移指南

### 从独立 UndoFab 迁移

如果你的游戏使用了独立的 `UndoFab` 组件：

**之前：**
```tsx
import { UndoFab } from '../../components/game/UndoFab';

<UndoFab G={G} ctx={ctx} moves={moves} playerID={playerID} isGameOver={!!isGameOver} />
```

**之后：**
```tsx
import { UndoProvider } from '../../contexts/UndoContext';

<UndoProvider value={{ G, ctx, moves, playerID, isGameOver: !!isGameOver }}>
    {/* 游戏界面 */}
</UndoProvider>
```

移除 UndoFab，撤回功能会自动出现在 GameHUD 中。

## 优势

### 相比独立悬浮球

1. **更简洁的 UI**
   - 只有一个悬浮球（右下角）
   - 不占据额外屏幕空间

2. **统一的交互**
   - 所有游戏控制在一个菜单
   - 用户不需要记忆多个悬浮球位置

3. **智能提醒**
   - 红点系统提醒待处理请求
   - 展开时红点消失，避免干扰

4. **更好的维护性**
   - Context 模式解耦组件
   - 新游戏只需包裹 Provider

## 注意事项

1. **必须包裹 UndoProvider**
   - 不包裹则撤回功能不显示
   - 建议在 Board 组件最外层包裹

2. **观战者自动隐藏**
   - playerID 为 null 时不显示撤回功能

3. **游戏结束时隐藏**
   - isGameOver 为 true 时自动隐藏

4. **需要启用 UndoSystem**
   - 游戏配置中必须包含 `createUndoSystem()`

## 文件清单

### 新增文件
- `src/contexts/UndoContext.tsx` - Context 实现

### 修改文件
- `src/components/game/GameHUD.tsx` - 集成撤回功能 + 红点系统
- `src/games/tictactoe/Board.tsx` - 使用 UndoProvider

### 可删除文件（可选）
- `src/components/game/UndoFab.tsx` - 独立悬浮球（已不需要）

## 测试要点

- [ ] 红点在有审批请求时显示
- [ ] 红点在悬浮球展开时消失
- [ ] 红点在收起悬浮球后重新出现
- [ ] 申请撤回不显示红点
- [ ] 等待批准不显示红点
- [ ] 游戏结束时撤回功能隐藏
- [ ] 观战者不显示撤回功能
- [ ] 多游戏兼容性（井字棋、骰子王座等）
