# UndoFab 通用撤回悬浮按钮组件

## 概述

`UndoFab` 是一个通用的撤回功能悬浮按钮组件，用于在游戏进行中提供撤回操作的界面。该组件基于 `FabMenu` 实现，只在游戏局内显示，游戏结束后自动隐藏。

## 特性

- ✅ **自动显示/隐藏**：只在游戏进行中且有撤回操作可用时显示
- ✅ **三种状态**：申请撤回、审批撤回、等待批准
- ✅ **多人支持**：支持多人游戏的撤回握手机制
- ✅ **可拖动**：悬浮球可以拖动到屏幕任意位置
- ✅ **响应式设计**：适配移动端和桌面端
- ✅ **国际化**：支持多语言

## 使用方法

### 当前推荐：通过 GameHUD 统一入口接入

当前游戏内通用入口优先使用 `GameHUD` 的悬浮球菜单承载操作日志、撤回、反馈、设置等按钮。只证明 `UndoSystem`、日志 allowlist 或管线测试通过，不能算玩家入口已接入。

Board 层必须同时满足：

1. 用 `UndoProvider` 包住真实游戏内容，并传入当前 `G`、`dispatch`、`playerID`、`isGameOver` 与本地/联机模式。
2. 在真实路由环境下渲染 `GameHUD`，并传入 `gameId`、`matchId`、`myPlayerId`、`players` 和阶段门禁。
3. 正式局内不能被 `isPregameSetupPhase`、选角阶段、终局阶段或游戏专属 FAB suppress 规则误隐藏。
4. 至少补一条 Board/页面层测试，使用真实 `sys.actionLog.entries` 与 `sys.undo.snapshots` 状态，断言公共 FAB 展开后能看到 `action-log` 和 `undo-request` / `undo-idle` 入口。

示例：

```tsx
<UndoProvider value={{ G, dispatch, playerID, isGameOver, isLocalMode }}>
    <YourBoardContent />
    <GameHUD
        mode={isMultiplayer ? 'online' : 'local'}
        gameId={YOUR_GAME_MANIFEST.id}
        matchId={G.sys?.matchId}
        myPlayerId={playerID}
        players={matchData}
        isPregameSetupPhase={isPregameSetupPhase}
    />
</UndoProvider>
```

`UndoFab` 直接接入只适用于尚未使用 `GameHUD` 的旧页面或专用页面。新接入或审计“撤回已完成”时，默认按上面的 `UndoProvider + GameHUD + Board 层测试` 判定。

### 1. 导入组件

```tsx
import { UndoFab } from '../../components/game/UndoFab';
```

### 2. 在游戏 Board 组件中使用

```tsx
export const YourGameBoard: React.FC<Props> = ({ 
    G, 
    moves, 
    playerID, 
    isMultiplayer 
}) => {
    const isGameOver = !!G.sys.gameover;
    const isSpectator = /* 你的观战者判断逻辑 */;

    return (
        <div className="game-container">
            {/* 你的游戏界面 */}
            
            {/* 撤回悬浮球 - 只在局内显示 */}
            {!isSpectator && (
                <UndoFab
                    G={G}
                    moves={moves}
                    playerID={playerID}
                    isGameOver={isGameOver}
                />
            )}
        </div>
    );
};
```

### 3. 自定义位置（可选）

默认显示在左下角，可以通过 `className` 属性自定义位置：

```tsx
<UndoFab
    G={G}
    moves={moves}
    playerID={playerID}
    isGameOver={!!G.sys.gameover}
    className="fixed top-8 left-8 flex flex-col items-start gap-2 font-sans"
/>
```

## Props

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `G` | `MatchState<unknown>` | ✅ | - | 游戏状态对象 |
| `moves` | `any` | ✅ | - | 命令分发对象 |
| `playerID` | `string \| null` | ✅ | - | 当前玩家 ID |
| `isGameOver` | `boolean` | ❌ | `false` | 游戏是否结束 |
| `className` | `string` | ❌ | `"fixed bottom-8 left-8 ..."` | 自定义样式类名（位置/布局为主） |

## 组件行为

### 显示条件

组件只在以下情况下显示：
- 游戏未结束（`!isGameOver`）
- 用户不是观战者（`playerID !== null`）
- 有可用的撤回操作

### 三种状态

