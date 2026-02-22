# WebSocket 自动重连解决方案

## 问题描述

浏览器标签页失焦十几分钟后 WebSocket 断开且不会自动重连，因为：

1. **浏览器后台节流**：Chrome 88+ 会对后台标签页进行 timer 节流甚至冻结 JS 执行
2. **心跳超时**：socket.io 心跳超时导致服务端断开连接
3. **自动重连失效**：虽然配置了 `reconnection: true`，但浏览器节流导致重连逻辑无法及时执行
4. **页面保持可见**：如果页面一直保持可见但浏览器在后台（如切换到其他应用），`visibilitychange` 事件不会触发

## 解决方案

### 1. 主动健康检查机制（新增）

实现了 `socketHealthChecker` 工具，定期检查 socket 连接状态并主动重连：

- **定期检查**：每 30 秒检查一次连接状态
- **主动重连**：发现断开时立即调用 `socket.connect()`
- **独立于浏览器节流**：使用 `setInterval` 定期执行，不依赖 socket.io 的自动重连
- **多 socket 支持**：统一管理所有 socket 服务的健康检查

### 2. 页面可见性恢复机制（已有）

`visibilityResync` 机制在页面恢复可见时触发重连：

- **visibilitychange 事件**：监听标签页从后台恢复到前台
- **立即重连**：页面恢复可见时检查连接状态并重连
- **适用场景**：标签页切换、最小化窗口恢复

### 3. socket.io 自动重连（已有）

socket.io 内置的自动重连机制：

- **无限重连**：`reconnectionAttempts: Infinity`
- **重连延迟**：`reconnectionDelay: 1000`（1秒）
- **适用场景**：网络波动、服务端重启

## 技术实现

### 健康检查工具

```typescript
// src/services/socketHealthCheck.ts
class SocketHealthChecker {
    start(config: {
        name: string;
        getSocket: () => Socket | null;
        isConnected?: () => boolean;
        interval?: number; // 默认 30000ms (30秒)
    }): () => void;
}
```

### 集成方式

在每个 socket 服务中集成健康检查：

```typescript
// lobbySocket.ts / socialSocket.ts / matchSocket.ts
private setupHealthCheck(): void {
    this._cleanupHealthCheck = socketHealthChecker.start({
        name: 'LobbySocket',
        getSocket: () => this.socket,
        isConnected: () => this.isConnected,
        interval: 30000,
    });
}
```

### 三层保障机制

1. **主动健康检查**（新增）：每 30 秒检查一次，发现断开立即重连
2. **页面可见性恢复**（已有）：标签页恢复可见时检查并重连
3. **socket.io 自动重连**（已有）：网络波动时自动重连

## 用户体验改进

### 之前

- 标签页失焦 10-15 分钟后 WebSocket 断开
- 页面保持可见但无法接收实时更新
- 需要手动刷新页面才能恢复连接

### 之后

- 每 30 秒自动检查连接状态
- 发现断开立即重连，最多延迟 30 秒
- 用户无感知，持续保持实时连接

## 覆盖的 Socket 服务

1. **LobbySocket**：大厅房间列表实时更新
2. **SocialSocket**：好友在线状态、聊天消息、游戏邀请
3. **MatchSocket**：对局内重赛投票、聊天消息
4. **GameTransportClient**：游戏状态同步（新增健康检查）

### 对局内的特殊处理

对局内的 `GameTransportClient` 除了健康检查外，还有额外的保障机制：

- **页面可见性恢复**：`visibilitychange` 事件触发 `resync()` 重新同步状态
- **乐观引擎重置**：页面恢复可见时重置乐观更新队列，避免过时的 pending 命令
- **sync 超时重试**：5 秒内未收到状态响应自动重试，最多 5 次
- **自动重连后 sync**：socket.io 重连成功后自动发送 sync 请求

这些机制确保对局内即使长时间失焦也能快速恢复到最新状态。

## 注意事项

1. **检查间隔**：30 秒是平衡性能和实时性的折中方案
   - 更短：更实时，但增加 CPU 占用
   - 更长：更省电，但断线恢复延迟更长

2. **浏览器节流**：即使有健康检查，浏览器仍可能节流 `setInterval`
   - Chrome 后台标签页：最小间隔 1 秒
   - 完全冻结：需要等待页面恢复可见

3. **服务端超时**：服务端心跳超时时间应大于客户端检查间隔
   - 建议：服务端超时 ≥ 60 秒（客户端 30 秒检查 + 30 秒容错）

## 测试建议

### 首页测试

1. **失焦测试**：
   - 打开首页，切换到其他应用
   - 等待 15 分钟
   - 切回浏览器，检查房间列表是否实时更新

2. **后台标签页测试**：
   - 打开首页，切换到其他标签页
   - 等待 15 分钟
   - 切回首页标签页，检查连接状态

### 对局内测试

1. **对局中失焦测试**：
   - 进入对局，切换到其他应用
   - 等待 15 分钟
   - 切回浏览器，检查游戏状态是否同步
   - 尝试执行操作，验证命令是否正常发送

2. **对局中后台标签页测试**：
   - 进入对局，切换到其他标签页
   - 等待 15 分钟
   - 切回对局标签页，检查状态同步

### 通用测试

1. **网络波动测试**：
   - 打开首页/对局，断开网络
   - 等待 1 分钟
   - 恢复网络，检查是否自动重连

2. **控制台监控**：
   - 打开控制台，搜索 `[SocketHealthCheck]` 或 `[GameTransport]`
   - 观察健康检查日志和重连日志

## 相关文件

- `src/services/socketHealthCheck.ts` - 健康检查工具（新增）
- `src/services/lobbySocket.ts` - 大厅 Socket 服务（已更新）
- `src/services/socialSocket.ts` - 社交 Socket 服务（已更新）
- `src/services/matchSocket.ts` - 对局 Socket 服务（已更新）
- `src/engine/transport/client.ts` - 游戏传输层客户端（已更新，新增健康检查）
- `src/engine/transport/react.tsx` - GameProvider（已有 visibilitychange 监听）
- `src/services/visibilityResync.ts` - 页面可见性恢复工具（已有）
