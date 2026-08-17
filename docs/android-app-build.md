# Android App 构建自动化

日常发布速查请先看 [docs/mobile-release.md](./mobile-release.md)；这份文档保留完整底层说明。

## GitHub Actions 配置口径（先看这里）

- Android Release / OTA workflow 默认使用 App 专用后端地址，不继承网页通用后端域名。
- 后端地址优先使用 GitHub Variables / Secrets 的 `VITE_ANDROID_BACKEND_URL`，其次兼容 `ANDROID_VITE_BACKEND_URL`。
- 未配置 App 专用后端地址时，Android 默认使用 `http://8.148.71.102`；只有通用 `VITE_BACKEND_URL` 已经是 IP / localhost 直连地址时，本地脚本才兼容沿用。
- OTA 发布到服务器素材主源，不再要求对象存储凭据。
- 推荐最小配置：
  - Variables: `VITE_ANDROID_BACKEND_URL`、`VITE_ANDROID_CONTROL_ASSETS_BASE_URL`、`VITE_ANDROID_DOWNLOAD_ASSETS_BASE_URL`、`CAPACITOR_APP_ID`、`CAPACITOR_APP_NAME`
  - Secrets: 服务器素材主源发布所需的受限 SSH / 发布令牌

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

补充约束：

- `mobile:android:build:release`、`mobile:android:build:bundle`、`mobile:android:prepare-release` 默认强制正式壳：
  - `CAPACITOR_APP_ID=top.easyboardgame.app`
  - `CAPACITOR_APP_NAME=易桌游`
- `debug / run / sync` 才继续默认使用测试壳；禁止再出现“release 命令打出 易桌游测试 / top.easyboardgame.app.debug”的情况。

## WebView 模式（强制约定）

通过环境变量 `ANDROID_WEBVIEW_MODE` 控制 Android 壳加载方式：

- `embedded`：默认模式（未显式指定时生效）
  - 将 `dist/` 同步到 `android/app/src/main/assets/public/`
  - APK 只内置壳运行必需的 H5 bundle 与轻量静态文件
  - `public/assets/common/audio/**` 这类运行时大资源必须继续走服务器素材主源 / 游戏包链路，禁止跟随 embedded 打进 APK
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

## Embedded 包体门禁

- Android embedded 构建前会先裁剪 `dist/`，至少删除：
  - `dist/assets/i18n/**`
  - `dist/assets/common/audio/**`
  - `dist/assets/common/images/mascot/**`
  - `dist/assets/common/images/home-v2/book-close/**`
  - `dist/assets/common/images/home-v2/catalog-thumbnails/**`
  - `dist/assets/common/images/home-v2/generated-reference-homepage/**`
  - `dist/assets/common/images/home-v2/overview-spread/**`
  - `dist/assets/common/images/home-v2/reference-homepage/**`
  - `dist/assets/common/images/home-v2/reference-thumbnails/**`
- 构建阶段如果检测到 `dist/` 或 `android/app/src/main/assets/public/` 里仍包含以下前缀，脚本必须直接失败：
  - `assets/common/audio/**`
  - `assets/common/images/mascot/**`
  - `assets/common/images/home-v2/book-close/**`
  - `assets/common/images/home-v2/catalog-thumbnails/**`
  - `assets/common/images/home-v2/generated-reference-homepage/**`
  - `assets/common/images/home-v2/overview-spread/**`
  - `assets/common/images/home-v2/reference-homepage/**`
  - `assets/common/images/home-v2/reference-thumbnails/**`
