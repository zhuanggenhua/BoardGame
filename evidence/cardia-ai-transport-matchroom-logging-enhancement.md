# Cardia AI Transport MatchRoom Logging Enhancement

## 概述

为 `src/pages/MatchRoom.tsx` 和 `src/pages/onlineAiForceSkip.ts` 添加详细日志，用于调试 AI 座位 transport client 的 `sendBatch` 回调未触发问题。

## 修改文件

1. `src/pages/onlineAiForceSkip.ts`
2. `src/pages/MatchRoom.tsx`

## 修改内容

### 1. onlineAiForceSkip.ts

#### 增强的日志点

**submitOnlineAiResolution 函数**：

1. **提交开始日志**：
   - 时间戳
   - 玩家 ID
   - 动作 ID
   - 尝试键（attemptKey）
   - 批次 ID
   - 命令数量
   - 命令类型列表

2. **超时保护机制**（15 秒）：
   - 如果 `onConfirmed` 或 `onRejected` 在 15 秒内未触发
   - 自动调用 `onRejected('timeout')`
   - 记录超时警告日志
   - 避免无限等待

3. **确认回调日志**：
   - 确认时间戳
   - 玩家 ID
   - 尝试键
   - 批次 ID
   - 是否有权威状态
   - 权威状态类型

4. **拒绝回调日志**：
   - 拒绝时间戳
   - 玩家 ID
   - 尝试键
   - 批次 ID
   - 拒绝原因

5. **超时后回调警告**：
   - 如果回调在超时后才触发，记录警告日志
   - 防止重复处理

#### 代码示例

```typescript
export function submitOnlineAiResolution(args: {
    client: Pick<GameTransportClient, 'sendBatch' | 'updateLatestState'>;
    resolution: AiResolution;
    lastAiAttemptKeyRef: { current: string | null };
    scheduleRetry: () => void;
    onConfirmed?: (authoritativeState: MatchState<unknown> | unknown) => void;
    onRejected?: (reason: string) => void;
}): void {
    const {
        client,
        resolution,
        lastAiAttemptKeyRef,
        scheduleRetry,
        onConfirmed,
        onRejected,
    } = args;

    const batchId = buildAiBatchId(resolution.playerId, resolution.attemptKey);
    const commandTypes = resolution.action.commands.map(c => c.type);
    const timestamp = new Date().toISOString();

    console.log('=== KIRO DEBUG: SUBMIT AI RESOLUTION START ===');
    console.log('[submitOnlineAiResolution] Submitting AI action:', {
        timestamp,
        playerId: resolution.playerId,
        actionId: resolution.action.actionId,
        attemptKey: resolution.attemptKey,
        batchId,
        commandCount: resolution.action.commands.length,
        commandTypes,
    });

    lastAiAttemptKeyRef.current = resolution.attemptKey;

    // Add timeout protection (15 seconds)
    let callbackTriggered = false;
    const timeoutMs = 15000;
    const timeoutTimer = setTimeout(() => {
        if (!callbackTriggered) {
            console.warn('[submitOnlineAiResolution] Timeout - no callback received within', timeoutMs, 'ms', {
                playerId: resolution.playerId,
                attemptKey: resolution.attemptKey,
                batchId,
            });
            callbackTriggered = true;
            if (lastAiAttemptKeyRef.current === resolution.attemptKey) {
                lastAiAttemptKeyRef.current = null;
            }
            scheduleRetry();
            onRejected?.('timeout');
        }
    }, timeoutMs);

    client.sendBatch(
        batchId,
        resolution.action.commands.map((command) => ({
            type: command.type,
            payload: command.payload,
        })),
        (authoritativeState) => {
            if (callbackTriggered) {
                console.warn('[submitOnlineAiResolution] onConfirmed called after timeout', {
                    playerId: resolution.playerId,
                    attemptKey: resolution.attemptKey,
                    batchId,
                });
                return;
            }
            callbackTriggered = true;
            clearTimeout(timeoutTimer);

            const confirmTimestamp = new Date().toISOString();
            console.log('=== KIRO DEBUG: SUBMIT AI RESOLUTION CONFIRMED ===');
            console.log('[submitOnlineAiResolution] Action confirmed:', {
                confirmTimestamp,
                playerId: resolution.playerId,
                attemptKey: resolution.attemptKey,
                batchId,
                hasAuthoritativeState: !!authoritativeState,
                authoritativeStateType: typeof authoritativeState,
            });

            if (authoritativeState && typeof authoritativeState === 'object') {
                client.updateLatestState(authoritativeState);
            }
            onConfirmed?.(authoritativeState);
        },
        (reason) => {
            if (callbackTriggered) {
                console.warn('[submitOnlineAiResolution] onRejected called after timeout', {
                    playerId: resolution.playerId,
                    attemptKey: resolution.attemptKey,
                    batchId,
                    reason,
                });
                return;
            }
            callbackTriggered = true;
            clearTimeout(timeoutTimer);

            const rejectTimestamp = new Date().toISOString();
            console.log('=== KIRO DEBUG: SUBMIT AI RESOLUTION REJECTED ===');
            console.log('[submitOnlineAiResolution] Action rejected:', {
                rejectTimestamp,
                playerId: resolution.playerId,
                attemptKey: resolution.attemptKey,
                batchId,
                reason,
            });

            if (lastAiAttemptKeyRef.current === resolution.attemptKey) {
                lastAiAttemptKeyRef.current = null;
            }
            if (reason !== 'unauthorized') {
                scheduleRetry();
            }
            onRejected?.(reason);
        },
    );
}
```

