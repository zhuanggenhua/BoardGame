# iOS TestFlight 构建速查

## 目标口径

- iOS 原生壳通过 TestFlight 分发，不走公开 App Store 上架。
- H5 本体继续走 `embedded + OTA / Live Update`，channel 语义与 Android 一致。
- iOS 原生二进制更新只能重新上传 TestFlight build；不要做 IPA 内下载/安装。
- Android 现有 APK、OTA、native update、game package 路径不因 iOS 变更而改变。

## 本地准备

Windows 可以维护仓库和执行 Web 构建；最终 Archive、签名和上传必须在 macOS + Xcode 上完成。

首次或依赖变化后：

```bash
npm install
npm run mobile:ios:sync
```

打开 Xcode：

```bash
npm run mobile:ios:open
```

## iOS 环境变量

本地默认入口为 `.env.ios.local`：

```env
VITE_BACKEND_URL=https://api.easyboardgame.top
VITE_AUDIO_ASSETS_BASE_URL=https://assets.easyboardgame.top/official
CAPACITOR_APP_ID=top.easyboardgame.app
CAPACITOR_APP_NAME=易桌游
VITE_IOS_OTA_ENABLED=true
VITE_IOS_OTA_MANIFEST_URL=https://assets.easyboardgame.top/official/app-updates/ios/stable/latest.json
VITE_IOS_OTA_CHANNEL=stable
VITE_IOS_OTA_APP_READY_TIMEOUT_MS=15000
VITE_MOBILE_PACKAGE_MANIFEST_URL=https://assets.easyboardgame.top/official/mobile-packages/ios
```

## TestFlight 发布步骤

1. 在 Apple Developer / App Store Connect 创建 App ID 与 App 记录。
2. 在 Xcode 中设置 Team、Bundle Identifier、Signing。
3. 选择真实设备或 `Any iOS Device` 作为归档目标。
4. 执行 `Product > Archive`。
5. 在 Organizer 中 `Distribute App`，上传到 App Store Connect。
6. 在 TestFlight 中添加内部或外部测试人员。

## iOS OTA 发布

先构建 iOS Web 产物：

```bash
npm run build:ios:web
```

预演发布：

```bash
npm run mobile:ios:ota:publish -- --channel stable --expected-base-version 0.5.8 --dry-run
```

正式发布：

```bash
npm run mobile:ios:ota:publish -- --channel stable --expected-base-version 0.5.8
```

发布脚本会读取 `dist/ios-build-meta.json`，只接受 `mode=ios` 且 `appId=top.easyboardgame.app` 的产物。R2 路径为 `official/app-updates/ios/<channel>/...`，不会覆盖 Android 的 `official/app-updates/android/<channel>/...`。

## 热更边界

可以走 iOS OTA：

- 主页、大厅、房间、游戏 UI 等 H5 本体修复。
- 不涉及原生能力变化的 Web 逻辑、样式、文案、轻量资源引用。

必须发新 TestFlight build：

- Capacitor 插件新增/升级。
- iOS 权限、Info.plist、原生代码、图标、启动图、签名、Bundle ID 变化。
- 会改变 App 主要目的或需要重新审核的能力变化。

## Artifact 路径

- iOS H5 OTA：`official/app-updates/ios/<channel>/latest.json`
- iOS H5 OTA bundle：`official/app-updates/ios/<channel>/bundles/<bundleVersion>.zip`
- iOS 游戏包：`official/mobile-packages/ios/<channel>/games/<gameId>.json`
- Android 继续使用现有 `android` 路径，不跟随 iOS 切换。

## CI 签名状态

iOS CI Archive / upload 暂缓到 Apple Developer Team、App Store Connect API Key、证书和 provisioning profile 确认后再接入。当前先保留手动 Xcode Archive + TestFlight 上传路线。
