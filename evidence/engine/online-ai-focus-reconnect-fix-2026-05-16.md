# Online AI Focus Reconnect Fix - 2026-05-16

## Scope

- 在线对局中 AI seat 显示离线、页面失去焦点一段时间后返回时 AI 不继续行动。
- 房间销毁时客户端只收到断线、没有收到明确 `match_not_found` 终止信号的退出问题。

## Finding

- 在线 AI seat 由房主页面内的 `OnlineAiSeatBridge` 创建 `GameTransportClient` 连接 `/game` namespace 并提交 AI 命令。
- 既有恢复链路只在 `visibilitychange` / 原生壳可见性变化时触发 `onAppVisible`，如果浏览器窗口失焦但页面没有进入 `hidden`，回来时不会主动 `resync()` AI seat。
- `unloadMatch(..., { disconnectSockets: true })` 直接断开房间 socket，客户端可能只看到断线，而不是 `match_not_found`，因此缺房退出确认链路不一定触发。

## Fix

- `src/lib/mobile/appVisibility.ts`
  - `onAppVisible()` 继续保留可见性恢复语义。
  - 新增 `window.focus` 与 `window.online` 唤醒触发，且仅在组合活跃状态为 true 时回调。
  - 现有 `GameTransportProvider` 与 `OnlineAiSeatBridge` 无需改调用点即可在恢复焦点/网络恢复时执行 `resync()` 和 AI retry。

- `src/engine/transport/server.ts`
  - 活跃房间销毁并断开 socket 前，先向房间内连接发送 `error(matchID, 'match_not_found')`。
  - 让 `MatchRoom` 的 `onlineTransportError === 'match_not_found'` 链路能够清理本地房间态并回大厅。

## Verification

- `npm run test -- src/lib/mobile/__tests__/appVisibility.test.ts`
  - 3 passed。
- `npm run test -- src/engine/transport/__tests__/server.test.ts -t "销毁活跃房间时"`
  - 实际 npm 参数被脚本解析为整文件运行；`src/engine/transport/__tests__/server.test.ts` 106 passed。
- `npm run typecheck`
  - passed。

## Residual Risk

- 这次验证覆盖的是恢复触发和销毁通知的单元/传输层行为，没有跑真实浏览器 E2E 长时间挂起场景。
- 如果宿主系统彻底杀掉房主页面进程，前端无法在被杀期间继续驱动在线 AI；恢复后会按本次链路重新同步并尝试接续。
