# Cardia AI Gameover 手动测试指南

## 目的

手动测试 Cardia 游戏中 AI 对战结束后 `EndgameOverlay` 是否正常显示。

## 前置条件

1. 开发服务器已启动：`npm run dev`
2. 浏览器开发者工具已打开（F12）
3. 控制台（Console）标签已打开

## 测试步骤

### 1. 创建 AI 对局

1. 打开浏览器访问：`http://localhost:5173`
2. 点击"Cardia"游戏卡片
3. 点击"创建对局"
4. 选择"AI 对手"
5. 点击"开始游戏"

### 2. 游戏过程

1. 正常进行游戏
2. **观察控制台日志**：
   - 每次渲染时应该看到 `[CardiaBoard] Render` 日志
   - 日志中应该包含 `isGameOver` 的值

### 3. 游戏结束

1. 继续游戏直到一方获胜
2. **观察控制台日志**：
   - 查找 `[CardiaBoard] Render` 日志
   - 检查 `isGameOver` 是否从 `undefined` 变成了 `{winner: "0"}` 或 `{winner: "1"}`
   - 查找 `[EndgameOverlay]` 相关日志

3. **观察 UI**：
   - 是否显示了游戏结束弹窗？
   - 弹窗是否显示了正确的胜利/失败信息？

## 预期结果

### 正常情况

1. **控制台日志**：
   ```
   [CardiaBoard] Render {
     phase: "end",
     isGameOver: {winner: "0"},
     isGameOverType: "object",
     isGameOverTruthy: true,
     playerID: "0"
   }
   ```

2. **UI 表现**：
   - 显示游戏结束弹窗
   - 弹窗显示"胜利"或"失败"
   - 弹窗显示正确的分数

### 异常情况

1. **控制台日志**：
   ```
   [CardiaBoard] Render {
     phase: "play" 或 "end",
     isGameOver: undefined,
     isGameOverType: "undefined",
     isGameOverTruthy: false,
     playerID: "0"
   }
   ```

2. **UI 表现**：
   - 没有显示游戏结束弹窗
   - 游戏界面保持在最后一个状态

## 额外检查

### 检查 WebSocket 消息

1. 打开浏览器开发者工具
2. 切换到 **Network** 标签
3. 筛选 **WS** (WebSocket) 连接
4. 点击 WebSocket 连接
5. 切换到 **Messages** 标签
6. 在游戏结束时，查找包含 `sys.gameover` 的消息

**预期**：应该看到一条消息，内容类似：
```json
{
  "sys": {
    "gameover": {"winner": "0"},
    "phase": "end",
    ...
  },
  ...
}
```

### 检查服务端日志

如果有访问服务端日志的权限，查找：

1. 游戏结束时的日志：
   ```
   [Server] Game over detected: {winner: "0"}
   ```

2. 状态广播日志：
   ```
   [GameTransport] broadcastState: ...
   ```

## 测试结果记录

### 测试信息

- **测试日期**：____________________
- **测试人员**：____________________
- **浏览器**：____________________
- **操作系统**：____________________

### 测试结果

- [ ] 游戏结束后显示了 `EndgameOverlay`
- [ ] 控制台日志显示 `isGameOver` 有值
- [ ] WebSocket 消息包含 `sys.gameover`
- [ ] 弹窗显示了正确的胜利/失败信息

### 问题描述

如果测试失败，请详细描述：

1. **控制台日志**：
   ```
   （粘贴相关日志）
   ```

2. **WebSocket 消息**：
   ```
   （粘贴相关消息）
   ```

3. **UI 表现**：
   ```
   （描述看到的现象）
   ```

4. **复现步骤**：
   ```
   （描述如何复现问题）
   ```

## 故障排查

### 如果 `EndgameOverlay` 不显示

1. **检查 `isGameOver` 值**：
   - 如果是 `undefined`，说明客户端没有收到游戏结束状态
   - 检查 WebSocket 消息是否包含 `sys.gameover`

2. **检查 WebSocket 连接**：
   - 确认 WebSocket 连接正常
   - 确认没有连接断开或重连

3. **检查服务端日志**：
   - 确认服务端检测到了游戏结束
   - 确认服务端广播了状态更新

### 如果 WebSocket 消息正常但 UI 不显示

1. **检查 React 状态更新**：
   - 在 `GameProvider` 的 `onStateUpdate` 中添加日志
   - 确认 `setState` 被调用

2. **检查 Board 组件渲染**：
   - 确认 `CardiaBoard` 组件重新渲染
   - 确认 `isGameOver` prop 传递给了 `EndgameOverlay`

3. **检查 `EndgameOverlay` 组件**：
   - 确认组件接收到了 `isGameOver` prop
   - 确认组件的显示逻辑正确

## 相关文件

- Board 组件：`src/games/cardia/Board.tsx`
- Overlay 组件：`src/components/game/framework/widgets/EndgameOverlay.tsx`
- 传输层服务端：`src/engine/transport/server.ts`
- 传输层客户端：`src/engine/transport/client.ts`
- 传输层 React：`src/engine/transport/react.tsx`

## 参考文档

- E2E 测试发现：`evidence/cardia-ai-gameover-overlay-e2e-findings.md`
- 调试指南：`evidence/cardia-ai-gameover-overlay-debug.md`
