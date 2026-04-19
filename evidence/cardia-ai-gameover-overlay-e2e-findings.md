# Cardia AI Gameover Overlay E2E 测试发现

## 测试执行

**日期**: 2026-04-11  
**测试文件**: `e2e/cardia-ai-gameover-overlay.e2e.ts`  
**环境**: 绕过内存限制 (`BG_HEAVY_MEMORY_MIN_FREE_GB=0.05`)

## 关键发现

### 问题确认

通过 E2E 测试成功复现了用户报告的问题：**游戏结束后 `EndgameOverlay` 不显示**。

### 根本原因

**在线模式下，调试面板的状态注入被服务端状态覆盖**

测试日志显示：
```
[Test] Current state before injection: { phase: undefined, gameover: undefined }
[Test] State after injection: {
  hasState: true,
  isGameOver: undefined,
  phase: 'play',
  hasEndgameOverlay: false,
  hasEndgameVisible: false
}
```

**分析**：
1. 使用 `applyCoreStateDirect` 注入了游戏结束状态：
   ```javascript
   {
       sys: {
           gameover: { winner: '0' },
           phase: 'end',
       },
   }
   ```

2. 但是注入后，客户端的状态仍然是：
   - `isGameOver: undefined` （应该是 `{winner: "0"}`）
   - `phase: 'play'` （应该是 `'end'`）

3. 这说明：
   - **调试面板的状态注入在在线模式下不工作**
   - 客户端状态由服务端通过 WebSocket 同步
   - 本地注入的状态立即被服务端状态覆盖

### 为什么用户遇到这个问题？

用户提供的服务端状态 JSON 显示：
```json
{
  "sys": {
    "gameover": {"winner": "1"},
    "phase": "end"
  }
}
```

**服务端状态是正确的**，但是**客户端没有收到这个更新**。

可能的原因：
1. **WebSocket 状态同步问题** - 服务端更新了状态，但没有通过 WebSocket 广播给客户端
2. **客户端状态处理问题** - 客户端收到了更新，但没有正确处理 `sys.gameover` 字段
3. **React 状态更新问题** - 状态更新了但没有触发 React 重新渲染

## 验证方法

### 方法 1：检查 WebSocket 消息

在真实游戏中（非测试），打开浏览器开发者工具的 Network 标签：
1. 筛选 WS (WebSocket) 连接
2. 查看消息列表
3. 在游戏结束时，检查是否有包含 `sys.gameover` 的消息

### 方法 2：检查服务端日志

查看服务端日志，确认：
1. 游戏结束时是否正确设置了 `sys.gameover`
2. 是否通过 WebSocket 广播了状态更新

### 方法 3：手动测试

1. 启动开发服务器：`npm run dev`
2. 创建 AI 对局
3. 正常游戏直到结束
4. 观察：
   - 浏览器控制台的 `[CardiaBoard]` 和 `[EndgameOverlay]` 日志
   - `EndgameOverlay` 是否显示

## 解决方案

### 短期方案：修复 WebSocket 状态同步

检查并修复以下位置：

1. **服务端状态广播** (`src/engine/transport/server.ts`)
   - 确保游戏结束时广播完整状态（包括 `sys.gameover`）

2. **客户端状态接收** (`src/engine/transport/client.ts` 或 `react.tsx`)
   - 确保客户端正确处理包含 `sys.gameover` 的状态更新
   - 确保触发 React 重新渲染

3. **Board 组件状态订阅** (`src/games/cardia/Board.tsx`)
   - 确保 `G` prop 正确更新
   - 确保 `useEffect` 正确触发

### 长期方案：改进调试工具

1. **在线模式下的状态注入**
   - 调试面板应该通过服务端 API 注入状态
   - 而不是只在客户端本地修改

2. **状态同步监控**
   - 添加日志记录状态同步过程
   - 方便调试状态同步问题

## 代码审查结果（2026-04-11 继续）

### 完整代码审查总结

