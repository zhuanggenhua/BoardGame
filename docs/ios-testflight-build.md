# iOS TestFlight 构建速查

## 目标口径

- iOS 原生壳通过 TestFlight 分发，不走公开 App Store 上架。
- H5 本体继续走 `embedded + OTA / Live Update`，channel 语义与 Android 一致。
- iOS 原生二进制更新只能重新上传 TestFlight build；不要做 IPA 内下载/安装。
- Android 现有 APK、OTA、native update、game package 路径不因 iOS 变更而改变。

## GitHub Actions 远程生产包

当前可直接使用标准 GitHub 托管 `macos-latest` runner 打 iOS 生产 `.ipa`，不要求本地有 Mac 或 iPhone。入口：

- GitHub Actions -> `iOS Release Build`
- 默认 `export_method=app-store-connect`
- 默认 `channel=stable`
- 产物 artifact：`ios-release-ipa`
- 符号表 artifact：`ios-release-dsym`

这条 workflow 只负责 `Archive + export .ipa`，不自动上传 TestFlight。上传 TestFlight 需要后续再接 App Store Connect API Key 或 Transporter。

### GitHub Vars

建议放在 repository variables：

```text
VITE_BACKEND_URL=https://api.easyboardgame.top
VITE_ASSETS_BASE_URL=https://assets.easyboardgame.top/official
IOS_CAPACITOR_APP_ID=top.easyboardgame.app
IOS_CAPACITOR_APP_NAME=易桌游
IOS_OTA_APP_READY_TIMEOUT_MS=15000
IOS_DEVELOPMENT_TEAM=<Apple Team ID，可选；不填则从 provisioning profile 读取>
IOS_CODE_SIGN_IDENTITY=Apple Distribution
```

不要配置 `IOS_VITE_BACKEND_URL` 作为独立后端入口；iOS、Android 和 Web 必须共用同一个 `VITE_BACKEND_URL`。如果临时从域名切到 IP，也改这一处。

### GitHub Secrets

必须放在 repository secrets：

```text
IOS_DISTRIBUTION_CERTIFICATE_BASE64=<Apple Distribution .p12 的 base64>
IOS_DISTRIBUTION_CERTIFICATE_PASSWORD=<导出 .p12 时设置的密码>
IOS_PROVISION_PROFILE_BASE64=<App Store provisioning profile 的 base64>
IOS_KEYCHAIN_PASSWORD=<GitHub runner 临时 keychain 密码，自己生成一个强密码>
```

没有 Mac 时可以用 Windows / Git Bash / WSL 的 OpenSSL 生成 Apple 证书需要的 CSR 和 `.p12`：

```bash
openssl genrsa -out ios_distribution.key 2048
openssl req -new -key ios_distribution.key -out ios_distribution.csr -subj "/CN=EasyBoardGame iOS Distribution"
```

然后在 Apple Developer 网站创建 `Apple Distribution` 证书，上传 `ios_distribution.csr`，下载 `distribution.cer` 后生成 `.p12`：

```bash
openssl x509 -inform DER -in distribution.cer -out distribution.pem
openssl pkcs12 -export -out ios_distribution.p12 -inkey ios_distribution.key -in distribution.pem
```

PowerShell 转 base64：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ios_distribution.p12")) | Set-Content ios_distribution.p12.base64 -NoNewline
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AppStore_top.easyboardgame.app.mobileprovision")) | Set-Content ios_profile.mobileprovision.base64 -NoNewline
```

### 一次性运行前核对

- Apple Developer 里存在显式 App ID：`top.easyboardgame.app`。
- App Store Connect 里已创建对应 App 记录。
- provisioning profile 类型是 App Store / App Store Connect 分发，Bundle ID 是 `top.easyboardgame.app`，Team ID 与证书一致。
- workflow 默认 `app-store-connect`，不要用 development/debug profile。
- `VITE_BACKEND_URL` 指向与 Web / Android 共用的公开后端入口。
- `VITE_ASSETS_BASE_URL` 指向 `https://assets.easyboardgame.top/official`。
- 仓库当前 ref 已包含最新 `ios/`、`capacitor.config.ts`、`package-lock.json`。

## 本地准备

Windows 可以维护仓库和执行 Web 构建；如果不用 GitHub Actions，最终 Archive、签名和上传仍必须在 macOS + Xcode 上完成。

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

本地 iOS 调试也不要新增 `IOS_VITE_BACKEND_URL`；需要切后端时仍改同一个 `VITE_BACKEND_URL`。

## TestFlight 发布步骤

### 手动 Xcode 路线

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

发布脚本会读取 `dist/ios-build-meta.json`，只接受 `mode=ios` 且 `appId=top.easyboardgame.app` 的产物。服务器资源主源路径为 `official/app-updates/ios/<channel>/...`，不会覆盖 Android 的 `official/app-updates/android/<channel>/...`。

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

iOS CI Archive 已接入 `.github/workflows/ios-release-build.yml`。CI upload 到 TestFlight 仍暂缓到 App Store Connect API Key 确认后再接入。
