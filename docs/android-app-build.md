# Android App 构建事实

本文记录 Android 构建、OTA、native 包和资源包的当前事实。日常执行优先看 [`mobile-release`](mobile-release.md)；AI 发布流程看项目 [`android-app-release`](../.spec/skills/android-app-release/SKILL.md)。

## 构建入口

| 目标 | 命令 |
| --- | --- |
| 环境检查 | `npm run mobile:android:doctor` |
| 同步 Capacitor | `npm run mobile:android:sync` |
| 构建正式 APK | `npm run mobile:android:build:release` |
| 构建 AAB | `npm run mobile:android:build:bundle` |
| 发布 OTA | `node scripts/mobile/release-android.mjs ota --channel stable` |
| 发布 native | `node scripts/mobile/release-android.mjs native --channel stable --bump patch` |
| 发布游戏包 | `node scripts/mobile/release-android.mjs packages --channel stable --game <gameId>` |
| 本地兼容 smoke | `npm run mobile:android:compat:smoke -- --avd <AVD>` |

`release / bundle / prepare-release` 默认必须产出正式壳：`top.easyboardgame.app` 与 `易桌游`。`debug / run / sync` 可继续使用测试壳。

## WebView 模式

| 模式 | 用途 | 边界 |
| --- | --- | --- |
| `embedded` | 当前默认。APK 内置 H5 bundle，启动后通过 OTA 更新 Web 内容 | 只内置壳和必要轻量文件；运行时大资源走服务器素材主源、游戏包或共享包 |
| `remote` | 调试、兼容或短期灰度 | 必须显式配置 `ANDROID_WEBVIEW_MODE=remote` 和 `ANDROID_REMOTE_WEB_URL`；不是长期主线 |

Web 内容更新默认走 `embedded + OTA / Live Update`。原生插件、权限、Manifest、Java/Kotlin、系统栏、返回键、方向映射、图标和启动图变更必须发 native 包。

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `VITE_BACKEND_URL` | Web / Android 共用业务后端入口 |
| `VITE_ANDROID_CONTROL_ASSETS_BASE_URL` | Android 控制入口域名，默认 `https://assets.easyboardgame.top/official` |
| `VITE_ANDROID_DOWNLOAD_ASSETS_BASE_URL` | APK / bundle 下载入口，可走 IP 主源 |
| `VITE_ANDROID_NATIVE_UPDATE_ENABLED` | 是否启用 native 更新检查 |
| `VITE_ANDROID_NATIVE_UPDATE_CHANNEL` | native 更新 channel |
| `CAPACITOR_APP_ID` | 正式包必须是 `top.easyboardgame.app` |
| `CAPACITOR_APP_NAME` | 正式包必须是 `易桌游` |

迁移期旧后端变量只允许作为别名；它们与 `VITE_BACKEND_URL` 同时存在但不一致时，构建必须失败。

## OTA 事实

- 运行时插件：`@capgo/capacitor-updater`。
- 发布源：服务器素材主源 `official/app-updates/android/<channel>/...`。
- 当前策略：所有 channel 强制更新，manifest 固定 `forceUpdate: true`。
- 启动检查发现新 bundle 后显示阻塞式下载和切换反馈。
- 每次原生启动尽早调用 `notifyAppReady()`，避免插件回滚已下载 bundle。
- OTA zip 不携带运行时大图片、图集配置、状态图集 JSON、缩略图、支付二维码和共享音频。

OTA manifest 关键字段：

```json
{
  "version": "6.0.0-ota-2026-04-04T00-00-00-000Z",
  "displayVersion": "600",
  "productVersion": "0.6.47",
  "url": "https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/<file>.zip",
  "checksum": "sha256-hex",
  "size": 123456,
  "channel": "stable",
  "forceUpdate": true,
  "publishedAt": "2026-04-04T00:00:00.000Z",
  "notes": "Android OTA update"
}
```

## Native 更新事实

- 适用：原生插件、权限、Manifest、Java/Kotlin、包体结构、方向映射、系统安装包更新。
- 控制入口：`official/native-app-updates/android/<channel>/latest.json`。
- 下载完成后拉起系统安装器；普通 Android 应用不能静默覆盖安装。
- Android 8+ 可能要求用户授权“安装未知应用”。
- `--skip-latest` 只能配合 dry-run 诊断，正式发布不能跳过 `latest.json` 切换。

native `latest.json` 至少包含 `version / versionCode / url / checksum / size / channel / publishedAt / notes`。

## 包体边界

embedded APK 和 OTA 都不能重复内置本应由服务器素材主源、游戏包或共享包下载的运行时大资源。重点排除：

- `assets/common/audio/**`
- `assets/common/images/**` 下的大型运行时资源
- `assets/atlas-configs/**`
- `assets/i18n/**` 下除 `assets-manifest.json` 外的图片、音频和运行时配置
- `public/logos/**`
- 参考图、预览图、生成图、中间产物

Android 游戏包和共享包的路径合同见 [`asset-pipeline`](../.spec/knowledge/standards/asset-pipeline.md) 与 [`audio-assets`](../.spec/knowledge/standards/audio-assets.md)。zip entry、file index、原生落盘和 H5 读取路径必须同构。

## 验包清单

本地构建或发布前至少检查：

- `android/app/build/outputs/apk/release/output-metadata.json`
- `android/app/src/main/res/values/strings.xml`
- `android/app/build.gradle`
- `android/app/src/main/assets/game-orientation-map.json`，如果本轮涉及方向映射

发布后必须下载线上产物回查。只有线上 APK 的 appId、appName、versionCode、checksum 和目标内容都对上，才能说 native 包已更新。