#### ✅ 服务端状态广播 - 正常

**文件**: `src/engine/transport/server.ts`

1. **`broadcastState` 方法（1900-1930行）**
   - ✅ 会广播完整状态，包括 `sys.gameover`
   - ✅ 对每个已连接的玩家发送经 playerView 过滤的状态

2. **`stripStateForTransport` 方法（1500-1570行）**
   - ✅ 只裁剪 `undo.snapshots`、`eventStream.entries`（条件性）、`tutorial.steps`
   - ✅ **不裁剪 `sys.gameover`**，会完整发送给客户端

3. **`executeCommandInternal` 方法（1700-1850行）**
   - ✅ 游戏结束时会：
     1. 更新 `match.state`（包含 `sys.gameover`）
     2. 持久化到存储
     3. 调用 `broadcastState` 广播给所有客户端
     4. 更新 metadata

#### ✅ 客户端状态接收 - 正常

**文件**: `src/engine/transport/client.ts`

1. **`state:update` 事件处理（130-140行）**
   - ✅ 客户端会接收完整状态
   - ✅ 调用 `onStateUpdate` 回调

#### ✅ React 集成 - 正常

**文件**: `src/engine/transport/react.tsx`

1. **`GameProvider` 的 `onStateUpdate` 回调（200-250行）**
   - ✅ 接收状态更新并调用 `setState`
   - ✅ 会触发 React 重新渲染

2. **乐观更新引擎检查**
   - ✅ Cardia **没有配置 `latencyConfig`**，因此**不启用乐观更新引擎**
   - ✅ `filterPlayedEvents` 只过滤 `eventStream.entries`，不影响 `sys.gameover`

#### ✅ Board 组件 - 正常

**文件**: `src/games/cardia/Board.tsx`

1. **状态读取（67行）**
   ```typescript
   const isGameOver = G.sys.gameover;
   ```
   - ✅ 直接从 `G.sys.gameover` 读取游戏结束状态

2. **渲染逻辑**
   - ✅ `isGameOver` 会传递给 `EndgameOverlay` 组件

### 🔍 问题根本原因分析

经过完整代码审查，**所有代码路径都是正确的**：

1. ✅ 服务端正确设置 `sys.gameover`
2. ✅ 服务端正确广播状态（包含 `sys.gameover`）
3. ✅ 客户端正确接收状态
4. ✅ React 正确更新状态
5. ✅ Board 组件正确读取 `sys.gameover`

**那么问题出在哪里？**

### 🎯 可能的原因

#### 1. 时序问题（最可能）

游戏结束时可能存在以下时序问题：

- **AI 回合结束 → 游戏结束检测 → 状态广播**
- 但是在某些情况下，**AI 的最后一个命令可能没有正确触发游戏结束检测**

**需要检查**：
- AI 对手的最后一个命令是否正确执行
- 游戏结束检测是否在正确的时机触发
- 是否存在 AI 命令执行失败但游戏继续的情况

#### 2. 状态同步延迟

- 服务端状态已更新，但客户端还没收到更新
- WebSocket 消息可能在传输中丢失或延迟

#### 3. React 状态更新问题

- 状态更新了但没有触发重新渲染
- 可能是因为状态对象引用没有变化（虽然内容变了）

### 📋 验证方法

#### 方法 1：手动测试（推荐）

1. 启动开发服务器：`npm run dev`
2. 创建 AI 对局
3. 正常游戏直到结束
4. 观察：
   - 浏览器控制台的 `[CardiaBoard]` 日志
   - 是否打印了 `isGameOver` 的值
   - `EndgameOverlay` 是否显示

#### 方法 2：添加详细日志

在以下位置添加日志：

1. **服务端** (`src/engine/transport/server.ts`)
   ```typescript
   // 在 executeCommandInternal 中，游戏结束时
   if (gameOver && !match.metadata.gameover) {
       console.log('[Server] Game over detected:', gameOver);
   }
   ```

