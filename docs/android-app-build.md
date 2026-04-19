# Android App 构建自动化

日常发布速查请先看 [docs/mobile-release.md](./mobile-release.md)；这份文档保留完整底层说明。

## GitHub Actions 配置口径（先看这里）

- Android Release / OTA workflow 默认优先读取与 `.env.example` 一致的同名配置。
- 后端地址优先使用 GitHub Variables 的 `VITE_BACKEND_URL`。
- `ANDROID_VITE_BACKEND_URL` 只作为兼容旧配置的别名，不再是唯一入口。
- OTA 对象存储仍使用 GitHub Secrets：`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME`。
- 推荐最小配置：
  - Variables: `VITE_BACKEND_URL`、`VITE_ASSETS_BASE_URL`、`ANDROID_OTA_AUTO_CHANNEL`、`CAPACITOR_APP_ID`、`CAPACITOR_APP_NAME`
  - Secrets: `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME`

## 命令

- `npm run mobile:android:doctor`
- `npm run mobile:android:assets`
- `npm run mobile:android:prepare-release`
- `npm run mobile:android:init`
- `npm run mobile:android:sync`
- `node scripts/mobile/release-android.mjs ota --channel stable`
- `npm run mobile:android:packages:publish -- --channel stable`
- `npm run mobile:android:compat:smoke -- --avd <AVD 名称>`
- `npm run mobile:android:build:debug`
- `npm run mobile:android:build:release`
- `npm run mobile:android:build:bundle`

## WebView 模式（强制约定）

通过环境变量 `ANDROID_WEBVIEW_MODE` 控制 Android 壳加载方式：

- `embedded`：默认模式（未显式指定时生效）
  - 将 `dist/` 同步到 `android/app/src/main/assets/public/`
  - APK 内置完整前端资源
  - 这是当前主线发布方案
- `remote`：仅在明确指定时启用
  - 通过 `Capacitor server.url` 加载线上页面
  - 不把完整前端静态资源打进 APK
  - 仅适合调试、兼容或短期灰度，不作为长期主线产品方案

`remote` 模式必须配置：

```env
ANDROID_WEBVIEW_MODE=remote
ANDROID_REMOTE_WEB_URL=https://your-domain.com
```

- 当前实现接受绝对 `HTTP/HTTPS` 地址。
- 若不是在局域网临时调试或短期灰度场景，仍优先使用 `HTTPS`。

## 默认策略

- 除非明确指定，否则一律按 `embedded` 构建。
- 只有在你明确提出“要纯壳远程加载 / 要短期兼容某个上线节奏”时，才切换为 `remote`。

## 热更新主线

- 当前仓库默认发布形态是 `embedded`，默认热更新主线是 **`embedded + OTA/Live Update`**。
- 这条链路已经接入基础 OTA runtime：Android 壳内置 `embedded` bundle，启动后后台检查 OTA manifest；若检测到兼容的新 bundle，则下载并排队为下一次进入后台或重启后生效。
- 这意味着“主页 / 大厅 / 房间 / 游戏 UI”这类 H5 本体以后可以走 OTA，不再把 `remote WebView` 当长期产品方案。
- 依据 Capacitor 官方文档，长期更新 Web 内容的主流方向是 **Live Update / Realtime Updates**：原生壳保持不变，按版本下发新的 Web bundle；不涉及原生二进制能力变更时，这类更新是可行的。
- 仍然需要重新发包的内容包括：原生插件、Java/Kotlin/Swift/Objective-C 代码、权限、Manifest、原生启动逻辑、图标与启动图等二进制侧变更。
- 结论：文档和实现都应以 `embedded` 为默认，以 OTA/Live Update 作为热更新主线；`remote` 仅保留为兼容/调试路径，不再作为产品默认推荐。

## 原生 APK 自更新

- 适用场景：原生插件、权限、Manifest、Java/Kotlin 代码、包体结构等需要重新发 APK 的变更。
- 当前实现口径：
  - App 启动后可检查 `native-app-updates/android/<channel>/latest.json`
  - 若发现更高版本 APK，则下载到本地缓存
  - 下载完成后拉起系统安装器，按系统提示覆盖安装
- 这条链路不是静默更新；普通 Android 应用仍需用户在系统安装界面确认。
- Android 8+ 若设备尚未允许“安装未知应用”，会先提示打开对应授权页，再返回继续安装。

### 当前环境变量

```env
VITE_ANDROID_NATIVE_UPDATE_ENABLED=true
VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL=https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json
VITE_ANDROID_NATIVE_UPDATE_CHANNEL=stable
```

### 发布原生更新包

先完成 release APK 构建：

