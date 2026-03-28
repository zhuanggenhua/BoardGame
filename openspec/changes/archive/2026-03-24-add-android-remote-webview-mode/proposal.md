# Change: add-android-remote-webview-mode

## Why

当前 Android App 壳默认把 `dist/` 同步到 `android/app/src/main/assets/public/` 后再打包进 APK，这适合受商店审核约束的稳定发版，但不适合当前“不上架商店、主要靠手动分发 APK”的使用场景。

现状的主要问题是：只要前端页面有更新，就必须重新执行 `mobile:android:sync` 并重新分发 APK，导致 Android 端更新成本明显高于 Web 端。

项目已经明确 `App WebView` 只是 H5 的分发容器，而不是第二套前端运行时，因此需要在 Android 壳层新增“远程加载线上 H5”的正式模式，让 Android 端可以直接复用已部署的 Web 版本。

## What Changes

- 为 Android App 壳新增显式的双模式加载策略：
  - `embedded`：保持现状，继续加载 APK 内嵌的 `assets/public`
  - `remote`：通过 Capacitor `server.url` 直接加载线上 HTTPS H5 站点
- 明确 Android 壳的加载模式由单一配置源控制，而不是依赖手动改 `capacitor.config` 或临时跳过构建校验
- 调整 Android 构建链约束：
  - `embedded` 模式继续强制校验 `dist/android-build-meta.json` 与 `assets/public/android-build-meta.json` 一致
  - `remote` 模式不再要求本地 `dist -> assets/public` 同步才能发包
- 补充 Android 壳与部署文档，明确远程模式的网络、HTTPS、同域/CORS 和回滚边界

## Impact

- Affected specs:
  - `android-app-shell`（新 capability）
- Affected code:
  - `capacitor.config.json`
  - `scripts/mobile/android.mjs`
  - `android/app/build.gradle`
  - `docs/android-app-build.md`
  - `docs/deploy.md`

## Relationship To Existing Changes

- 本变更只解决 Android 壳“加载哪一份 H5”这一层，不修改 `mobileProfile`、`shellTargets`、`MobileBoardShell` 或任何游戏级移动适配能力。
- 本变更与 `add-pc-first-mobile-adaptation-framework` 兼容，但范围更小、实现可独立推进。