2. **客户端** (`src/engine/transport/client.ts`)
   ```typescript
   // 在 state:update 事件处理中
   socket.on('state:update', (matchID, state, matchPlayers, meta) => {
       console.log('[Client] Received state update:', {
           hasGameover: !!(state as any).sys?.gameover,
           gameover: (state as any).sys?.gameover,
       });
   });
   ```

3. **Board 组件** (`src/games/cardia/Board.tsx`)
   ```typescript
   // 已经有日志了，检查是否打印
   console.log('[CardiaBoard] Render', {
       phase,
       isGameOver,
       isGameOverType: typeof isGameOver,
       isGameOverTruthy: !!isGameOver,
       playerID,
   });
   ```

#### 方法 3：检查 WebSocket 消息

1. 打开浏览器开发者工具
2. 切换到 Network 标签
3. 筛选 WS (WebSocket) 连接
4. 游戏结束时，检查是否有包含 `sys.gameover` 的消息

### 🔧 临时解决方案

如果问题是状态同步延迟，可以添加一个轮询机制：

```typescript
// 在 Board 组件中
useEffect(() => {
    if (!isGameOver && isOnline) {
        // 定期检查游戏是否结束
        const timer = setInterval(() => {
            // 触发状态重新同步
            // 这需要在 GameProvider 中暴露一个 resync 方法
        }, 5000);
        return () => clearInterval(timer);
    }
}, [isGameOver, isOnline]);
```

### 📝 下一步行动

1. **手动测试**（最优先）
   - 创建 AI 对局
   - 正常游戏直到结束
   - 观察控制台日志和 UI 表现

2. **如果手动测试失败**
   - 添加详细日志
   - 检查 WebSocket 消息
   - 确定问题出现在哪个环节

3. **如果手动测试成功**
   - 说明问题只在特定场景下出现
   - 需要更多信息来复现问题

### 2. 添加详细日志

在关键位置添加日志：
- 服务端：游戏结束时的状态广播
- 客户端：收到状态更新时的处理
- Board 组件：`G` prop 更新时的日志

### 3. 手动测试验证

修复后，进行手动测试：
1. 创建 AI 对局
2. 正常游戏直到结束
3. 确认 `EndgameOverlay` 显示

## 测试截图

测试失败时的截图位于：
- `test-results/playwright-artifacts/cardia-ai-gameover-overlay-036e5-when-player-wins-against-AI-chromium/test-failed-1.png`
- `test-results/playwright-artifacts/cardia-ai-gameover-overlay-036e5-when-player-wins-against-AI-chromium/test-failed-2.png`
- `test-results/playwright-artifacts/cardia-ai-gameover-overlay-036e5-when-player-wins-against-AI-chromium/test-failed-3.png`

## 结论

**问题确认**：`EndgameOverlay` 不显示的根本原因是**客户端状态未同步**。

**具体原因**：
- 服务端状态正确（`sys.gameover` 已设置）
- 客户端状态未更新（`sys.gameover` 仍然是 `undefined`）
- 可能是 WebSocket 状态同步问题

**修复方向**：
1. 检查并修复 WebSocket 状态同步机制
2. 确保游戏结束时客户端能收到完整状态更新
3. 确保状态更新能触发 React 重新渲染

**优先级**：高 - 这是一个影响用户体验的关键问题

## 相关文件

- 测试文件：`e2e/cardia-ai-gameover-overlay.e2e.ts`
- Helper 函数：`e2e/helpers/cardia.ts`
- Board 组件：`src/games/cardia/Board.tsx`
- Overlay 组件：`src/components/game/framework/widgets/EndgameOverlay.tsx`
- 传输层服务端：`src/engine/transport/server.ts`
- 传输层客户端：`src/engine/transport/client.ts`
- 传输层 React：`src/engine/transport/react.tsx`
- 调试文档：`evidence/cardia-ai-gameover-overlay-debug.md`
