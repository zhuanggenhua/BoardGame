# iOS TestFlight 构建速查

本文记录 iOS 原生壳、TestFlight 和 iOS OTA 的当前事实。Android 发布不受本文改变，仍看 [`mobile-release`](mobile-release.md) 与 [`android-app-build`](android-app-build.md)。

## 当前口径

- iOS 原生壳通过 TestFlight 分发，不走公开 App Store 上架。
- H5 本体继续走 `embedded + OTA / Live Update`，channel 语义与 Android 一致。
- iOS 原生二进制更新只能上传新的 TestFlight build；不做 IPA 内下载 / 安装。
- iOS、Android、Web 共用 `VITE_BACKEND_URL`，不要新增 iOS 专属后端入口。

## GitHub Actions

当前 workflow：`iOS Release Build`。

| 项 | 当前值 |
| --- | --- |
| runner | `macos-latest` |
| export method | `app-store-connect` |
| 默认 channel | `stable` |
| IPA artifact | `ios-release-ipa` |
| dSYM artifact | `ios-release-dsym` |

这条 workflow 只负责 `Archive + export .ipa`，不自动上传 TestFlight。TestFlight 上传仍需 App Store Connect API Key 或 Transporter 接入。

## 必要配置

Repository variables：

```text
VITE_BACKEND_URL=https://api.easyboardgame.top
VITE_ASSETS_BASE_URL=https://assets.easyboardgame.top/official
IOS_CAPACITOR_APP_ID=top.easyboardgame.app
IOS_CAPACITOR_APP_NAME=易桌游
IOS_OTA_APP_READY_TIMEOUT_MS=15000
IOS_DEVELOPMENT_TEAM=<Apple Team ID>
IOS_CODE_SIGN_IDENTITY=Apple Distribution
```

Repository secrets：

```text
IOS_DISTRIBUTION_CERTIFICATE_BASE64=<Apple Distribution .p12 base64>
IOS_DISTRIBUTION_CERTIFICATE_PASSWORD=<p12 password>
IOS_PROVISION_PROFILE_BASE64=<App Store provisioning profile base64>
IOS_KEYCHAIN_PASSWORD=<runner temporary keychain password>
```

一次性核对：

- Apple Developer 中存在显式 App ID：`top.easyboardgame.app`。
- App Store Connect 中存在对应 App 记录。
- provisioning profile 是 App Store / App Store Connect 分发类型。
- Bundle ID、Team ID、证书和 profile 匹配。
- 仓库 ref 包含最新 `ios/`、`capacitor.config.ts`、`package-lock.json`。

## 本地入口

Windows 可以维护仓库和执行 Web 构建；本地 Archive、签名和上传仍需要 macOS + Xcode。

```bash
npm install
npm run mobile:ios:sync
npm run mobile:ios:open
```

本地 iOS 配置默认读 `.env.ios.local`。需要切后端时仍改 `VITE_BACKEND_URL`。

## iOS OTA

构建 iOS Web 产物：

```bash
npm run build:ios:web
```

预演：

```bash
npm run mobile:ios:ota:publish -- --channel stable --dry-run
```

正式发布：

```bash
npm run mobile:ios:ota:publish -- --channel stable
```

需要显式商业产品版本时加 `--product-version <version>`；需要确认发布 ref 的 `package.json.version` 时才加 `--expected-base-version <version>`。发布脚本只接受 `dist/ios-build-meta.json` 中 `mode=ios` 且 `appId=top.easyboardgame.app` 的产物。服务器路径：

- iOS OTA manifest：`official/app-updates/ios/<channel>/latest.json`
- iOS OTA bundle：`official/app-updates/ios/<channel>/bundles/<bundleVersion>.zip`
- iOS 游戏包：`official/mobile-packages/ios/<channel>/games/<gameId>.json`

## 热更边界

可以走 iOS OTA：

- 主页、大厅、房间、游戏 UI 等 H5 修复。
- 不涉及原生能力变化的 Web 逻辑、样式、文案和轻量资源引用。

必须发新 TestFlight build：

- Capacitor 插件新增 / 升级。
- iOS 权限、Info.plist、原生代码、图标、启动图、签名、Bundle ID 变化。
- 改变 App 主要目的或需要重新审核的能力变化。