```bash
npm run mobile:android:build:release
```

预演上传：

```bash
npm run mobile:android:native-update:publish -- --channel stable --dry-run
```

正式发布：

```bash
npm run mobile:android:native-update:publish -- --channel stable
```

如果只想先上传 APK 和版本 manifest，不切 `latest.json`：

```bash
npm run mobile:android:native-update:publish -- --channel stable --skip-latest
```

当前默认发布路径：

- `official/native-app-updates/android/<channel>/packages/<version>.apk`
- `official/native-app-updates/android/<channel>/manifests/<version>.json`
- `official/native-app-updates/android/<channel>/latest.json`

`latest.json` 结构示例：

```json
{
  "version": "0.5.0",
  "versionCode": 500,
  "url": "https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/0.5.0.apk",
  "checksum": "sha256-hex",
  "channel": "stable",
  "forceUpdate": true,
  "forceUpdateTitle": "需要安装新版 App",
  "forceUpdateMessage": "正在准备新的安装包，请按系统提示完成更新。",
  "publishedAt": "2026-04-04T00:00:00.000Z",
  "size": 123456789,
  "notes": "Android native APK update"
}
```

## 当前 OTA 实现

- 运行时插件：`@capgo/capacitor-updater`
- 发布源：自托管 manifest + zip bundle，当前约定放在对象存储 `official/app-updates/android/<channel>/...`
- 当前默认发布策略：**后台 OTA**
- 默认行为：启动后后台检查；一旦发现兼容的新 bundle，后台下载并排队，切到后台或下次重启后生效
- 启动确认：App 每次原生启动时尽早调用 `notifyAppReady()`，避免已下载 bundle 被插件自动回滚

### OTA 何时生效

- 不是“代码一改客户端立刻变最新版”。只有你执行一次 OTA 发布，把新的 `dist/` 打包上传并更新 manifest，客户端检查到后才会下载。
- 如果只是本地改代码或只重新打了 APK，但没有发布 OTA manifest，已安装用户不会自动拿到这次 H5 更新。
- 当前默认检查时机是：用户打开 App 后启动检查。

### 当前升级策略

- 普通 OTA
  - 这是当前默认发布策略
  - manifest 默认不声明 `forceUpdate: true`
  - App 启动后后台检查，兼容则后台下载
  - 下载完成后排队，切到后台或下次重启后生效
  - 不阻塞用户
- 带 `forceUpdate: true` 的 OTA
  - 对兼容当前原生壳的 bundle，仍然按普通 OTA 处理
  - 不再在当前会话显示阻塞式下载/切换页
  - 仍然是后台下载并排队，切到后台或下次重启后生效
- 原生版本门禁（已废弃）
  - 不再按 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion` 做 OTA 分流
  - 即便 manifest 误带这些字段，运行时也会忽略并继续走 OTA
  - 若需原生能力更新，必须另发 APK / AAB（不要靠 manifest 门禁）

当前环境变量：

```env
ANDROID_WEBVIEW_MODE=embedded
VITE_ANDROID_OTA_ENABLED=true
VITE_ANDROID_OTA_MANIFEST_URL=https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json
VITE_ANDROID_OTA_CHANNEL=stable
VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS=15000
```

`doctor` 可直接检查当前 OTA 配置是否生效：

```bash
npm run mobile:android:doctor
```

## 本地兼容性 Smoke

- 命令：`npm run mobile:android:compat:smoke -- --avd <AVD 名称>`
- 目标：用于本地偶发性的 Android 功能兼容验证，不是长期 E2E 框架
- 默认行为：
  - 连接已存在的 adb 设备；如果没有，则自动启动一个本地 AVD
  - 安装现有 APK（默认优先 `android/app/build/outputs/apk/debug/easyboardgame-debug.apk`）
  - 启动 App，等待首屏稳定
  - 若传 `--route`，会在 App 启动后优先通过 WebView CDP 直切到目标 H5 路由；即使 Android 自定义深链不稳定，也能直接进入游戏页采图
  - 采集截图、UI dump、`logcat`、WebView/Chrome 版本信息
  - 自动判断是否疑似纯黑屏，以及是否低于兼容基线
- 当前兼容基线：`WebView/Chrome 主版本 >= 88`
- 默认输出目录：`test-results/android-compat-smoke/<时间戳>/`

推荐最小流程：

```bash
npm run mobile:android:build:debug
npm run mobile:android:compat:smoke -- --avd Pixel_3a_API_24
```

如果已经有设备连着，也可直接指定 serial：

```bash
npm run mobile:android:compat:smoke -- --serial emulator-5554
```

常用参数：

- `--apk <path>`：安装指定 APK
- `--skip-install`：跳过安装，只复用设备上的现有 App
- `--min-webview-major <n>`：覆盖默认 WebView 基线，默认 `88`
- `--launch-delay-ms <ms>`：启动后等待多久再抓证据
- `--route <path>`：直达指定 H5 路由，例如 `/play/dicethrone/tutorial`、`/play/dicethrone/local`
- `--keep-emulator`：脚本启动的模拟器结束后不自动关闭

产物说明：

- `screen.png`：设备截图
- `webview-cdp.png`：若使用 `--route`，额外保存一份 WebView CDP 截图，便于和设备整屏截图交叉判断
- `window_dump.xml`：`uiautomator dump` 导出的界面层级
- `logcat.txt`：本次启动后的日志快照
- `summary.json` / `summary.txt`：结构化结论，包含 Android 版本、WebView 版本、黑屏分析与产物路径

## 游戏包下载主线

- `package-managed` 游戏现在走 Android 原生下载器，不再只是前端 mock 状态。
- 主线口径：
  - H5 本体更新：`embedded + OTA`
  - 大体积游戏资源：`mobile package manifest + zip 包 + 原生下载/解压`
- 当前默认 manifest 基址：
  - `https://assets.easyboardgame.top/official/mobile-packages/android/<channel>/games/<gameId>.json`