- 这条门禁的本质约束是：**native APK 不得重复内置本应从服务器素材主源 / 游戏包下载的运行时大资源**。发现这类资源进入 APK，不是“先发再说”，而是构建链路配置错误。

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
VITE_ANDROID_CONTROL_ASSETS_BASE_URL=https://assets.easyboardgame.top/official
VITE_ANDROID_DOWNLOAD_ASSETS_BASE_URL=http://8.148.71.102/official
VITE_ANDROID_NATIVE_UPDATE_ENABLED=true
VITE_ANDROID_NATIVE_UPDATE_MANIFEST_URL=https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json
VITE_ANDROID_NATIVE_UPDATE_MANIFEST_FALLBACK_URLS=http://8.148.71.102/official/native-app-updates/android/stable/latest.json
VITE_ANDROID_NATIVE_UPDATE_CHANNEL=stable
```

控制入口只负责读取 `latest.json`，必须固定域名直返 `200 JSON`，不允许 30x 跳转。清单里的 APK 下载地址可以是 IP 直链；IP `latest.json` 只作为新客户端兜底，不能替代旧客户端能访问的域名控制入口。非标准端口不作为正式绕备案方案。

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

正式 Android 原生更新必须切换 `latest.json`，否则手机端无法发现新版 APK。`--skip-latest` 仅允许配合 `--dry-run` 做参数诊断，正式发布传入会直接失败。

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
- 发布源：自托管 manifest + zip bundle，当前约定放在服务器素材主源 `official/app-updates/android/<channel>/...`
- 当前发布策略：**所有 OTA 强制更新**
- 默认行为：启动后检查；一旦发现新的 bundle，立即显示阻塞式更新页，下载完成后切换 bundle 并重启页面
- 启动确认：App 每次原生启动时尽早调用 `notifyAppReady()`，避免已下载 bundle 被插件自动回滚

### OTA 何时生效

- 不是“代码一改客户端立刻变最新版”。只有你执行一次 OTA 发布，把新的 `dist/` 打包上传并更新 manifest，客户端检查到后才会下载。
- 如果只是本地改代码或只重新打了 APK，但没有发布 OTA manifest，已安装用户不会自动拿到这次 H5 更新。
- 当前默认检查时机是：用户打开 App 后启动检查。

### 当前升级策略

- 所有 OTA manifest 必须声明 `forceUpdate: true`
- 自动启动检查遇到新 bundle 时必须进入立即模式，显示阻塞式下载与切换反馈
- 发布脚本、后台发布中心和 GitHub Actions 都不得提供有效的非强制 OTA 入口
- `--no-force-update` 或等价的 `forceUpdate=false` 必须被拒绝
- 原生版本门禁（已废弃）
  - 不再按 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion` 做 OTA 分流
  - 即便 manifest 误带这些字段，运行时也会忽略并继续走 OTA
  - 若需原生能力更新，必须另发 APK / AAB（不要靠 manifest 门禁）

当前环境变量：

```env
ANDROID_WEBVIEW_MODE=embedded
VITE_ANDROID_CONTROL_ASSETS_BASE_URL=https://assets.easyboardgame.top/official
VITE_ANDROID_DOWNLOAD_ASSETS_BASE_URL=http://8.148.71.102/official
VITE_ANDROID_OTA_ENABLED=true
VITE_ANDROID_OTA_MANIFEST_URL=https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json
VITE_ANDROID_OTA_MANIFEST_FALLBACK_URLS=http://8.148.71.102/official/app-updates/android/stable/latest.json
VITE_ANDROID_OTA_CHANNEL=stable
VITE_ANDROID_OTA_APP_READY_TIMEOUT_MS=15000
```

OTA 控制入口同样必须固定域名直返 `latest.json`，发布脚本会校验域名入口无重定向且正文哈希等于本次发布；bundle zip 下载 URL 可走 IP 主源。

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

首次发布、强制重建或需要完整兜底包时，当前脚本会上传：

- `official/mobile-packages/android/<channel>/bundles/<gameId>/<version>.zip`
- `official/mobile-packages/android/<channel>/file-index/<gameId>/<version>.json`
- `official/mobile-packages/android/<channel>/manifests/<gameId>/<version>.json`
- `official/mobile-packages/android/<channel>/games/<gameId>.json`

### 服务器素材主源单文件资源更新

