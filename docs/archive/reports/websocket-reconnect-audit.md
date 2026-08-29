# WebSocket 自动重连功能审查归档

本文是 2026-02-22 的历史审查记录，不作为当前传输层规范或完成状态来源。当前是否仍成立，必须回到现有源码、传输层标准和测试结果验证。

## 当时审查范围

- Token 自动刷新机制。
- WebSocket 健康检查机制。
- Lobby、Social、Match 和 GameTransportClient 的重连集成。
- `App.tsx` 的 Provider 结构。
- 定时器、事件监听、重复启动和卸载清理。

## 当时结论

当时审查结论为通过。旧文档记录的已通过检查包括：

- TypeScript 编译检查无错误。
- Token 刷新定时器有清理逻辑。
- 可见性监听在组件卸载时移除。
- 健康检查 start 前会 stop 同名检查，避免重复定时器。
- socket 为空时安全返回。
- 主动重连异常被捕获并记录。

## 关键审查点

### Token 自动刷新

旧审查关注点：

- token 为空时清理 timer。
- `useEffect` cleanup 同时清理 timer 和 `visibilitychange`。
- token 解析失败时不执行刷新。
- token 已过期或刷新失败时退出登录。
- 页面恢复可见且 token 即将过期时立即刷新。
- 刷新后通过 `localStorage` 和 storage 事件通知其它标签页。

旧实现位置：

- `src/hooks/useTokenRefresh.ts`
- `src/App.tsx`

### Socket 健康检查

旧审查关注点：

- `socketHealthChecker` 是单例，避免多个实例抢同一 socket。
- 使用 `Map<string, number>` 管理多个定时器。
- `start()` 前先 `stop(name)`。
- `start()` 返回清理函数。
- `stop()` 幂等。
- `getSocket()` 返回空时不报错。
- `socket.connect()` 外层有异常捕获。

旧实现位置：

- `src/services/socketHealthCheck.ts`

### Socket 服务集成

旧审查覆盖：

- `LobbySocket`：只在创建 socket 时启动健康检查，`disconnect()` 清理可见性监听和健康检查。
- `SocialSocket`：token 相同时只重连；token 变化时复用现有 socket，不重复启动健康检查。
- `MatchSocket`：通过 `isConnecting` 和已有 socket 检查避免并发连接。
- `GameTransportClient`：对局内重连后触发状态同步。

### App Provider 结构

旧文档记录当时曾修复 `src/App.tsx` 重复 Provider 问题，避免 token 刷新 hook 或 socket 生命周期被重复挂载。

## 当时建议测试

- 页面失焦后恢复，确认大厅/社交/对局 socket 都能恢复。
- 网络断开再恢复，确认消息和状态继续同步。
- 多标签页登录态刷新，确认 token 更新同步。
- 对局内恢复后，确认 pending 命令不会用旧状态继续提交。

## 当前使用口径

- 本文不是当前验收结果。
- 当前若排查重连问题，应先看现有传输层、真实 socket 日志和用户实际断线场景。
- 定时器清理、防重复启动、token 刷新和对局状态同步要分开验收，不能用其中一项通过代表全链路通过。