- 如需切到其他静态源，可配置：

```env
VITE_MOBILE_PACKAGE_MANIFEST_URL=https://assets.easyboardgame.top/official/mobile-packages/android
```

### 发布游戏包

推荐先预演：

```bash
node scripts/mobile/publish-android-game-packages.mjs --channel stable --game dicethrone --dry-run
```

正式发布：

```bash
node scripts/mobile/publish-android-game-packages.mjs --channel stable --game dicethrone
```

也可通过 npm script：

```bash
npm run mobile:android:packages:publish -- --channel stable --game dicethrone
```

当前脚本会上传：

- `official/mobile-packages/android/<channel>/bundles/<gameId>/<version>.zip`
- `official/mobile-packages/android/<channel>/manifests/<gameId>/<version>.json`
- `official/mobile-packages/android/<channel>/games/<gameId>.json`

manifest 结构示例：

```json
{
  "gameId": "dicethrone",
  "runtimeChannel": "stable",
  "publishedAt": "2026-03-31T01:00:00.000Z",
  "modulePack": null,
  "assetPack": {
    "id": "dicethrone",
    "version": "0.5.0-dicethrone-pkg-2026-03-31T01-00-00-000Z",
    "url": "https://assets.easyboardgame.top/official/mobile-packages/android/stable/bundles/dicethrone/0.5.0-dicethrone-pkg-2026-03-31T01-00-00-000Z.zip",
    "checksum": "sha256-hex",
    "bytes": 46936411,
    "fileCount": 276
  }
}
```

## OTA 发布流程

推荐顺序：

1. `npm run mobile:android:sync`
2. 确认 `dist/` 和 `android/app/src/main/assets/public/` 已同步
3. 先预演一次发布：

```bash
node scripts/mobile/release-android.mjs ota --channel stable --dry-run
```

4. 如果只想先上传 bundle 和版本 manifest，不立刻切 `latest.json`：

```bash
node scripts/mobile/release-android.mjs ota --channel stable --skip-latest
```

5. 确认无误后再正式更新 channel 的 `latest.json`：

```bash
node scripts/mobile/release-android.mjs ota --channel stable
```

当前 OTA 规则已改为统一全量更新：