### 2. MatchRoom.tsx

#### 增强的日志点

**OnlineAiSeatBridge 组件 - AI 座位 client 管理 useEffect**：

1. **Client 管理日志**：
   - 时间戳
   - 对局 ID
   - 下一批 client 键列表
   - 当前 client 键列表
   - 座位控制器类型映射
   - 座位凭据存在性映射

2. **Client 断开日志**：
   - 玩家 ID
   - 对局 ID

3. **Client 创建日志**：
   - 时间戳
   - 玩家 ID
   - 对局 ID
   - 服务器地址
   - 是否有凭据
   - 凭据长度

4. **状态更新回调日志**：
   - 时间戳
   - 玩家 ID
   - 对局 ID

5. **连接变化回调日志**：
   - 时间戳
   - 玩家 ID
   - 对局 ID
   - 连接状态
   - 是否已连接
   - Socket 是否已连接

**OnlineAiSeatBridge 组件 - AI 回合执行 useEffect**：

1. **触发日志**：
   - 时间戳
   - 是否有 AI 座位
   - 是否有状态
   - AI 重试版本
   - 连接版本
   - 上次尝试键

2. **runAiTurn 开始日志**：
   - 时间戳

3. **取消前日志**：
   - 时间戳

4. **无解决方案日志**：
   - 时间戳

5. **找到解决方案日志**：
   - 时间戳
   - 玩家 ID
   - 动作 ID
   - 尝试键
   - 命令数量
   - 命令类型列表

6. **重复尝试键日志**：
   - 时间戳
   - 尝试键

7. **Client 状态检查日志**：
   - 时间戳
   - 玩家 ID
   - 是否有控制器
   - 控制器类型
   - 是否有 client
   - 是否已连接
   - 连接状态
   - Socket 是否已连接
   - Socket ID

8. **无效控制器或未连接日志**：
   - 时间戳
   - 玩家 ID
   - 是否有控制器
   - 控制器类型
   - 是否有 client
   - 是否已连接

9. **等待最小延迟日志**：
   - 时间戳
   - 剩余延迟毫秒数
   - 玩家 ID

10. **延迟后取消或断开日志**：
    - 时间戳
    - 是否取消
    - 是否已连接
    - 玩家 ID

11. **提交 AI 解决方案日志**：
    - 时间戳
    - 玩家 ID
    - 尝试键

12. **调度重试日志**：
    - 时间戳
    - 玩家 ID

## 验证

### ESLint 检查

```bash
npx eslint src/pages/onlineAiForceSkip.ts src/pages/MatchRoom.tsx
```

**结果**：0 errors, 0 warnings

## 预期效果

### 正常流程日志示例

