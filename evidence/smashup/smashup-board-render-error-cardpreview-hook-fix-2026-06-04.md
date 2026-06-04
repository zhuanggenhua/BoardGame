# SmashUp board-render-error（CardPreview renderer hooks 混用）修复证据（2026-06-04）

## 范围

- 目标反馈簇：生产 `boardgame.feedbacks`
- 条件：`status in ['open', 'in_progress']`、`gameId='smashup'`、`source='board-render-error'`
- 本文只覆盖本轮定位到的 `CardPreview -> smashup-card-renderer` 渲染链导致的 React 渲染错误

## 生产真相

### 当前 open 聚合

2026-06-04 现场复核：

- `smashup / board-render-error`：`31` 条
- 最新样本时间：`2026-06-03T13:20:39.293Z`

### 代表样本

最新样本显示两类 React 压缩错误：

1. `Minified React error #300`
2. `Minified React error #310`

共同特征：

- `source = board.error_boundary`
- 调用栈都落在：
  - `CardPreview-BiAyhMuZ.js`
  - `game-8bUb5wdS.js`
  - `Board-q42imoaW.js`
- 栈中都能看到 `CardPreview` 与大杀四方板面链路，而不是网络、音频或服务端命令失败

## 根因

### 真实根因不是图片资源本身

本轮复核后，根因位于：

- `src/components/common/media/CardPreview.tsx`
- `src/games/smashup/ui/SmashUpCardRenderer.tsx`

旧实现中，`CardPreview` 的 renderer 分支是：

- 先从注册表拿到 `renderer`
- 再直接执行 `renderer({...})`

这会把 `SmashUpCardRenderer` 里的 Hooks：

- `useTranslation('game-smashup')`
- `useSmashUpOverlay()`
- 以及其后续 `useMemo/useEffect/useReducer`

直接混进 `CardPreview` 自己的渲染路径。

而 `CardPreview` 本身在 atlas / image / svg / renderer 几条分支下调用 Hook 的形状并不一致；当同一个 `CardPreview` 实例在不同 `previewRef.type` 间切换，或 renderer 分支在不同场景下被插入/移除时，就会触发 React 的 Hooks 顺序错误，进而被 `BoardErrorBoundary` 自动上报为 `board-render-error`。

## 代码修复

### 修复文件

- `src/components/common/media/CardPreview.tsx`

### 修复策略

把 renderer 分支从“普通函数调用”改成“真实 React 组件挂载”：

- 旧：`return renderer({...})`
- 新：`const Renderer = renderer; return <Renderer ... />`

这样 `SmashUpCardRenderer` 的 Hooks 会在它自己的组件边界内执行，不再污染 `CardPreview` 的 Hooks 顺序。

## 回归测试

### 1. CardPreview 直接回归

文件：

- `src/components/common/media/__tests__/CardPreview.i18n.test.tsx`

新增用例：

- `同一个 CardPreview 在 atlas 与使用 Hooks 的 renderer 之间切换时，不应触发 Hooks 顺序错误`

它直接锁住本次根因：

- 首先渲染 `atlas`
- 再切到一个内部含 `useState` 的 renderer
- 再切回 `atlas`
- 证明 `CardPreview` 不会再因为 renderer 组件使用 Hooks 而触发渲染失败

### 2. SmashUp UI 相邻链路回归

已复跑：

- `src/games/smashup/__tests__/ui-interaction-manual.test.ts`
- `src/games/smashup/__tests__/FactionSelection.variantLock.test.tsx`
- `src/games/smashup/__tests__/DeckDiscardZone.test.tsx`

目的：

- 验证大杀四方的 `smashup-card-renderer` 在提示层、派系选择、牌堆/弃牌区等主要消费链路没有被这次修复打坏

## 实测命令

```powershell
npx vitest run src/components/common/media/__tests__/CardPreview.i18n.test.tsx --configLoader native
```

结果：

- `16 passed`

```powershell
npx vitest run src/games/smashup/__tests__/ui-interaction-manual.test.ts src/games/smashup/__tests__/FactionSelection.variantLock.test.ts src/games/smashup/__tests__/DeckDiscardZone.test.ts --configLoader native
```

结果：

- `30 passed`

## 结论

当前本地 worktree 已覆盖这批 `smashup / board-render-error` 的直接源码根因：

- `CardPreview` 把带 Hooks 的 renderer 当普通函数执行，破坏 React Hooks 规则

本轮结论等级：

- **代表性玩法已验证**

注意：

- 线上这 `31` 条 open 仍然存在，不代表本地修复无效；还需要后续部署与回写，才能从生产反馈列表中真正消失。
- 这份 evidence 只覆盖 `board-render-error` 这一簇，不等于“大杀四方所有 open 反馈已收口”。
