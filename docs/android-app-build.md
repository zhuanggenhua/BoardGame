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

默认内部发包命令是 `npm run mobile:android:build:release`，产物是可直接安装分发的签名 `APK`。

只有要对接应用商店时，才使用 `npm run mobile:android:build:bundle` 产出 `AAB`。

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

- 把 keystore 规范化到 `android/keystores/release-upload.keystore`
- 生成 `android/keystore.properties`

`npm run mobile:android:build:release` 和 `npm run mobile:android:build:bundle` 都会在构建前强制检查签名配置。