日常只替换少量游戏资源时，不应默认重发完整 ZIP。正确链路是：

1. 上传变更后的服务器素材主源单文件对象，例如 `official/i18n/zh-CN/dicethrone/.../compressed/player-board.webp`
2. 服务器发布脚本在同一个 release 内刷新目标游戏已有 channel 的 `file-index/<gameId>/<version>.json`
3. 服务器发布脚本同步刷新 `manifests/<gameId>/<version>.json` 与 `games/<gameId>.json`，让 latest manifest 指到新的差异索引版本
4. App 读取远端 `file-index`，与本地 `installed-files-index.json` 比对，只下载新增或哈希变化文件

本地预演某个资源路径会触发哪个 App 素材包刷新：

```bash
node scripts/assets/upload-to-server.js --android-package-publish-plan official/i18n/zh-CN/dicethrone/images/pyromancer/compressed/player-board.webp
```

普通游戏资源变更的预期输出应显示“服务器自动刷新”，实际刷新发生在服务器 `/asset-publish` apply 阶段；本机上传端不再二次执行 `publish-android-game-packages`。

也可以直接预演差异索引刷新：

```bash
node scripts/mobile/publish-android-game-packages.mjs --channel stable --game dicethrone --reuse-shared-audio --index-manifest-only --dry-run
```

`--index-manifest-only` 只上传新的 `file-index` 和 manifest，不上传 `bundles/<gameId>/<version>.zip`。该 manifest 的 `assetPack.diffOnly` 为 `true`，普通 `assetPack.url/checksum/bytes` 不应指向旧 ZIP；旧完整 ZIP 信息只能作为显式 fallback 字段保留，避免“更新成功但实际装回旧素材”的假结果。

共享音频变更暂时不走服务器自动刷新；上传入口发现共享音频对象时必须中断，并要求走完整共享音频包发布流程。这属于未自动化的阻塞，不得把“OGG 已上传”说成 App 共享音频包已更新。

验收时必须拆开三件事：

- 服务器素材主源单文件对象是否已上传并可访问
- `games/<gameId>.json` 是否已指向新的 `file-index` 版本
- 真机 App 是否只下载 changed 文件，并且本地哈希与远端 `file-index` 一致

### 真机验证默认使用正式包

本项目 Android 真机测试默认直接覆盖正式包：

- `applicationId` 必须保持 `top.easyboardgame.app`
- 应用名必须保持 `易桌游`
- `package_name` 和 `custom_url_scheme` 必须保持 `top.easyboardgame.app`

禁止为了排障或自测，默认把主线改成 `top.easyboardgame.app.debug` / `易桌游测试`。这会改变数据目录、URL scheme、下载任务记录和自动更新入口，导致测试结果不能代表正式用户环境。只有用户明确要求“并存安装一个测试包”时，才允许临时使用 debug 壳；该结果必须标为测试壳结果，不能当成正式包验收。

### 游戏包 / 共享包路径合同（强制）

- **zip entry、file index、原生落盘、H5 读取必须同构**：移动包里每个文件的相对路径，一旦从 `public/assets` 计算出来，就必须原样贯穿：
  1. 发布脚本写入 zip 的 entry path
  2. `file-index/*.json` 里的 `files[].path`
  3. 原生解压后 `current/assets/` 下的相对路径
  4. 前端 `readInstalledAsset(gameId, relativePath)` 传入的 `relativePath`
- **禁止单层裁前缀**：发布脚本、原生解压、增量下载、H5 读取，任何一层都不得单独把 `common/audio/` 改成 `bgm/` / `sfx/`，也不得把 `<gameId>/`、`atlas-configs/<gameId>/`、`i18n/<locale>/...` 等前缀只在某一层做扁平化。
- **共享音频包 `common-audio` 的标准合同**：相对路径必须继续使用 `common/audio/...`，而不是把 `bgm/...` / `sfx/...` 当成包根。BGM 缺失时，先查这条路径合同是否被打破，不要先改 BGM 调用逻辑。
- **修复顺序**：真机发现“包已安装但本地读取不到文件”时，先判定是 `打包脚本 / file index / 原生落盘 / H5 读取` 哪一层先偏离标准合同；确认偏离层后再修。只有历史已发包无法立刻替换时，才允许补一层兼容读取。

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