- OTA manifest 默认不再写 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion`
- 所有 channel（包括 `stable`）默认都面向所有已安装版本
- 如果需要客户端拿到更新后立即切换 bundle，可显式传 `--force-update`
- 若误传任何原生版本兼容参数，发布脚本会直接失败，防止再次发出“只给某个原生版本”的错误 OTA

如果你要自定义强更文案：

```bash
node scripts/mobile/release-android.mjs ota --channel stable --force-update --force-update-title "正在更新" --force-update-message "正在下载必要更新，请稍候"
```

如果走 GitHub Actions 自动化：

- `main` 分支合入影响 H5 bundle 的改动后，会自动发布 **stable OTA**
- `gray` / `edge` 仍可通过 Actions `Android OTA Publish` 手动触发（`stable` 也可手动重发）
- 如需人工审批，可在**手动** OTA workflow 上绑定 `android-ota-production` Environment
- **原生壳更新始终手动发包**，不走 `main` 自动流程
- 手动触发时，workflow 只保留 `force_update`、`force_update_title`、`force_update_message`；原生版本门禁参数已移除

推荐发布策略：

1. 日常合并到 `main`：自动发 **stable OTA**
2. 灰度/测试机验证：手动发 `gray` 或 `edge`
3. 需要原生壳更新时：手动发 native update（与 OTA 独立）

可选参数：

- `--channel <name>`：发布 channel，例如 `stable`、`gray`
- `--version <bundleVersion>`：手动指定 bundle 版本号
- `--native-version <version>`：当前打包对应的原生版本，默认取 `package.json.version`
- `--force-update`：这次 OTA 下载完成后立即切换 bundle
- `--no-force-update`：关闭“下载完成后立即切换”的行为
- `--force-update-title <text>`：覆盖 OTA 更新提示标题
- `--force-update-message <text>`：覆盖 OTA 更新提示正文
- `--notes <text>`：写入 manifest 备注
- `--dry-run`：只打 zip、算 checksum、打印 manifest，不上传
- `--skip-latest`：上传 zip 和版本 manifest，但不覆盖 `<channel>/latest.json`

兼容字段生成规则：

- OTA manifest 默认不再写 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion`
- 所有 channel 默认都面向所有已安装版本
- 如误传任何原生版本兼容参数，发布脚本会直接失败
- `forceUpdate` 只表示客户端拿到更新后是否立即切换 bundle，不再承担“按原生版本阻断”的语义

当前发布脚本会写入：

- `official/app-updates/android/<channel>/bundles/<bundleVersion>.zip`
- `official/app-updates/android/<channel>/manifests/<bundleVersion>.json`
- `official/app-updates/android/<channel>/latest.json`

## OTA Manifest 结构

`latest.json` 与版本 manifest 当前结构如下：

```json
{
  "version": "0.5.0-ota-2026-03-29T20-30-00-000Z",
  "url": "https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/0.5.0-ota-2026-03-29T20-30-00-000Z.zip",
  "checksum": "sha256-hex",
  "channel": "stable",
  "publishedAt": "2026-03-29T20:30:00.000Z",
  "size": 1234567,
  "notes": "Android embedded OTA bundle"
}
```

Manifest 字段说明：

- 默认不再包含 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion`
- `forceUpdate`：声明客户端下载完成后是否立即切换到新 bundle
- `forceUpdateTitle` / `forceUpdateMessage`：覆盖 OTA 更新提示文案

示例：

```json
{
  "version": "0.5.0-ota-2026-03-30T10-00-00-000Z",
  "url": "https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/0.5.0-ota-2026-03-30T10-00-00-000Z.zip",
  "checksum": "sha256-hex",
  "channel": "stable",
  "forceUpdate": true,
  "forceUpdateTitle": "正在更新",
  "forceUpdateMessage": "正在下载必要更新，请稍候",
  "publishedAt": "2026-03-30T10:00:00.000Z",
  "size": 1234567,
  "notes": "Android embedded OTA bundle"
}
```

## 什么能 OTA，什么仍要发包

可以走 OTA：

- 首页、登录页、大厅、房间页、游戏 UI、前端资源引用、前端逻辑
- `dist/` 里输出的 H5 bundle 与静态资源路径

仍然需要重新发 APK / AAB：

- 新增或修改 Capacitor / Android 原生插件
- `android/` 原生工程、Java/Kotlin 代码、权限、Manifest、签名、图标、启动图
- 需要升级原生 SDK、系统能力或包体结构的变更

一句话：OTA 能更新的是 Web 本体，不是原生二进制。

## 验证口径

- 预演发布先用 `--dry-run`
- 小流量验证建议先发 `gray` 之类独立 channel，再切 `stable`
- 当前 App 主线 OTA 语义仍是“启动后后台检查，发现新 bundle 则后台下载并排队”
- 如需“下载完成后立即切换”，需显式触发即时 OTA（例如通过发布参数 + 客户端即时检查入口）
- 运行时不再按原生版本门禁阻断 OTA；若涉及原生能力变更，请按原生发布流程更新 APK / AAB
- 若本次改动涉及原生层，仍必须重新打包安装验证，不能把 OTA 当成原生更新替代品

## 正式发版策略

以后正式 Android OTA 发版统一按当前项目规则执行：

1. OTA 默认面向所有已安装版本，不再通过 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion` 做分流。
2. 如需客户端下载完成后立即切换 bundle，可显式传 `--force-update`。
3. 如果改动涉及原生能力、权限、插件或壳层代码，仍然要另外发原生 APK / AAB；不要把 OTA 当成原生更新替代品。
4. 正式 OTA 的 bundle 版本必须继续沿用既有命名口径：`package.json.version-ota-UTC时间戳`。切换发布入口（本地脚本 / GitHub Actions / 手工补发）时，不得擅自改成 `gha-*`、run number 或其他临时展示格式。