```
=== KIRO DEBUG: AI SEAT CLIENT MANAGEMENT ===
[OnlineAiSeatBridge] Managing AI seat clients: {
  timestamp: "2024-01-15T10:30:00.000Z",
  matchId: "abc123",
  nextClientKeys: ["1"],
  currentClientKeys: [],
  seatControllers: { "0": "human", "1": "ai" },
  hasSeatCredentials: { "0": true, "1": true }
}
[OnlineAiSeatBridge] Creating new AI seat client: {
  timestamp: "2024-01-15T10:30:00.001Z",
  playerId: "1",
  matchId: "abc123",
  server: "http://localhost:3001",
  hasCredential: true,
  credentialLength: 32
}
[OnlineAiSeatBridge] AI seat client connection changed: {
  timestamp: "2024-01-15T10:30:00.100Z",
  playerId: "1",
  matchId: "abc123",
  connectionState: "connected",
  isConnected: true,
  socketConnected: true
}
=== KIRO DEBUG: AI TURN EXECUTION TRIGGER ===
[OnlineAiSeatBridge] useEffect triggered: {
  timestamp: "2024-01-15T10:30:00.200Z",
  hasAiSeat: true,
  hasState: true,
  aiRetryVersion: 1,
  connectionVersion: 1,
  lastAiAttemptKey: null
}
[OnlineAiSeatBridge] runAiTurn started: { timestamp: "2024-01-15T10:30:00.201Z" }
[OnlineAiSeatBridge] Resolution found: {
  timestamp: "2024-01-15T10:30:00.250Z",
  playerId: "1",
  actionId: "select_faction",
  attemptKey: "1:0:select_faction",
  commandCount: 1,
  commandTypes: ["RESOLVE_INTERACTION"]
}
=== KIRO DEBUG: CLIENT STATUS CHECK ===
[OnlineAiSeatBridge] Checking client status: {
  timestamp: "2024-01-15T10:30:00.251Z",
  playerId: "1",
  hasController: true,
  controllerType: "ai",
  hasClient: true,
  isConnected: true,
  connectionState: "connected",
  socketConnected: true,
  socketId: "xyz789"
}
[OnlineAiSeatBridge] Submitting AI resolution: {
  timestamp: "2024-01-15T10:30:00.252Z",
  playerId: "1",
  attemptKey: "1:0:select_faction"
}
=== KIRO DEBUG: SUBMIT AI RESOLUTION START ===
[submitOnlineAiResolution] Submitting AI action: {
  timestamp: "2024-01-15T10:30:00.253Z",
  playerId: "1",
  actionId: "select_faction",
  attemptKey: "1:0:select_faction",
  batchId: "ai-1-1-0-select_faction",
  commandCount: 1,
  commandTypes: ["RESOLVE_INTERACTION"]
}
=== KIRO DEBUG: SUBMIT AI RESOLUTION CONFIRMED ===
[submitOnlineAiResolution] Action confirmed: {
  confirmTimestamp: "2024-01-15T10:30:00.350Z",
  playerId: "1",
  attemptKey: "1:0:select_faction",
  batchId: "ai-1-1-0-select_faction",
  hasAuthoritativeState: true,
  authoritativeStateType: "object"
}
```

### Bug 场景日志示例（sendBatch 回调未触发）