4. 正式更新 channel 的 `latest.json`：

```bash
node scripts/mobile/release-android.mjs ota --channel stable
```

当前 OTA 规则已改为统一全量更新：

- OTA manifest 默认不再写 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion`
- 所有 channel（包括 `stable`）都面向所有已安装版本，并固定写入 `forceUpdate: true`
- 客户端检测到新 OTA 后必须阻塞下载并立即切换；`--no-force-update` 已禁用
- OTA 打包器只保留 H5 代码、中文语言包、字体、必要公共文件和资源清单；嵌套游戏资源继续走服务器资源主源或移动游戏包
- 若误传任何原生版本兼容参数，发布脚本会直接失败，防止再次发出“只给某个原生版本”的错误 OTA

如果你要自定义强更文案：

```bash
node scripts/mobile/release-android.mjs ota --channel stable --force-update-title "正在更新" --force-update-message "正在下载必要更新，请稍候"
```

如果走 GitHub Actions 自动化：

- 只允许通过 Actions `Android OTA Publish` 手动触发；普通 `push main` 不得自动发布 **stable OTA**。
- `stable` 应绑定 `android-ota-production` Environment 审批。
- **原生壳更新始终手动发包**，不走 `main` 自动流程。
- Android stable OTA 与原生发布 workflow 的整次运行上限为 30 分钟；资源 URL、校验目标、预期大小或摘要无效时必须立即失败，不得进入长时间传播重试。
- 手动触发时，workflow 只保留发布必要参数；原生版本门禁参数已移除。
- 如需桥接旧客户端曾经记住的错误大版本，可填 `ota_version_base=6.0.0`，生成 `6.0.0-ota-...` 内部游标。
- 后台发布中心触发 OTA 时，默认通过 GitHub Actions dispatch 发起 `android-ota-publish.yml`，避免生产机本地构建。生产环境至少配置：
  - `BG_GITHUB_ACTIONS_TOKEN`：具备目标仓库 `workflow` 权限的 GitHub token
  - `BG_GITHUB_REPOSITORY`：默认 `zhuanggenhua/BoardGame`
  - `BG_ANDROID_OTA_WORKFLOW_REF`：默认 `main`，用于触发 workflow 的 ref
  - `BG_ANDROID_OTA_GIT_REF`：默认同上，用于 workflow 实际 checkout 的发布 ref

推荐发布策略：

1. 日常合并到 `main`：只跑常规 CI，不自动改 Android OTA 最新入口。
2. 灰度/测试机验证：手动发 `gray` 或 `edge`。
3. 确认后：手动发 `stable`，由环境审批保护。
4. 需要原生壳更新时：手动发 native update（与 OTA 独立）。

可选参数：

- `--channel <name>`：发布 channel，例如 `stable`、`gray`
- `--version <bundleVersion>`：手动指定 bundle 版本号
- `--ota-version-base <semver>`：未显式指定 `--version` 时，用于生成 bundle 内部游标；可与 `package.json.version` 解耦
- `--native-version <version>`：当前打包对应的原生版本，默认取 `package.json.version`
- `--force-update`：旧命令兼容参数，可省略；所有 OTA 本来就会强制更新
- `--no-force-update`：已禁用，传入后发布直接失败
- `--force-update-title <text>`：覆盖 OTA 更新提示标题
- `--force-update-message <text>`：覆盖 OTA 更新提示正文
- `--notes <text>`：写入 manifest 备注
- `--dry-run`：只打 zip、算 checksum、打印 manifest，不上传
- `--skip-latest`：仅允许配合 `--dry-run` 做参数诊断；正式 Android OTA 禁止跳过 `<channel>/latest.json`

兼容字段生成规则：

- OTA manifest 默认不再写 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion`
- 所有 channel 默认都面向所有已安装版本
- 如误传任何原生版本兼容参数，发布脚本会直接失败
- `forceUpdate` 固定为 `true`，表示客户端必须阻塞下载并立即切换 bundle，不承担“按原生版本阻断”的语义

