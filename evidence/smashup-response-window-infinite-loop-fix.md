# 大杀四方 - ResponseWindowSystem 无限循环 Bug 修复

## 问题描述

**日期**: 2026-03-09  
**测试**: `e2e/smashup-complex-multi-base-scoring.e2e.ts`  
**症状**: afterScoring 响应窗口陷入无限循环，RESPONSE_PASS 命令无法推进响应者

## 根本原因

经过详细分析代码和测试日志，发现问题在于 **`skipToNextRespondableResponder` 函数的逻辑错误**：

### 问题代码位置

`src/engine/systems/ResponseWindowSystem.ts` 的 `skipToNextRespondableResponder` 函数中：

```typescript
const findNextRespondable = (
    scanWindow: CurrentWindow
): ResponseWindowState['current'] | undefined => {
    const originalIndex = scanWindow.currentResponderIndex;
    let index = originalIndex;
    let passedPlayers = scanWindow.passedPlayers;  // ❌ 问题：使用局部变量

    while (index < scanWindow.responderQueue.length) {
        const playerId = scanWindow.responderQueue[index];
        const hasContent = hasRespondableContent(state.core as unknown, playerId, scanWindow.windowType, scanWindow.sourceId);
        
        if (hasContent) {
            if (index === originalIndex && passedPlayers === scanWindow.passedPlayers) {
                return scanWindow;  // ❌ 返回原始窗口，丢失了 advanceToNextResponder 的更新
            }
            return {
                ...scanWindow,
                currentResponderIndex: index,
                passedPlayers,  // ❌ 使用局部变量，而不是从 advanceToNextResponder 传入的值
            };
        }
        passedPlayers = [...passedPlayers, playerId];
        index += 1;
    }

    return undefined;
};
```

### 问题分析

1. **`advanceToNextResponder` 正确更新了窗口状态**：
   - `currentResponderIndex` 从 0 变成 1
   - `passedPlayers` 包含 '0'

2. **`skipToNextRespondableResponder` 覆盖了更新**：
   - 函数内部使用局部变量 `passedPlayers = scanWindow.passedPlayers`
   - 当找到可响应玩家时，如果 `index === originalIndex`（即当前玩家有可响应内容），直接返回 `scanWindow`
   - 这会丢失 `advanceToNextResponder` 对 `passedPlayers` 的更新

3. **结果**：
   - 响应窗口状态永远不变
   - `currentResponderIndex` 始终为 0
   - `passedPlayers` 始终为空
   - 无限循环

## 修复方案

### 方案 1：保留 `advanceToNextResponder` 的更新（推荐）

修改 `skipToNextRespondableResponder` 函数，当找到可响应玩家时，保留传入窗口的 `passedPlayers` 更新：

```typescript
const findNextRespondable = (
    scanWindow: CurrentWindow
): ResponseWindowState['current'] | undefined => {
    const originalIndex = scanWindow.currentResponderIndex;
    let index = originalIndex;
    // ✅ 保留传入窗口的 passedPlayers（包含 advanceToNextResponder 的更新）
    let passedPlayers = scanWindow.passedPlayers;

    while (index < scanWindow.responderQueue.length) {
        const playerId = scanWindow.responderQueue[index];
        const hasContent = hasRespondableContent(state.core as unknown, playerId, scanWindow.windowType, scanWindow.sourceId);
        
        if (hasContent) {
            // ✅ 即使 index === originalIndex，也要返回更新后的窗口（保留 passedPlayers 更新）
            return {
                ...scanWindow,
                currentResponderIndex: index,
                passedPlayers,  // ✅ 保留 advanceToNextResponder 的更新
            };
        }
        // 只有在跳过玩家时才追加到 passedPlayers
        passedPlayers = [...passedPlayers, playerId];
        index += 1;
    }

    return undefined;
};
```

### 方案 2：简化逻辑（备选）

将 `advanceToNextResponder` 和 `skipToNextRespondableResponder` 合并为一个函数，避免状态传递问题。

## 测试验证

修复后，重新运行测试：

```bash
npm run test:e2e:ci -- smashup-complex-multi-base-scoring.e2e.ts
```

预期结果：
- 响应窗口正确推进（currentResponderIndex 从 0 → 1）
- passedPlayers 正确记录已 pass 的玩家
- 所有玩家 pass 后响应窗口关闭
- 计分流程继续

## 相关文档

- `evidence/smashup-complex-multi-base-scoring-framework-migration.md` - 测试框架迁移文档
- `evidence/response-window-interaction-failure-fix.md` - 之前修复的类似问题
- `src/engine/systems/ResponseWindowSystem.ts` - 响应窗口系统源码

## 下一步

1. 实施修复方案 1
2. 运行测试验证
3. 如果测试通过，创建新的证据文档记录修复结果
