# 再来一局按钮无效问题排查

## 问题描述
- 用户反馈：两边都按了"再来一局"按钮，没有触发效果
- 时间：POD commit 审计修复后

## 代码审查结果

### ✅ 组件层级正常
1. **RematchActions.tsx** - 按钮组件
   - ✅ `renderButton` prop 已恢复（POD 审计时修复）
   - ✅ `handleVote` 函数正确调用 `onVote()`
   - ✅ 多人模式逻辑正常

2. **EndgameOverlay.tsx** - 遮罩组件
   - ✅ `actionsProps` 正确传递 `onVote`
   - ✅ props 展开正常

3. **BoardOverlays.tsx** (DiceThrone) - 游戏特化层
   - ✅ `onVote={props.onRematchVote}` 正确传递

4. **Board.tsx** (DiceThrone) - 游戏主组件
   - ✅ `handleRematchVote` 来自 `useEndgame` hook 的 `vote` 方法

5. **useEndgame.ts** - 统一结束页面 hook
   - ✅ `vote` 函数来自 `useRematch()` hook
   - ✅ 旁观者模式下 `onVote` 为 `undefined`（正确）

6. **RematchContext.tsx** - 重赛状态管理
   - ✅ `vote` 函数调用 `matchSocket.vote()`
   - ✅ socket 连接逻辑正常
   - ✅ 订阅逻辑正常

7. **matchSocket.ts** - Socket 客户端
   - ✅ `vote()` 方法发送 `REMATCH_EVENTS.VOTE` 事件

8. **server.ts** - Socket 服务端
   - ✅ `REMATCH_EVENTS.VOTE` 处理器存在
   - ✅ 投票逻辑正常（切换投票状态，检查是否 ready）
   - ✅ ready 后发送 `TRIGGER_RESET` 事件

### 🔍 可能的问题点

#### 1. Socket 连接问题
- **症状**：按钮点击后没反应
- **可能原因**：
  - Socket 未连接
  - matchId 或 playerId 未正确传递
  - 未加入 rematch room

#### 2. 旁观者模式
- **症状**：按钮点击后没反应
- **可能原因**：
  - 用户以旁观者身份进入房间
  - `isSpectator=true` 导致 `onVote=undefined`

#### 3. 凭据问题
- **症状**：投票成功但无法创建新房间
- **可能原因**：
  - `readStoredMatchCredentials` 返回 null
  - credentials 过期或无效

## 排查步骤

### 步骤 1：检查 Socket 连接状态
在浏览器控制台运行：
```javascript
// 检查 socket 是否连接
window.__DEBUG_SOCKET__ = true;

// 检查 rematch 状态
console.log('RematchContext state:', window.__REMATCH_STATE__);
```

### 步骤 2：检查是否为旁观者
在浏览器控制台运行：
```javascript
// 检查 playerID
console.log('PlayerID:', window.__PLAYER_ID__);

// 检查 gameMode
console.log('GameMode:', window.__GAME_MODE__);
```

### 步骤 3：检查按钮点击事件
在 `RematchActions.tsx` 的 `handleVote` 函数中添加日志：
```typescript
const handleVote = () => {
    console.log('[RematchActions] handleVote called', { onVote: !!onVote });
    if (onVote) {
        console.log('[RematchActions] calling onVote');
        onVote();
    } else {
        console.error('[RematchActions] onVote is undefined!');
    }
};
```

### 步骤 4：检查 matchSocket.vote() 调用
在 `RematchContext.tsx` 的 `vote` 函数中添加日志：
```typescript
const vote = useCallback(() => {
    console.log('[RematchContext] vote called', { isMultiplayer, matchId, playerId });
    if (isMultiplayer) {
        console.log('[RematchContext] calling matchSocket.vote');
        matchSocket.vote();
    }
}, [isMultiplayer]);
```

### 步骤 5：检查服务端日志
查看 `logs/app-*.log` 中的 `[RematchIO]` 日志：
```bash
grep "RematchIO" logs/app-$(date +%Y-%m-%d).log
```

## 下一步行动

1. **添加调试日志**：在关键路径添加 console.log
2. **运行测试**：启动游戏，点击"再来一局"按钮
3. **查看控制台**：检查是否有错误或警告
4. **查看服务端日志**：确认服务端是否收到投票请求
5. **根据日志定位问题**：
   - 如果控制台没有日志 → 按钮点击事件未触发
   - 如果有日志但 onVote 为 undefined → 旁观者模式或 props 传递问题
   - 如果服务端没有收到请求 → Socket 连接问题
   - 如果服务端收到请求但没有响应 → 服务端逻辑问题

## 临时解决方案

如果问题紧急，可以临时使用本地重置：
```typescript
// 在 Board.tsx 中
const handleRematchVote = () => {
    console.warn('[临时方案] 使用本地重置');
    reset?.();
};
```

## 参考文档
- `src/components/game/framework/widgets/RematchActions.tsx` - 按钮组件
- `src/contexts/RematchContext.tsx` - 重赛状态管理
- `src/services/matchSocket.ts` - Socket 客户端
- `server.ts` - Socket 服务端
- `evidence/POD-AUDIT-COMPLETE.md` - POD 审计报告
