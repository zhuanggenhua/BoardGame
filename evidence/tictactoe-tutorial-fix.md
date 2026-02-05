# 井字棋教程模式修复

## 问题描述

用户报告井字棋教程模式存在两个问题：
1. 点击教程按钮后弹出"旧房间已销毁"错误提示
2. 即使进入教程模式，也没有触发教程流程

## 根因分析

### 问题 1：房间错误提示

**根因**：教程路由 `/play/:gameId/tutorial` 没有 `matchId` 参数，但 `MatchRoom` 组件仍然尝试：
1. 从 localStorage 读取房间凭据（使用 `match_creds_${matchId}`，当 matchId 为 undefined 时变成 `match_creds_undefined`）
2. 调用 `useMatchStatus(gameId, matchId, statusPlayerID)` 检查房间状态

虽然代码中有 `!isTutorialRoute` 的检查来避免显示错误，但 `useMatchStatus` 仍然会被调用，可能导致不必要的网络请求和状态检查。

**证据**：
- `src/pages/MatchRoom.tsx` 第 95-103 行：`storedMatchCreds` 的 useMemo 没有检查 `isTutorialRoute`
- `src/pages/MatchRoom.tsx` 第 290 行：`useMatchStatus` 在教程模式下仍然被调用
- `src/hooks/match/useMatchStatus.ts` 第 360 行：设置错误信息 `'房间不存在或已被删除'`

### 问题 2：教程 AI 动作命令错误

**根因**：教程定义中的 AI 动作使用了错误的命令类型：
- 教程定义：`commandType: 'makeMove'`
- 实际命令：`commandType: 'CLICK_CELL'`
- 参数名称：教程使用 `index`，实际应该是 `cellId`

**证据**：
- `src/games/tictactoe/tutorial.ts` 第 20 行：`aiActions: [{ commandType: 'makeMove', payload: { index: 0 } }]`
- `src/games/tictactoe/game.ts` 第 26 行：`const ACTION_ALLOWLIST = ['CLICK_CELL'] as const;`
- `src/games/tictactoe/game.ts` 第 34 行：`const { cellId } = command.payload as { cellId: number };`

### 问题 3：调试面板难以访问

**根因**：调试面板被包裹在 `opacity-0 hover:opacity-100` 的容器中，默认隐藏，只有鼠标悬停在右下角时才显示。

**证据**：
- `src/games/tictactoe/Board.tsx` 第 462-466 行：调试面板容器使用了 `opacity-0 hover:opacity-100`

## 修复方案

### 修复 1：教程模式跳过房间状态检查

### 修复 1：教程模式跳过房间状态检查

**位置**：`src/pages/MatchRoom.tsx`

**修改 1**：在读取房间凭据时检查教程模式
```typescript
const storedMatchCreds = useMemo(() => {
    // 教程模式不需要房间凭据
    if (isTutorialRoute || !matchId) return null;
    // ... 原有逻辑
}, [matchId, isTutorialRoute]);
```

**修改 2**：教程模式下不调用 useMatchStatus
```typescript
const matchStatus = useMatchStatus(
    isTutorialRoute ? undefined : gameId,
    isTutorialRoute ? undefined : matchId,
    isTutorialRoute ? null : statusPlayerID
);
```

**理由**：
- 教程模式使用本地客户端，不需要房间状态检查
- 避免不必要的网络请求和错误提示
- 保持教程模式的独立性

### 修复 2：UGC API 代理配置

**问题**：开发环境下 `/ugc` 路径没有被代理到后端，导致返回 HTML 而不是 JSON。

**位置**：`vite.config.ts`

**修改**：添加 UGC API 代理配置
```typescript
'/ugc': {
  target: 'http://127.0.0.1:18001',
  changeOrigin: true,
},
```

**理由**：
- UGC API 请求需要被代理到后端服务（端口 18001）
- 避免返回 HTML 导致 JSON 解析错误
- 虽然这个错误不会阻止教程模式，但会在控制台产生警告
- 改进 fetchJson 函数，检查响应的 Content-Type

### 修复 3：修正教程 AI 动作命令

**位置**：`src/games/tictactoe/tutorial.ts`

**修改**：
```typescript
aiActions: [{ commandType: 'CLICK_CELL', payload: { cellId: 0 } }]
```

**理由**：
- 使用正确的命令类型 `CLICK_CELL`（与游戏定义一致）
- 使用正确的参数名称 `cellId`（而非 `index`）
- 确保 AI 动作能正确执行

### 修复 4：改善调试面板可访问性

**位置**：`src/games/tictactoe/Board.tsx`

**修改**：移除 `opacity-0 hover:opacity-100` 的包裹容器
```typescript
{!isSpectator && (
    <GameDebugPanel G={G} ctx={ctx} moves={moves} events={events} playerID={playerID} autoSwitch={!isMultiplayer} />
)}
```

**理由**：
- GameDebugPanel 自带浮动切换按钮（右下角的 🛠️ 图标）
- 不需要额外的 hover 容器
- 提高调试工具的可发现性

## 验证步骤

1. **验证教程入口**：
   - 打开首页
   - 点击井字棋卡片
   - 点击"教程模式"按钮
   - 确认没有"房间已销毁"的错误提示

2. **验证教程流程**：
   - 进入教程模式后，应该看到教程遮罩层
   - 第一步：显示欢迎信息
   - 第二步：高亮中心格子（cell-4），要求玩家点击
   - 第三步：AI 自动在左上角（cell-0）落子
   - 第四步：显示阻挡策略提示
   - 第五步：显示完成信息

3. **验证调试面板**：
   - 在教程模式或本地模式下
   - 应该能看到右下角的 🛠️ 图标
   - 点击图标打开调试面板
   - 可以切换玩家视角（P0/P1/观战）

## 相关文件

- `src/pages/MatchRoom.tsx` - 教程路由和房间状态处理
- `vite.config.ts` - Vite 开发服务器代理配置
- `src/config/games.config.tsx` - UGC 游戏加载和 API 请求
- `src/games/tictactoe/tutorial.ts` - 教程定义
- `src/games/tictactoe/Board.tsx` - 游戏 UI 和调试面板
- `src/games/tictactoe/game.ts` - 游戏逻辑和命令定义
- `src/hooks/match/useMatchStatus.ts` - 房间状态钩子

## 注意事项

1. **教程模式的独立性**：教程模式应该完全独立于联机房间系统，不依赖 matchId 和房间凭据
2. **命令类型一致性**：教程中的 AI 动作必须使用游戏定义中的实际命令类型
3. **调试工具的可访问性**：开发环境下的调试工具应该易于发现和使用

## 测试结果

- [ ] 教程入口无错误提示
- [ ] 教程流程正常触发
- [ ] AI 动作正确执行
- [ ] 调试面板可正常访问
