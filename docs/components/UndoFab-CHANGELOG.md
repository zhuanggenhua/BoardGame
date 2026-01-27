# UndoFab 组件实现更改日志

## 概述
实现了一个通用的撤回功能悬浮按钮组件 `UndoFab`，替代原有的底部固定撤回控件。该组件参考井字棋的实现，提供了一个所有游戏都能使用的通用版本。

## 更改内容

### 1. 新增组件
**文件**: `src/components/game/UndoFab.tsx`

创建了新的 UndoFab 组件，具有以下特性：
- 使用 FabMenu 作为基础，提供悬浮球交互
- 三种状态展示：申请撤回、审批撤回、等待批准
- 自动显示/隐藏逻辑
- 支持拖动定位
- 完整的国际化支持

### 2. 组件导出
**文件**: `src/components/game/index.ts`

新建组件索引文件，导出所有 game 相关组件：
- AudioControlSection
- EndgameOverlay
- GameControls（保留用于嵌入式场景）
- GameHUD
- RematchActions
- UndoFab（新增）

### 3. 井字棋集成
**文件**: `src/games/tictactoe/Board.tsx`

更改：
- 移除 `GameControls` 导入
- 添加 `UndoFab` 导入
- 移除原有的 `showUndoControls` 相关逻辑（7行代码）
- 移除底部固定的撤回控件区域
- 添加左下角的 `UndoFab` 悬浮球

对比：
```tsx
// 之前：底部固定区域
{showUndoControls && (
    <div className="absolute bottom-2 left-0 w-full z-30 pointer-events-none">
        <div className="flex items-center justify-center pointer-events-auto">
            <GameControls G={G} ctx={ctx} moves={moves} playerID={playerID} />
        </div>
    </div>
)}

// 之后：左下角悬浮球
{!isSpectator && (
    <UndoFab
        G={G}
        ctx={ctx}
        moves={moves}
        playerID={playerID}
        isGameOver={!!isGameOver}
    />
)}
```

### 4. 国际化翻译
**文件**: 
- `public/locales/zh-CN/game.json`
- `public/locales/en/game.json`

新增翻译键：
- `controls.undo.expand`: 展开提示
- `controls.undo.collapse`: 收起提示
- `controls.undo.title`: 面板标题
- `controls.undo.reviewHint`: 审批提示
- `controls.undo.requestHint`: 申请提示
- `controls.undo.historyCount`: 历史计数

更新现有翻译键：
- `controls.undo.waiting`: 从"等待批准中..."改为"等待对方批准..."
- `controls.undo.cancel`: 从"取消"改为"取消申请"
- `controls.undo.opponentRequest`: 从"对手请求撤销"改为"对方请求撤回"
- `controls.undo.approve`: 从"接受"改为"同意"
- `controls.undo.request`: 从"撤销操作"改为"申请撤回"

### 5. 文档
**文件**: 
- `docs/components/UndoFab.md` - 完整使用文档
- `docs/components/UndoFab-CHANGELOG.md` - 本更改日志

## 优势

### 相比原有实现的改进：

1. **不遮挡游戏界面**
   - 原方案：底部固定，占据空间
   - 新方案：可拖动悬浮球，不占据固定空间

2. **更好的用户体验**
   - 可以拖动到任意位置
   - 收起时只显示小图标
   - 展开时提供完整信息

3. **统一的交互模式**
   - 与 GameHUD 使用相同的 FabMenu 组件
   - 保持一致的视觉风格

4. **更清晰的状态展示**
   - 三种状态有明确的视觉区分
   - 提供详细的提示信息
   - 显示可撤回步数

5. **更好的可维护性**
   - 单一组件，易于维护
   - 完整的 TypeScript 类型支持
   - 清晰的 Props 接口

## 向后兼容

- ✅ 保留了原有的 `GameControls` 组件（可用于其他场景）
- ✅ 使用相同的撤回系统 API（`UNDO_COMMANDS`）
- ✅ 支持所有现有的撤回逻辑
- ✅ 不影响其他游戏的实现

## 迁移指南

### 对于新游戏
直接使用 `UndoFab` 组件：
```tsx
import { UndoFab } from '../../components/game/UndoFab';

// 在 Board 组件中
{!isSpectator && (
    <UndoFab
        G={G}
        ctx={ctx}
        moves={moves}
        playerID={playerID}
        isGameOver={!!isGameOver}
    />
)}
```

### 对于现有游戏
1. 如果使用 `GameControls` 底部固定方案，可以替换为 `UndoFab`
2. 如果有自定义撤回 UI，可以继续使用或迁移到 `UndoFab`
3. 如果没有撤回功能，可以轻松添加 `UndoFab`

## 测试建议

1. **基础功能**
   - ✅ 悬浮球显示/隐藏
   - ✅ 拖动定位
   - ✅ 展开/收起

2. **撤回流程**
   - ✅ 申请撤回
   - ✅ 审批撤回（同意/拒绝）
   - ✅ 取消申请
   - ✅ 等待状态显示

3. **边界情况**
   - ✅ 游戏结束时隐藏
   - ✅ 观战者不显示
   - ✅ 无历史记录时不显示
   - ✅ 多人游戏握手机制

4. **国际化**
   - ✅ 中文显示
   - ✅ 英文显示
   - ✅ 回退到默认文本

## 未来计划

可能的增强功能：
- [ ] 撤回历史预览（显示将要撤回到的状态）
- [ ] 批量撤回（一次撤回多步）
- [ ] 撤回动画效果
- [ ] 快捷键支持（如 Ctrl+Z）
- [ ] 本地游戏的单人撤回（无需批准）
- [ ] 撤回次数限制配置

## 相关文件

### 新增文件
- `src/components/game/UndoFab.tsx`
- `src/components/game/index.ts`
- `docs/components/UndoFab.md`
- `docs/components/UndoFab-CHANGELOG.md`

### 修改文件
- `src/games/tictactoe/Board.tsx`
- `public/locales/zh-CN/game.json`
- `public/locales/en/game.json`

### 保留文件
- `src/components/game/GameControls.tsx`（可用于其他场景）

## 版本信息
- 创建日期：2026-01-27
- 基于框架：boardgame.io + React + TypeScript
- 测试环境：井字棋游戏