推荐命令：

```bash
node scripts/mobile/release-android.mjs ota --channel stable --force-update
```

## 正式发版前检查

正式切 `stable` 之前，至少人工确认以下两条：

1. 兼容当前正式壳的 OTA 路径：
- 安装上一个正式 APK
- 启动 App
- 必须自动进入即时 OTA 或成功切到最新 bundle

2. 原生改动路径（如本次涉及原生层）：
- 同步发布原生 APK / AAB 更新
- 在目标安装链路上验证能成功升级并进入最新壳

只要这两条里与本次发布相关的验证没有完成，就不能把正式发布说成完全收口。

## GitHub Actions 配置

自动化 OTA workflow 文件：

- `.github/workflows/android-ota-publish.yml`

需要的 GitHub Secrets：

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

可选 GitHub Variables：

- `VITE_BACKEND_URL`
- `VITE_ASSETS_BASE_URL`
- `ANDROID_OTA_AUTO_CHANNEL`
- `ANDROID_OTA_APP_READY_TIMEOUT_MS`
- `CAPACITOR_APP_ID`
- `CAPACITOR_APP_NAME`

兼容旧配置：

- `ANDROID_VITE_BACKEND_URL`
- `secrets.VITE_BACKEND_URL`

推荐 Environment：

- `android-ota-nonprod`
- `android-ota-production`

其中 `android-ota-production` 应配置 required reviewers，用于保护 `stable` 发布。

## GitHub Actions 自动化策略

- 目标口径是：H5 本体改动自动发 OTA，原生壳改动仍然走重新打包发包。
- 推荐做法：
  - `main` 合入后自动发布 `edge`
  - `gray` / `stable` 保留人工触发
  - `stable` 绑定 Environment 审批
- 不建议把 `stable` 也做成完全自动：
  - 本体更新虽然不需要重新发 APK，但仍可能影响大厅、主页、房间和对局体验
  - 给 `stable` 保留一道人工确认，可以避免把坏 bundle 直接推给所有已安装用户

## 关键约束

- 不要直接在 Android Studio 里只跑 `assembleRelease` / `bundleRelease`，应先执行构建脚本。
- `embedded` 模式下，构建前会校验 `dist/android-build-meta.json` 与
  `android/app/src/main/assets/public/android-build-meta.json` 一致性，不一致将阻断打包。
- `remote` 模式下，构建链会走 `cap update android` + `cap copy android`，并清理
  `android/app/src/main/assets/public/`，避免把完整前端资源误打进 APK。

## 文档口径说明

- 以后凡是提到 Android 主线发布方案，默认都指 `embedded`。
- 以后凡是提到 Android 主线热更新方案，默认都指 `embedded + OTA/Live Update`。
- 若文档里仍出现“`remote` 作为默认方案”或“`remote` 作为长期热更新方案”的表述，应视为过时口径并及时修正。

## 图标与启动图

默认素材：

- `public/logos/logo_1_grid.png`

自动生成输出：

- `android/app/src/main/res/mipmap-*/ic_launcher.png`
- `android/app/src/main/res/mipmap-*/ic_launcher_round.png`
- `android/app/src/main/res/mipmap-*/ic_launcher_foreground.png`
- `android/app/src/main/res/drawable*/splash.png`

可选环境变量：

```env
ANDROID_ICON_SOURCE=public/logos/logo_1_grid.png
ANDROID_SPLASH_SOURCE=public/logos/logo_1_grid.png
ANDROID_ICON_BACKGROUND=#FFFFFF
ANDROID_SPLASH_BACKGROUND=#FFFFFF
ANDROID_ICON_INSET_RATIO=0.68
ANDROID_ADAPTIVE_ICON_INSET_RATIO=0.72
ANDROID_SPLASH_LOGO_RATIO=0.34
```

## Release 签名

支持两种输入：

```env
# 本地文件
ANDROID_KEYSTORE_PATH=C:/secure/release-upload.keystore

# 或 CI / Secret Base64
ANDROID_KEYSTORE_BASE64=

ANDROID_KEYSTORE_PASSWORD=
ANDROID_KEY_ALIAS=
ANDROID_KEY_PASSWORD=
```

`npm run mobile:android:prepare-release` 会：

- 规范化 keystore 到 `android/keystores/release-upload.keystore`
- 生成 `android/keystore.properties`

`npm run mobile:android:build:release` 和 `npm run mobile:android:build:bundle` 会在构建前强制校验签名配置。
