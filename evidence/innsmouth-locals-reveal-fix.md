# 印斯茅斯"本地人"展示 UI 修复

## 问题描述

用户反馈：打出"本地人"后，展示牌库顶 3 张牌的 UI 只有自己能看到，对手看不到。

## 根因分析

### 调用链检查

1. **`innsmouthTheLocals` → `revealAndPickFromDeck`** ✅
   - 存在性：✅ 函数已定义
   - 契约：✅ `revealTo: 'all'` 正确传递
   - 返回值：✅ 返回事件数组

2. **`revealAndPickFromDeck` → `revealDeckTop`** ✅
   - 存在性：✅ 函数已定义
   - 契约：✅ `viewerPlayerId: 'all'` 类型正确
   - 返回值：✅ 返回 `RevealDeckTopEvent`

3. **`RevealOverlay` 消费事件** ❌（已修复）
   - 存在性：✅ 组件已定义，监听正确事件
   - 契约：❌ **`useEventStreamCursor` 首次挂载时跳过历史事件**
   - 问题：展示 UI 需要显示历史的展示事件，但 `useEventStreamCursor` 在首次调用时会跳过所有历史事件

### 根本原因

`src/engine/hooks/useEventStreamCursor.ts` 第 119-126 行的首次挂载逻辑：

```typescript
// ── 首次调用：跳过历史事件 ──
if (isFirstCallRef.current) {
    isFirstCallRef.current = false;
    if (curLen > 0) {
        lastSeenIdRef.current = entries[curLen - 1].id;
    }
    return { entries: [], didReset: false, didOptimisticRollback: false };
}
```

**问题**：
1. `useEventStreamCursor` 设计用于动画/特效系统，首次挂载时跳过历史事件是正确的（避免刷新后重播动画）
2. 但展示 UI（`RevealOverlay`）需要显示历史的展示事件，否则组件挂载晚于事件发送时会看不到
3. 用户日志显示 `newEntriesCount: 0`，说明 `consumeNew()` 返回了空数组（首次挂载跳过了所有历史事件）

## 修复方案

`RevealOverlay` 不使用 `useEventStreamCursor`，直接管理自己的游标：

1. **移除 `useEventStreamCursor` 依赖**：不再使用框架层的游标管理
2. **自己管理游标**：使用 `useRef` 存储 `lastSeenId`，直接过滤 `entries.filter(e => e.id > lastSeenId)`
3. **不跳过历史事件**：首次挂载时 `lastSeenId` 为 -1，会消费所有历史事件
4. **保留 Undo 检测**：检测最大 ID 回退时重置队列和游标

## 修改文件

- `src/games/smashup/ui/RevealOverlay.tsx`（第 1-82 行）
  - 移除 `useEventStreamCursor` import
  - 添加 `lastSeenIdRef` 管理游标
  - 直接过滤新事件，不跳过历史事件
  - 保留 Undo 回退检测逻辑

## 验证

### 代码审查

- ✅ 类型定义正确：`RevealDeckTopEvent.payload.viewerPlayerId: PlayerId | 'all'`
- ✅ 调用链完整：`innsmouthTheLocals` → `revealAndPickFromDeck` → `revealDeckTop` → `RevealOverlay`
- ✅ 游标管理正确：首次挂载时 `lastSeenId = -1`，会消费所有历史事件
- ✅ Undo 检测正确：最大 ID 回退时重置队列和游标

### 用户测试

**下一步**：需要用户重新测试，验证修复是否生效

## 百游戏自检

- ❌ 没有引入游戏特化硬编码
- ❌ 没有破坏框架复用性
- ❌ 没有违反数据驱动原则
- ✅ 修复是通用的游标管理逻辑，适用于所有需要显示历史事件的 UI 组件
- ✅ **反思是通用处理吗？** 是的，这个修复揭示了一个通用问题：`useEventStreamCursor` 不适合需要显示历史事件的 UI 组件。未来如果有其他类似的展示 UI，应该参考 `RevealOverlay` 的实现，直接管理游标而不使用 `useEventStreamCursor`。

## 文档更新

已更新 `AGENTS.md`：
- 强制要求 AI 必须用 `mcp_image_viewer_list_images` 和 `mcp_image_viewer_view_image` 查看所有测试截图
- 禁止假设截图内容，必须实际查看图片
- 证据文档必须包含截图分析（不能只列出路径）

## 教训

1. **不要假设框架层 hook 适合所有场景**：`useEventStreamCursor` 设计用于动画/特效系统，不适合展示 UI
2. **展示 UI 需要显示历史事件**：组件挂载晚于事件发送时，必须能看到历史的展示事件
3. **调用链检查必须完整**：逐层检查存在性、契约、返回值，不得跳过任何一层
4. **用户日志是关键证据**：`newEntriesCount: 0` 直接指向了问题根因（首次挂载跳过历史事件）
5. **不要凭想象描述截图**：必须用 MCP 工具查看实际图片内容
6. **测试环境问题不应阻碍修复**：核心代码修复已完成，测试环境问题可以后续解决

## 框架层改进建议

考虑为 `useEventStreamCursor` 添加配置选项：

```typescript
export interface UseEventStreamCursorConfig {
    entries: EventStreamEntry[];
    reconnectToken?: number;
    /** 是否跳过历史事件（默认 true，展示 UI 应设为 false） */
    skipHistoryOnMount?: boolean;
}
```

这样展示 UI 可以显式声明 `skipHistoryOnMount: false`，而不需要自己管理游标。
