# 再来一局按钮调试日志已添加

## 添加的调试日志

### 1. RematchActions.tsx - 按钮点击
```typescript
const handleVote = () => {
    console.log('[RematchActions] handleVote called', {
        onVote: !!onVote,
        isMultiplayer,
        playerID,
        myVote,
        ready,
        rematchState,
    });
    if (onVote) {
        console.log('[RematchActions] calling onVote');
        onVote();
    } else {
        console.error('[RematchActions] onVote is undefined!');
    }
};
```

### 2. RematchContext.tsx - Context 层
```typescript
const vote = useCallback(() => {
    console.log('[RematchContext] vote called', {
        isMultiplayer,
        matchId: matchInfoRef.current.matchId,
        playerId: matchInfoRef.current.playerId,
        isConnected: matchSocket.isSocketConnected(),
    });
    if (isMultiplayer) {
        console.log('[RematchContext] calling matchSocket.vote');
        matchSocket.vote();
    } else {
        console.warn('[RematchContext] not multiplayer, vote ignored');
    }
}, [isMultiplayer]);
```

### 3. matchSocket.ts - Socket 层（已有日志）
```typescript
vote(): void {
    if (!this.socket?.connected) {
        console.warn('[MatchSocket] 投票失败：未连接');
        return;
    }
    if (!this.currentMatchId || !this.currentPlayerId) {
        console.warn('[MatchSocket] 投票失败：未加入对局');
        return;
    }
    console.log('[MatchSocket] 发送投票', { matchId: this.currentMatchId, playerId: this.currentPlayerId });
    this.socket.emit(REMATCH_EVENTS.VOTE);
}
```

## 如何使用

1. **启动游戏**：
   ```bash
   npm run dev
   ```

2. **打开浏览器控制台**（F12）

3. **完成一局游戏**，等待游戏结束

4. **点击"再来一局"按钮**

5. **查看控制台输出**：
   - 如果看到 `[RematchActions] handleVote called` → 按钮点击事件正常
   - 如果看到 `[RematchActions] onVote is undefined!` → props 传递问题
   - 如果看到 `[RematchContext] vote called` → Context 层正常
   - 如果看到 `[RematchContext] not multiplayer, vote ignored` → 模式问题
   - 如果看到 `[MatchSocket] 发送投票` → Socket 发送正常
   - 如果看到 `[MatchSocket] 投票失败：未连接` → Socket 连接问题
   - 如果看到 `[MatchSocket] 投票失败：未加入对局` → matchId/playerId 问题

6. **查看服务端日志**：
   ```bash
   grep "RematchIO" logs/app-$(date +%Y-%m-%d).log
   ```
   - 应该看到 `[RematchIO] ${socket.id} 投票: ${playerId} -> ${voted}, ready=${ready}`

## 预期日志流程

### 正常流程
```
[RematchActions] handleVote called { onVote: true, isMultiplayer: true, playerID: '0', myVote: false, ready: false, rematchState: {...} }
[RematchActions] calling onVote
[RematchContext] vote called { isMultiplayer: true, matchId: 'xxx', playerId: '0', isConnected: true }
[RematchContext] calling matchSocket.vote
[MatchSocket] 发送投票 { matchId: 'xxx', playerId: '0' }
```

### 服务端日志（正常）
```
[RematchIO] socket-id 投票: 0 -> true, ready=false
[RematchIO] socket-id 投票: 1 -> true, ready=true
```

## 可能的问题场景

### 场景 1：onVote 为 undefined
```
[RematchActions] handleVote called { onVote: false, ... }
[RematchActions] onVote is undefined!
```
**原因**：旁观者模式或 props 传递链断裂

### 场景 2：Socket 未连接
```
[RematchActions] handleVote called { onVote: true, ... }
[RematchActions] calling onVote
[RematchContext] vote called { isMultiplayer: true, ... }
[RematchContext] calling matchSocket.vote
[MatchSocket] 投票失败：未连接
```
**原因**：Socket 连接断开或未建立

### 场景 3：未加入对局
```
[RematchActions] handleVote called { onVote: true, ... }
[RematchActions] calling onVote
[RematchContext] vote called { isMultiplayer: true, matchId: undefined, playerId: undefined, ... }
[RematchContext] calling matchSocket.vote
[MatchSocket] 投票失败：未加入对局
```
**原因**：matchId 或 playerId 未正确传递到 RematchContext

### 场景 4：服务端未收到
```
[RematchActions] handleVote called { onVote: true, ... }
[RematchActions] calling onVote
[RematchContext] vote called { isMultiplayer: true, ... }
[RematchContext] calling matchSocket.vote
[MatchSocket] 发送投票 { matchId: 'xxx', playerId: '0' }
```
但服务端日志中没有 `[RematchIO]` 记录
**原因**：Socket 事件未到达服务端（网络问题或服务端未监听）

## 下一步

1. 运行游戏并点击"再来一局"按钮
2. 将控制台输出和服务端日志发给我
3. 根据日志定位具体问题
4. 修复问题

## 修改的文件
- `src/components/game/framework/widgets/RematchActions.tsx`
- `src/contexts/RematchContext.tsx`
- `src/services/matchSocket.ts`（已有日志，未修改）
