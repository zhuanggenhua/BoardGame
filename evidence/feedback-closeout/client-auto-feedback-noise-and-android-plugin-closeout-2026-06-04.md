# 客户端自动反馈噪音与 Android 缺插件收口（2026-06-04）

## 范围

- 动态导入 / stale chunk 类客户端自动反馈
  - `6a1ffdfa78c1ecf399a6759a`
  - `6a1f78cb952559643efd3d09`
  - `6a1fb15778c1ecf399a67335`
- Android 旧壳缺少原生插件导致的客户端未处理拒绝
  - `6a1fbf3178c1ecf399a6736f`
  - `6a1fbf3178c1ecf399a67368`

## 结论

- `error loading dynamically imported module`
  - 属于 stale chunk / 旧资源缓存窗口，不是当前业务逻辑活 bug。
  - 本轮已扩展 `isStaleChunkError(...)` 识别，历史反馈按 `closed` 收口。
- `'text/html' is not a valid JavaScript MIME type.`
  - 与动态导入资源落到 HTML fallback 同类，属于 stale chunk / 资源失配噪音。
  - 本轮已纳入 stale chunk 过滤，历史反馈按 `closed` 收口。
- `AbortError: The operation was aborted.`
  - 缺少可归因到业务链的稳定上下文，属于浏览器级通用取消噪音。
  - 本轮已在自动反馈入口过滤，历史反馈按 `closed` 收口。
- `"App" plugin is not implemented on android`
  - 不是业务规则错误，而是旧 Android 壳缺少 `@capacitor/app` 原生实现时，桥接组件没有静默降级，导致未处理拒绝继续上报。
  - 本轮已在 `AndroidBackNavigationBridge` 做插件不可用降级，历史反馈按 `resolved` 收口。
- `"CapacitorUpdater" plugin is not implemented on android`
  - 不是 OTA 业务本体错误，而是旧 Android 壳缺少 `@capgo/capacitor-updater` 原生实现时，OTA 快照/监听链没有静默降级，导致未处理拒绝继续上报。
  - 本轮已在 `androidLiveUpdates.ts` 做插件不可用降级，历史反馈按 `resolved` 收口。

## 代码落点

- `src/lib/staleChunkReloadGuard.ts`
  - 扩展 stale chunk 指纹：
    - `error loading dynamically imported module`
    - `is not a valid JavaScript MIME type`
- `src/lib/feedback/clientAutoReport.ts`
  - 新增过滤：
    - stale chunk / MIME type 噪音
    - `AbortError: The operation was aborted.`
    - `"App" plugin is not implemented on android`
    - `"CapacitorUpdater" plugin is not implemented on android`
- `src/components/system/AndroidBackNavigationBridge.tsx`
  - `App.getState/getLaunchUrl/addListener/exitApp` 链路遇到旧壳缺插件时静默降级，不再制造未处理拒绝。
- `src/lib/mobile/androidLiveUpdates.ts`
  - `readAndroidLiveUpdateSnapshot/registerAndroidLiveUpdateListeners/notifyAndroidBundleReady` 遇到旧壳缺 `CapacitorUpdater` 时静默降级并回退为 `updaterLoaded=false`。

## 回归测试

- `node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/staleChunkReloadGuard.test.ts src/lib/__tests__/clientAutoReport.test.ts src/lib/__tests__/errorContext.autoReport.test.ts src/lib/__tests__/androidLiveUpdates.test.ts src/components/system/__tests__/AndroidBackNavigationBridge.test.tsx --configLoader native`
- 结果：
  - `5 passed`
  - `71 passed`

## 状态口径

- `closed`
  - `6a1ffdfa78c1ecf399a6759a`
  - `6a1f78cb952559643efd3d09`
  - `6a1fb15778c1ecf399a67335`
- `resolved`
  - `6a1fbf3178c1ecf399a6736f`
  - `6a1fbf3178c1ecf399a67368`

## 备注

- 这批反馈都来自 2026-06-03 旧前端 / 旧 Android 壳运行窗口。
- 本轮证据证明当前 worktree 已覆盖对应噪音过滤与缺插件降级；后续应直接走状态回写，不需要继续等待生产部署后“观察是否还报”。
