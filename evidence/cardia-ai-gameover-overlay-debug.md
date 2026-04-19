# Cardia AI 游戏结束 Overlay 不显示问题调试

## 问题描述

用户反馈：和 AI 对战时，游戏结束后没有弹出游戏胜利或失败提示（`EndgameOverlay` 组件不显示）。

## 根因分析

### 服务端状态正确 ✅

从用户提供的状态 JSON 可以看到：
```json
{
  "sys": {
    "gameover": {"winner": "1"},
    "phase": "end"
  }
}
```

服务端状态正确：
- `sys.gameover` 已设置为 `{winner: "1"}`
- `phase` 停留在 `"end"`，没有继续推进到 `"play"`

这说明之前的修复（在 AI 恢复机制和 FlowHooks 中添加 `sys.gameover` 检查）已经生效。

### 客户端渲染链路分析

1. **Board 组件** (`src/games/cardia/Board.tsx`)
   - Line 66: `const isGameOver = G.sys.gameover;` - 获取游戏结束状态（这是一个对象，不是 boolean）
   - Line 405-410: 调用 `useEndgame` hook，传入 `result: isGameOver || undefined`
   - Line 1065: `{isGameOver && <EndgameOverlay {...endgameProps} />}` - 条件渲染（对象是 truthy，所以会渲染）

2. **useEndgame Hook** (`src/hooks/game/useEndgame.ts`)
   - 接收 `result: GameOverResult | undefined`
   - 计算 `isGameOver = !!result` (转换为 boolean)
   - 返回 `overlayProps` 包含 `isGameOver: boolean` 和 `result: GameOverResult`

3. **EndgameOverlay 组件** (`src/components/game/framework/widgets/EndgameOverlay.tsx`)
   - 接收 `isGameOver: boolean` 和 `result: GameOverResult`
   - 使用 `useEffect` 监听 `isGameOver` 变化
   - 当 `isGameOver` 从 false → true 时，设置 `shouldShow = true`
   - 使用 `AnimatePresence` 渲染遮罩

### 可能的问题点

1. **客户端状态未同步** ⚠️
   - 客户端可能没有收到服务端的最新状态
   - 需要检查 WebSocket 连接和状态同步
   - **这是最可能的原因**

2. **useEffect 依赖问题** ⚠️
   - 原代码依赖数组包含 `shouldShow` 和 `frozenResult`
   - 这可能导致不必要的重新执行或跳过执行
   - **已修复**：移除了这两个依赖

3. **React 渲染时机问题** ⚠️
   - `useEffect` 中使用 `queueMicrotask` 延迟设置状态
   - 可能在某些情况下导致状态更新丢失
   - 需要通过日志确认

## 修复方案

### 1. 添加调试日志 ✅

在关键位置添加 console.log：

**Board.tsx** (Line 66-73):
```typescript
console.log('[CardiaBoard] Render', {
    phase,
    isGameOver,
    isGameOverType: typeof isGameOver,
    isGameOverTruthy: !!isGameOver,
    playerID,
});
```

**Board.tsx** (Line 405-417):
```typescript
const { overlayProps: endgameProps } = useEndgame({
    result: isGameOver || undefined,
    playerID,
    matchData,
    reset,
    isMultiplayer,
});

console.log('[CardiaBoard] useEndgame result', {
    isGameOver,
    endgamePropsIsGameOver: endgameProps.isGameOver,
    endgamePropsResult: endgameProps.result,
    playerID,
});
```

**EndgameOverlay.tsx** (Line 119-135):
```typescript
useEffect(() => {
    console.log('[EndgameOverlay] useEffect triggered', {
        isGameOver,
        prevGameOver: prevGameOverRef.current,
        result,
        shouldShow,
    });
    
    if (isGameOver && !prevGameOverRef.current) {
        console.log('[EndgameOverlay] Game over detected, showing overlay');
        // ...
    }
    // ...
}, [isGameOver, result]);
```

**EndgameOverlay.tsx** (Line 165-171):
```typescript
console.log('[EndgameOverlay] Render', {
    shouldShow,
    frozenResult,
    showVictoryParticles,
    contentReady,
});
```

### 2. 修复 useEffect 依赖 ✅

移除 `shouldShow` 和 `frozenResult` 从依赖数组，避免循环依赖：

