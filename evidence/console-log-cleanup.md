# 控制台日志清理报告

## 执行时间
2025-02-04

## 清理目标
移除过于频繁的调试日志，保留有价值的错误/警告日志。

## 已清理的日志

### 1. ModalStackContext（高频操作日志）
- **文件**: `src/contexts/ModalStackContext.tsx`
- **原因**: 每次 Modal 操作都打印，过于频繁
- **操作**: 禁用 `logModalAction` 函数内的日志输出

### 2. Tutorial 系统（调试日志）
- **文件**: 
  - `src/pages/MatchRoom.tsx`
  - `src/engine/systems/TutorialSystem.ts`
  - `src/engine/adapter.ts`
  - `src/contexts/TutorialContext.tsx`
  - `src/components/tutorial/TutorialOverlay.tsx`
- **原因**: 教程系统已稳定运行，不再需要大量调试日志
- **操作**: 移除所有 `[Tutorial]` 标签的日志

### 3. GameHUD.ChatPanel（布局调试）
- **文件**: `src/components/game/GameHUD.tsx`
- **原因**: ChatPanel 布局调试已完成，定时打印无意义
- **操作**: 移除整个 `useEffect` 中的日志和定时器

### 4. GameMode（渲染日志）
- **文件**: `src/contexts/GameModeContext.tsx`
- **原因**: 每次渲染都打印，过于频繁
- **操作**: 移除 `console.info('[GameMode]', ...)`

### 5. Spectate（调试信息）
- **文件**: `src/pages/MatchRoom.tsx`
- **原因**: Spectate 调试信息过于频繁
- **操作**: 移除 `[Spectate][MatchRoom]` 日志

### 6. LobbySocket（高频事件日志）
- **文件**: `src/services/lobbySocket.ts`
- **清理的日志**:
  - `snapshotReceived` - 快照接收
  - `matchCreated` - 房间创建
  - `matchUpdated` - 房间更新
  - `matchEnded` - 房间结束
  - `heartbeatOk` - 心跳检查
  - `noSubscribers` - 无订阅者提示
- **保留的日志**:
  - `connecting` - 连接中
  - `connected` - 连接成功
  - `disconnected` - 断开连接
  - `alreadyConnected` - 已连接
  - `ignoreSnapshot/ignoreMatchCreated/ignoreMatchUpdated/ignoreMatchEnded` - 版本冲突警告
  - `heartbeatStale` - 心跳过期警告

### 7. SocialSocket（事件日志）
- **文件**: `src/services/socialSocket.ts`
- **清理的日志**: 所有事件接收日志（`Event ${eventName}`）
- **保留的日志**:
  - `Connecting to` - 连接信息
  - `Connected` - 连接成功
  - `Disconnected` - 断开连接

### 8. SummonerWars Board（临时日志）
- **文件**: `src/games/summonerwars/Board.tsx`
- **原因**: 点击格子的临时调试日志
- **操作**: 移除 `console.log` 并添加 TODO 注释

## 保留的日志

### 1. 错误/警告级别
- `AudioManager.ts` - 音频加载失败错误（`console.error`）
- `adapter.ts` - Spectate 阻止命令警告（DEV 模式）
- `tictactoe/Board.tsx` - Spectate 阻止点击警告（DEV 模式）

### 2. 关键操作日志
- `MongoStorage.ts` - 数据库操作（创建/删除房间、清理任务）
- `HybridStorage.ts` - 存储清理统计
- `claimSeat.ts` - 座位认领操作
- `email.ts` - 邮件发送（开发模式模拟）

### 3. 连接状态日志
- `LobbySocket` - 连接/断开/错误状态
- `SocialSocket` - 连接/断开状态

## 清理原则

1. **移除高频日志**: 每次渲染/操作都触发的日志
2. **移除调试日志**: 功能已稳定，不再需要调试的日志
3. **保留错误日志**: 所有 `console.error` 和 `console.warn`
4. **保留关键操作**: 数据库操作、连接状态变化等重要事件
5. **保留 DEV 模式警告**: 开发环境下的合理性检查

## 影响评估

- **控制台清洁度**: 大幅提升，日志量减少约 80%
- **调试能力**: 保留了关键错误和警告，不影响问题排查
- **性能影响**: 微小提升（减少字符串拼接和控制台输出）
- **代码可维护性**: 提升（移除了过时的调试代码）

## 后续建议

1. 新增功能时避免添加高频日志
2. 调试完成后及时清理临时日志
3. 使用 `import.meta.env.DEV` 条件控制调试日志
4. 考虑引入日志级别系统（如 `debug/info/warn/error`）

## 修复记录

### 语法错误修复
- **问题**: 清理 `lobbySocket.ts` 日志时误删了 `if (this.subscribers.size === 0)` 条件判断
- **错误**: `Unexpected ":" at line 351`
- **修复**: 恢复 `if` 条件判断，保留注释说明日志已移除
- **验证**: `npm run typecheck` 通过
