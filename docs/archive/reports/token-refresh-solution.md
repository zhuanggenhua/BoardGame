# WebSocket 自动重连方案归档

本文是旧自动重连方案记录，不作为当前传输层合同。当前是否仍使用这些机制，必须以现有传输层代码、socket 服务和测试为准。本文保留当时问题形状、方案分层、覆盖范围和测试建议。

## 当时问题

浏览器标签页或窗口失焦十几分钟后，WebSocket 可能断开且不会及时自动重连。旧文档记录了四个触发条件：

- Chrome 88+ 会对后台标签页 timer 节流，甚至冻结 JS 执行。
- socket.io 心跳超时后服务端会断开连接。
- socket.io 虽然配置了 `reconnection: true`，但浏览器节流会让重连逻辑延迟执行。
- 页面一直保持可见但浏览器在后台时，`visibilitychange` 不一定触发。

现实后果是大厅、社交消息、对局聊天或对局状态无法实时更新，用户可能需要刷新页面恢复。

## 当时方案

### 主动健康检查

当时新增统一 `socketHealthChecker`，定期检查 socket 状态：

- 默认每 30 秒检查一次。
- 发现断开时主动调用 `socket.connect()`。
- 用一个工具统一管理多个 socket 服务。
- 启动时先清理同名定时器，避免重复健康检查。

旧接口形态：

```ts
class SocketHealthChecker {
  start(config: {
    name: string;
    getSocket: () => Socket | null;
    isConnected?: () => boolean;
    interval?: number;
  }): () => void;
}
```

### 页面可见性恢复

当时已有 `visibilityResync`：

- 监听 `visibilitychange`。
- 页面恢复可见时检查连接并重连。
- 对局内恢复可见时触发重新同步。

### socket.io 自动重连

当时仍保留 socket.io 自带重连：

- `reconnectionAttempts: Infinity`
- `reconnectionDelay: 1000`

旧方案的意图是三层兜底：socket.io 自动重连、页面恢复可见同步、主动健康检查。

## 覆盖的服务

旧文档记录当时覆盖：

- `LobbySocket`：大厅房间列表实时更新。
- `SocialSocket`：好友在线状态、聊天消息、游戏邀请。
- `MatchSocket`：对局内重赛投票和聊天。
- `GameTransportClient`：游戏状态同步。

对局内额外处理：

- 页面恢复可见时 `resync()` 重新同步状态。
- 重置乐观更新队列，避免过时 pending 命令继续影响显示。
- sync 超时后重试，旧记录为 5 秒内未收到响应时重试、最多 5 次。
- socket.io 重连成功后自动发送 sync 请求。

## 参数权衡

- 30 秒检查间隔是实时性和性能/耗电的折中。
- 浏览器完全冻结时，健康检查仍可能被暂停，恢复可见后仍要靠可见性同步补救。
- 服务端心跳超时时间应大于客户端检查间隔；旧建议是服务端超时不少于 60 秒。

## 当时测试建议

- 首页失焦：打开首页，切到其它应用约 15 分钟，回来检查房间列表是否更新。
- 后台标签页：切到其它标签约 15 分钟，回来检查连接状态。
- 对局失焦：进入对局后切走约 15 分钟，回来检查状态同步并尝试执行操作。
- 网络波动：断网 1 分钟后恢复，检查是否自动重连。
- 控制台观察：搜索 `[SocketHealthCheck]` 或 `[GameTransport]`，确认健康检查和重连日志。

## 当时相关文件

- `src/services/socketHealthCheck.ts`
- `src/services/lobbySocket.ts`
- `src/services/socialSocket.ts`
- `src/services/matchSocket.ts`
- `src/engine/transport/client.ts`
- `src/engine/transport/react.tsx`
- `src/services/visibilityResync.ts`

## 当前使用口径

- 本文只能说明旧问题和旧方案，不证明当前线上链路已经闭合。
- 当前排查要回到真实 socket 服务、当前传输层标准、服务端心跳配置和重连日志。
- 如果只是重连日志变少，不等于问题修复；最终要验证真实消息、房间列表或对局状态能恢复。
