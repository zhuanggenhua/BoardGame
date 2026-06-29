# 七大恨 `React 520` 自动反馈收口证据（2026-06-18）

## 反馈对象

- 反馈 ID：
  - `6a316771e7db65695ded81c4`
  - `6a32e44dfc7801341e0cc690`
- 来源：前端自动报错 `client-window-error`
- 线上文案：
  - `[auto][window.error] Minified React error #520; visit https://react.dev/errors/520 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`

## 真实现场

两条生产记录的共同点：

- 路由都已经切到：`/?game=qidahen`
- 上一跳都来自七大恨局内页：
  - `/play/qidahen/match/...`
- 路由变更方式都是：`replaceState`
- 页面标记都显示：`hasModalOpen=true`
- 报错都来自同一版 React vendor：
  - `https://easyboardgame.top/assets/vendor-react-Cjiho1Wd.js`

现实含义是：

- 报错不在七大恨棋盘主渲染时发生
- 而是在“从局内返回带 `?game=qidahen` 的主页”这一跳发生
- 同一时刻页面上还残留着 modal

## React 错误码口径

根据 React 官方错误页，生产包里的 `#520` 只说明“这里发生了 React 运行时渲染/更新异常”，不会直接给出完整调试语义，因此必须回到真实 route、真实 stack 和当前页面状态定位，而不能只看错误码本身下结论。

## 根因判断

主页 [src/pages/Home.tsx](/abs/path/D:/gongzuo/webgame/BoardGame/src/pages/Home.tsx:358) 会在 `/?game=qidahen` 到达后，立刻根据 URL 打开七大恨详情弹窗。

而游戏页返回大厅的多条入口此前只是直接 `navigate(..., { replace: true })`，没有在跳转前先清掉全局 modal 栈。这样会留下一个风险窗口：

- 旧局内 modal 还在全局栈里
- 新主页又按 `?game=qidahen` 立即挂起详情 modal
- 两套 modal 树在同一跳里重挂，命中 React 生产渲染异常

## 本轮代码修复

新增共享导航 helper：

- [src/lib/navigation/navigateBackToLobbyWithModalCleanup.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/lib/navigation/navigateBackToLobbyWithModalCleanup.ts:1)

行为：

- 所有“游戏页返回大厅”入口，先执行 `closeAll({ skipOnClose: true })`
- 再 `replace` 到 `/?game=<gameId>` 或 `/`

已接入入口：

- [src/pages/useMatchRoomExitFlow.tsx](/abs/path/D:/gongzuo/webgame/BoardGame/src/pages/useMatchRoomExitFlow.tsx:58)
- [src/components/system/ConnectionLoadingScreen.tsx](/abs/path/D:/gongzuo/webgame/BoardGame/src/components/system/ConnectionLoadingScreen.tsx:43)
- [src/components/system/GameNamespaceLoadError.tsx](/abs/path/D:/gongzuo/webgame/BoardGame/src/components/system/GameNamespaceLoadError.tsx:21)
- [src/components/system/GamePageRescueGate.tsx](/abs/path/D:/gongzuo/webgame/BoardGame/src/components/system/GamePageRescueGate.tsx:176)
- [src/pages/matchRoomOnlineStageRuntime.tsx](/abs/path/D:/gongzuo/webgame/BoardGame/src/pages/matchRoomOnlineStageRuntime.tsx:131)

为什么要 `skipOnClose: true`：

- 这一步的目标只是静默移除旧页面遗留 modal
- 不应再触发旧页面 modal 的 `onClose` 回调，避免在离场过程中再追加状态更新

## 验证

```bash
pnpm vitest run src/lib/navigation/__tests__/navigateBackToLobbyWithModalCleanup.test.ts --configLoader native
pnpm vitest run src/pages/__tests__/matchMissingConfirmation.test.tsx --configLoader native
```

结果：

- 新导航 helper：`2 passed`
- 缺房确认链：`3 passed`

关键断言：

- 返回大厅前，确实先静默清空 modal 栈
- 仍然保留原有 `/?game=<gameId>` 返回行为

## 生产侧现状判断

以当前线上镜像创建时间 `2026-06-17T17:47:35.734Z` 为分界，继续统计同文案：

- `client-window-error / Minified React error #520`
- 部署后新增条数：`1`

这说明：

- 这两条并不都是“更旧部署里的历史残留”
- 至少其中一条发生在当前线上镜像之后
- 不能按“当前生产已自然恢复”直接 `closed`

## 结论

- 这是一个真实前端 bug，问题点在“游戏页回大厅时残留 modal 与首页 `?game=` 详情 modal 同跳重挂”。
- 本轮已经补上统一的 modal 清理导航收口。
- 现阶段应按 **已修复待回写** 处理，而不是继续留在 `open`。

## 收口口径

- 建议状态：`resolved`
- 建议说明：`七大恨从局内 replaceState 回带 ?game 的主页时，旧局内 modal 未先清理，和主页详情 modal 同跳重挂触发 React 520；当前树已统一改为先静默清空 modal 栈再返回大厅，并已通过定向回归。`
