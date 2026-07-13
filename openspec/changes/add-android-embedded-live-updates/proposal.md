# Change: Android embedded OTA / Live Update 主线

## Why

当前 Android 主线已经切到 `embedded`，但 H5 本体仍然只能随 APK/AAB 发版更新。`remote WebView` 虽然能实现“整站随线上热更”，但不适合作为长期产品主线。

用户目标是把 Android 的长期更新方案统一到主流路径：继续使用 `embedded` 作为默认发布形态，同时接入 OTA / Live Update，让主页、大厅、房间、游戏 UI 等 H5 本体在绝大多数场景下不再依赖重新发包。

## What Changes

- 新增 Android `embedded` 模式下的 OTA / Live Update 能力
- 定义 OTA bundle 的版本、渠道、兼容性、完整性校验和激活/回滚机制
- 所有 Android OTA channel 固定强制更新，禁止生成或发布非强制 OTA manifest
- OTA bundle 只携带 Web 本体与资源清单，嵌套游戏资源继续走服务器资源主源或移动游戏包
- 为 Android App 增加启动时检查更新、后台下载、下次启动生效或安全切换的统一流程
- 增加服务端/静态清单侧的 bundle 发布元数据约定
- 增加 GitHub Actions Android 自动发布链路：`push main` 直接发布 stable 正式版本，并在成功后自动回写下一 patch 版本
- 明确 `embedded + OTA` 为 Android 主线；`remote WebView` 仅保留为兼容/调试路径
- 明确“哪些改动可以 OTA，哪些改动仍必须重新发包”

## Impact

- Affected specs:
  - `android-app-shell`
  - `android-live-updates`（new）
- Affected code:
  - `.github/workflows/android-ota-publish.yml`
  - `scripts/mobile/ota-publish-config.mjs`
  - `scripts/mobile/ota-bundle-files.mjs`
  - `scripts/mobile/android.mjs`
  - `capacitor.config.ts`
  - `android/` 原生壳启动与本地 bundle 激活逻辑
  - Android OTA manifest / bundle 下载与存储模块
  - 发布文档与运维流程文档

## Non-Goal Clarification

- 本 change 的目标是让 **H5 本体** 不再常规依赖重新发包。
- 本 change **不承诺** 永远不再重新发包；涉及原生插件、权限、Manifest、图标、启动图、原生代码、Capacitor/runtime 版本升级等变更时，仍然需要重新发包。
