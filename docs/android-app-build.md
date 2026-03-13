# Android App 构建自动化

## 命令

- `npm run mobile:android:doctor`
- `npm run mobile:android:assets`
- `npm run mobile:android:prepare-release`
- `npm run mobile:android:init`
- `npm run mobile:android:sync`
- `npm run mobile:android:build:debug`
- `npm run mobile:android:build:release`
- `npm run mobile:android:build:bundle`

## Android 壳加载模式

通过环境变量 `ANDROID_WEBVIEW_MODE` 控制 Android 壳加载哪一份 H5：

- `embedded`：默认模式。继续把 `dist/` 同步到 `android/app/src/main/assets/public/`，APK 内直接加载本地资源。
- `remote`：远程模式。通过 `Capacitor server.url` 直接加载线上 HTTPS 站点，不再要求当前前端版本打进 APK。

`remote` 模式必须额外配置：

```env
ANDROID_WEBVIEW_MODE=remote
ANDROID_REMOTE_WEB_URL=https://your-domain.com
```

选择建议：

- 需要离线启动、稳定发版、避免线上误发布立即影响 App：用 `embedded`
- 不上商店、希望 Web 一发布 App 就立刻跟着更新：用 `remote`

默认内部发包命令是 `npm run mobile:android:build:release`，产物是可直接安装分发的签名 `APK`。

只有要对接应用商店时，才使用 `npm run mobile:android:build:bundle` 产出 `AAB`。

## 关键约束

不要直接在 Android Studio 或命令行里只跑 `assembleRelease` / `bundleRelease`。Android 壳打包的是 `android/app/src/main/assets/public/`，如果这份目录没先和最新 `dist/` 同步，就会把旧前端资源打进 APK。现在构建链会写入 `dist/android-build-meta.json`，并在 Gradle 构建前检查它是否和 `android/app/src/main/assets/public/android-build-meta.json` 一致；不一致会直接阻止构建。最稳妥的正式发包方式仍然是 `npm run mobile:android:build:release`。

如果你必须从 Android Studio 点构建，先执行：

```bash
npm run mobile:android:sync
```

再去执行 Release 构建。

如果当前是 `remote` 模式，则 Android 构建不再依赖 `assets/public` 与 `dist/` 同步；`npm run mobile:android:build:release` 会直接按远程模式生成 APK，但 `ANDROID_REMOTE_WEB_URL` 必须是绝对 HTTPS 地址。

## 图标与启动图

默认资源源文件：

- `public/logos/logo_1_grid.png`

脚本会自动生成：

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

签名输入支持两种方式：

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

- 把 `keystore` 规范化到 `android/keystores/release-upload.keystore`
- 生成 `android/keystore.properties`

`npm run mobile:android:build:release` 和 `npm run mobile:android:build:bundle` 都会在构建前强制检查签名配置。