当前发布脚本会写入：

- `official/app-updates/android/<channel>/bundles/<bundleVersion>.zip`
- `official/app-updates/android/<channel>/manifests/<bundleVersion>.json`
- `official/app-updates/android/<channel>/latest.json`

## OTA Manifest 结构

`latest.json` 与版本 manifest 当前结构如下：

```json
{
  "version": "0.5.0-ota-2026-03-29T20-30-00-000Z",
  "url": "http://8.148.71.102/official/app-updates/android/stable/bundles/0.5.0-ota-2026-03-29T20-30-00-000Z.zip",
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
  "url": "http://8.148.71.102/official/app-updates/android/stable/bundles/0.5.0-ota-2026-03-30T10-00-00-000Z.zip",
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
- 当前 App 主线 OTA 语义是“启动检查发现新 bundle 后，阻塞下载并立即切换”
- 必须验证自动启动检查也会进入立即模式，不能只验证手动更新按钮
- 运行时不再按原生版本门禁阻断 OTA；若涉及原生能力变更，请按原生发布流程更新 APK / AAB
- 若本次改动涉及原生层，仍必须重新打包安装验证，不能把 OTA 当成原生更新替代品

## 正式发版策略

以后正式 Android OTA 发版统一按当前项目规则执行：

1. OTA 默认面向所有已安装版本，不再通过 `targetNativeVersion` / `minNativeVersion` / `maxNativeVersion` 做分流。
2. 所有 OTA 必须写入 `forceUpdate: true`，客户端下载完成后立即切换 bundle；不允许关闭。
3. 如果改动涉及原生能力、权限、插件或壳层代码，仍然要另外发原生 APK / AAB；不要把 OTA 当成原生更新替代品。
4. 正式 OTA 的 bundle 版本必须继续沿用 `<ota-version-base>-ota-UTC时间戳` 或人工显式 `--version` 口径。默认 `ota-version-base=package.json.version`；桥接旧客户端时可临时升到更高内部游标，例如 `6.0.0`。客户端升级主判断依赖这个内部游标单调递增，`publishedAt` 只用于审计和展示。切换发布入口（本地脚本 / GitHub Actions / 手工补发）时，不得擅自改成 `gha-*`、run number 或其他临时展示格式。

推荐命令：

```bash
node scripts/mobile/release-android.mjs ota --channel stable
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

- 服务器素材主源发布所需的受限 SSH / 发布令牌

可选 GitHub Variables：

- `VITE_ANDROID_BACKEND_URL`
- `VITE_ASSETS_BASE_URL`
- `ANDROID_OTA_APP_READY_TIMEOUT_MS`
- `CAPACITOR_APP_ID`
- `CAPACITOR_APP_NAME`

兼容旧配置：

- `ANDROID_VITE_BACKEND_URL`
- `secrets.VITE_ANDROID_BACKEND_URL`

推荐 Environment：

- `android-ota-nonprod`
- `android-ota-production`

其中 `android-ota-production` 应配置 required reviewers，用于保护 `stable` 发布。

## GitHub Actions 自动化策略

- 目标口径是：CI 可以构建和校验，但不能因为普通协作者 push 就切换正式 Android OTA 最新入口。
- `gray` / `stable` 保留人工触发或后台发布触发。
- `stable` 绑定 Environment 审批。
- 本体更新虽然不需要重新发 APK，但仍可能影响大厅、主页、房间和对局体验；正式包必须保留一个明确的发布动作。

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