```
=== KIRO DEBUG: AI SEAT CLIENT MANAGEMENT ===
[OnlineAiSeatBridge] Managing AI seat clients: {
  timestamp: "2024-01-15T10:30:00.000Z",
  matchId: "abc123",
  nextClientKeys: ["1"],
  currentClientKeys: [],
  seatControllers: { "0": "human", "1": "ai" },
  hasSeatCredentials: { "0": true, "1": true }
}
[OnlineAiSeatBridge] Creating new AI seat client: {
  timestamp: "2024-01-15T10:30:00.001Z",
  playerId: "1",
  matchId: "abc123",
  server: "http://localhost:3001",
  hasCredential: true,
  credentialLength: 32
}
[OnlineAiSeatBridge] AI seat client connection changed: {
  timestamp: "2024-01-15T10:30:00.100Z",
  playerId: "1",
  matchId: "abc123",
  connectionState: "connected",
  isConnected: true,
  socketConnected: true
}
=== KIRO DEBUG: AI TURN EXECUTION TRIGGER ===
[OnlineAiSeatBridge] useEffect triggered: {
  timestamp: "2024-01-15T10:30:00.200Z",
  hasAiSeat: true,
  hasState: true,
  aiRetryVersion: 1,
  connectionVersion: 1,
  lastAiAttemptKey: null
}
[OnlineAiSeatBridge] runAiTurn started: { timestamp: "2024-01-15T10:30:00.201Z" }
[OnlineAiSeatBridge] Resolution found: {
  timestamp: "2024-01-15T10:30:00.250Z",
  playerId: "1",
  actionId: "select_faction",
  attemptKey: "1:0:select_faction",
  commandCount: 1,
  commandTypes: ["RESOLVE_INTERACTION"]
}
=== KIRO DEBUG: CLIENT STATUS CHECK ===
[OnlineAiSeatBridge] Checking client status: {
  timestamp: "2024-01-15T10:30:00.251Z",
  playerId: "1",
  hasController: true,
  controllerType: "ai",
  hasClient: true,
  isConnected: true,
  connectionState: "connected",
  socketConnected: true,
  socketId: "xyz789"
}
[OnlineAiSeatBridge] Submitting AI resolution: {
  timestamp: "2024-01-15T10:30:00.252Z",
  playerId: "1",
  attemptKey: "1:0:select_faction"
}
=== KIRO DEBUG: SUBMIT AI RESOLUTION START ===
[submitOnlineAiResolution] Submitting AI action: {
  timestamp: "2024-01-15T10:30:00.253Z",
  playerId: "1",
  actionId: "select_faction",
  attemptKey: "1:0:select_faction",
  batchId: "ai-1-1-0-select_faction",
  commandCount: 1,
  commandTypes: ["RESOLVE_INTERACTION"]
}
[submitOnlineAiResolution] Timeout - no callback received within 15000 ms {
  playerId: "1",
  attemptKey: "1:0:select_faction",
  batchId: "ai-1-1-0-select_faction"
}
[OnlineAiSeatBridge] Scheduling retry: {
  timestamp: "2024-01-15T10:30:15.253Z",
  playerId: "1"
}
=== KIRO DEBUG: AI TURN EXECUTION TRIGGER ===
[OnlineAiSeatBridge] useEffect triggered: {
  timestamp: "2024-01-15T10:30:15.254Z",
  hasAiSeat: true,
  hasState: true,
  aiRetryVersion: 2,
  connectionVersion: 1,
  lastAiAttemptKey: null
}
[OnlineAiSeatBridge] runAiTurn started: { timestamp: "2024-01-15T10:30:15.255Z" }
[OnlineAiSeatBridge] Resolution found: {
  timestamp: "2024-01-15T10:30:15.300Z",
  playerId: "1",
  actionId: "select_faction",
  attemptKey: "1:0:select_faction",
  commandCount: 1,
  commandTypes: ["RESOLVE_INTERACTION"]
}
[OnlineAiSeatBridge] Duplicate attempt key, skipping: {
  timestamp: "2024-01-15T10:30:15.301Z",
  attemptKey: "1:0:select_faction"
}
```

## 关键观察点

### 正常流程

1. AI seat client 成功创建并连接
2. `isConnected: true`, `connectionState: "connected"`, `socketConnected: true`
3. `sendBatch` 调用后，在合理时间内（< 15 秒）收到 `onConfirmed` 或 `onRejected` 回调
4. 游戏状态更新，回合数推进

### Bug 场景

1. AI seat client 报告 `isConnected: true`, `connectionState: "connected"`, `socketConnected: true`
2. `sendBatch` 调用后，15 秒内未收到任何回调
3. 超时机制触发，调用 `onRejected('timeout')`
4. 调度重试，但由于 `attemptKey` 相同，后续重试被跳过
5. 游戏状态未更新，回合数保持为 0

## 下一步

完成 sub-task 3.3 后，继续执行：
- Sub-task 3.4: 重新运行 Task 1 的 bug condition exploration test，验证修复后测试通过
- Sub-task 3.5: 重新运行 Task 2 的 preservation tests，验证无回归