#### 1. 申请状态（`canRequest`）
- **条件**：有历史记录 + 无待处理请求 + 不是当前行动玩家
- **界面**：显示"申请撤回"按钮
- **操作**：点击发起撤回请求

#### 2. 审批状态（`canReview`）
- **条件**：存在撤回请求 + 不是请求发起者 + 是当前行动玩家
- **界面**：显示"同意"和"拒绝"按钮
- **操作**：批准或拒绝对方的撤回请求

#### 3. 等待状态（`isRequester`）
- **条件**：自己是撤回请求的发起者
- **界面**：显示等待动画和"取消申请"按钮
- **操作**：可以取消自己的撤回请求

## 国际化配置

在 `public/locales/{lang}/game.json` 中添加以下翻译：

```json
{
  "controls": {
    "undo": {
      "expand": "展开撤回",
      "collapse": "收起撤回",
      "title": "撤回操作",
      "waiting": "等待对方批准...",
      "cancel": "取消申请",
      "opponentRequest": "对方请求撤回",
      "reviewHint": "对方想要撤回上一步操作，是否同意？",
      "approve": "同意",
      "reject": "拒绝",
      "requestHint": "可以请求撤回上一步操作",
      "historyCount": "可撤回 {{count}} 步",
      "request": "申请撤回"
    }
  }
}
```

## 样式说明

组件使用了以下 Tailwind CSS 样式：
- **深色主题**：`bg-black/90` 背景
- **琥珀色主题**：`text-amber-400` 作为主色调
- **状态色**：
  - 等待状态：琥珀色（`amber-400`）
  - 审批状态：蓝色（`blue-400`）
  - 同意按钮：绿色（`green-400`）
  - 拒绝按钮：红色（`red-400`）

## 依赖要求

### 系统要求

游戏必须启用撤回系统（`UndoSystem`）：

```typescript
// 在游戏配置中
import { createUndoSystem } from '../../engine/systems/UndoSystem';

export const yourGameConfig = createDomainAdapter({
    domain: yourGameDomain,
    systems: [
        createUndoSystem({
            maxSnapshots: 50,
            requireApproval: true,
            requiredApprovals: 1,
        }),
        // 其他系统...
    ],
});
```

### 跳过快照（`_noSnapshot`）

当某个命令是前一个操作的后续动作（如"移动后触发的技能"），撤回时应作为一个整体回退。UI 层在 dispatch 时给 payload 加 `_noSnapshot: true` 即可跳过该命令的快照创建：

```typescript
// 示例：afterMove 技能与移动共享撤回点
dispatch(SW_COMMANDS.ACTIVATE_ABILITY, {
  abilityId: 'frost_axe',
  sourceUnitId: unit.instanceId,
  choice: 'attach',
  targetPosition: pos,
  _noSnapshot: true, // 不创建独立快照，撤回时连同移动一起回退
});
```

适用场景：任何"操作 A 触发操作 B，撤回时 A+B 应原子回退"的情况。

### 包依赖

- `react`
- `react-i18next`
- `lucide-react`（用于图标）
- `framer-motion`（FabMenu 依赖）

## 与井字棋的集成

参考井字棋的实现：

```tsx
// src/games/tictactoe/Board.tsx
import { UndoFab } from '../../components/game/UndoFab';

export const TicTacToeBoard: React.FC<Props> = ({ /* ... */ }) => {
    // ...
    
    return (
        <div className="game-board">
            {/* 游戏界面 */}
            
            {/* 撤回悬浮球 */}
            {!isSpectator && (
                <UndoFab
                    G={G}
                    moves={moves}
                    playerID={playerID}
                    isGameOver={!!G.sys.gameover}
                />
            )}
        </div>
    );
};
```

## 注意事项

1. **不要在观战模式显示**：观战者不应该看到撤回按钮
2. **游戏结束时隐藏**：游戏结束后撤回功能应该不可用
3. **Z-index 管理**：撤回按钮层级由 `FabMenu` 统一管理，遵循 `UI_Z_INDEX.hud`，不要在 `className` 里硬编码 z-index
4. **拖动区域**：悬浮球可拖动，但展开的面板不会触发拖动

## 未来改进

- [ ] 添加撤回历史预览
- [ ] 支持批量撤回
- [ ] 添加撤回动画效果
- [ ] 支持快捷键操作