```typescript
useEffect(() => {
    // ...
}, [isGameOver, result]); // 只依赖输入 props
```

## 验证步骤

### 方式 1：真实游戏流程

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **创建 AI 对局**
   - 进入 Cardia 游戏
   - 选择 AI 对手
   - 开始游戏

3. **触发游戏结束**
   - 正常游戏直到一方获胜

4. **检查浏览器控制台**
   - 查看 `[CardiaBoard]` 日志，确认 `isGameOver` 值
   - 查看 `[EndgameOverlay]` 日志，确认 `useEffect` 是否触发
   - 查看 `shouldShow` 是否变为 `true`

5. **检查 DOM**
   - 使用开发者工具查找 `[data-testid="endgame-overlay"]`
   - 检查元素是否存在但不可见（CSS 问题）
   - 或元素根本没有渲染（逻辑问题）

### 方式 2：使用调试面板注入状态

1. **启动游戏并打开调试面板**
   - 进入 Cardia 游戏
   - 打开浏览器开发者工具
   - 在控制台执行：
   ```javascript
   const harness = window.__BG_TEST_HARNESS__;
   const currentState = harness.readCoreState();
   const newState = {
       ...currentState,
       sys: {
           ...currentState.sys,
           gameover: { winner: '0' },
           phase: 'end',
       },
   };
   harness.applyCoreStateDirect(newState);
   ```

2. **观察结果**
   - 检查控制台日志
   - 检查 `EndgameOverlay` 是否显示

## 预期结果

- 游戏结束后，`EndgameOverlay` 应该显示
- 显示正确的胜利/失败文案
- 提供"再来一局"和"返回大厅"按钮

## 调试日志分析指南

### 场景 1：客户端状态未同步

**日志特征**：
```
[CardiaBoard] Render { isGameOver: null, ... }
```

**原因**：客户端没有收到服务端的 `sys.gameover` 更新

**解决方案**：
- 检查 WebSocket 连接状态
- 检查服务端是否正确广播状态更新
- 检查客户端状态同步逻辑

### 场景 2：useEffect 未触发

**日志特征**：
```
[CardiaBoard] Render { isGameOver: {winner: "1"}, ... }
[CardiaBoard] useEndgame result { endgamePropsIsGameOver: true, ... }
// 但没有 [EndgameOverlay] useEffect triggered 日志
```

**原因**：`EndgameOverlay` 组件未挂载或 `useEffect` 未执行

**解决方案**：
- 检查 `{isGameOver && <EndgameOverlay .../>}` 条件是否满足
- 检查 React 渲染是否正常

### 场景 3：shouldShow 未设置

**日志特征**：
```
[EndgameOverlay] useEffect triggered { isGameOver: true, prevGameOver: false, ... }
[EndgameOverlay] Game over detected, showing overlay
[EndgameOverlay] Render { shouldShow: false, ... }
```

**原因**：`queueMicrotask` 中的状态更新未生效

**解决方案**：
- 检查是否有其他代码干扰状态更新
- 考虑移除 `queueMicrotask`，直接设置状态

### 场景 4：DOM 存在但不可见

**日志特征**：
```
[EndgameOverlay] Render { shouldShow: true, frozenResult: {winner: "1"}, ... }
```
但页面上看不到 overlay

**原因**：CSS 或 Portal 问题

**解决方案**：
- 检查 `z-index` 是否被其他元素覆盖
- 检查 Portal 是否正确挂载到 `document.body`
- 检查 `AnimatePresence` 动画是否正常

## 后续工作

1. **用户验证**
   - 请用户在浏览器中打开游戏
   - 触发游戏结束
   - 查看控制台日志并截图
   - 反馈日志内容

2. **根据日志结果进一步修复**
   - 如果是状态同步问题 → 修复 WebSocket 或状态管理
   - 如果是 useEffect 问题 → 调整 React 生命周期
   - 如果是 CSS 问题 → 调整样式或层级

## 文件修改清单

- ✅ `src/games/cardia/Board.tsx` - 添加调试日志
- ✅ `src/components/game/framework/widgets/EndgameOverlay.tsx` - 添加调试日志，修复 useEffect 依赖
- ✅ `e2e/cardia-ai-gameover-overlay.e2e.ts` - 创建 E2E 测试（待运行）
- ✅ `evidence/cardia-ai-gameover-overlay-debug.md` - 本文档
