---
name: android-app-release
description: "本项目 Android App 打包/上传/发布/验包 workflow。用于用户要求“打 app 包”“发安卓包”“上传 APK”“发布原生更新”“更新网站下载的 app”“检查下载到的是正式版还是测试版”“缩 Android 包体”“发 OTA / 发 native”时。核心目标是把 Android 发布固定成：选对发布类型 -> 正式壳构建 -> 上传正确入口 -> 回查 latest.json -> 直接下载线上 APK 验包，不允许停留在本地构建成功或只看 manifest。"
---

# Android App 发布 Skill

## 0. 什么时候用

命中以下任一场景就用本 skill：

- 打 Android APK / AAB
- 上传或发布 Android 原生更新
- 发布 Android OTA
- 更新网站“下载 App”入口
- 排查“为什么用户下载到的还是旧包 / 测试包 / 大包”
- 排查“为什么旧壳没有自动更新”

## 1. 先读权威来源

- [docs/mobile-release.md](/abs/path/D:/gongzuo/webgame/BoardGame/docs/mobile-release.md)
- [docs/android-app-build.md](/abs/path/D:/gongzuo/webgame/BoardGame/docs/android-app-build.md)
- [docs/deploy.md](/abs/path/D:/gongzuo/webgame/BoardGame/docs/deploy.md)
- [docs/ai-rules/asset-pipeline.md](/abs/path/D:/gongzuo/webgame/BoardGame/docs/ai-rules/asset-pipeline.md)

如果用户只要“更新网站下载的 App / 发原生更新”，默认**不用部署网站**；优先走原生发布链路，不要误升级成服务器部署。

## 2. 核心硬规则

### 2.1 本地构建成功不等于交付完成

- `npm run mobile:android:build:release` 成功，只能证明**本地产物** OK。
- 只要用户目标包含“上传 / 发包 / 更新网站下载 / 旧壳更新”，就必须继续完成：
  1. 发布对应产物
  2. 回查线上 manifest
  3. 直接下载线上 APK 验包
- 禁止停在“我已经本地打好了”。

### 2.2 release 与真机测试默认必须是正式壳

- `prepare-release / build-release / build-bundle / 真机安装测试 / 下载链路测试` 默认必须落到：
  - `appId = top.easyboardgame.app`
  - `appName = 易桌游`
- 本项目日常真机验证直接使用正式包名和正式应用名，避免测试壳与正式壳的数据目录、下载任务、自动更新入口、URL scheme 不一致。
- `debug / run / sync` 不得擅自切成 `top.easyboardgame.app.debug`。只有用户当轮明确要求“并存安装测试包 / debug 包 / 不覆盖正式包”时，才允许使用测试壳，并且最终汇报必须标明不是正式包验证。
- 只要用户目标是对外发布，任何 `debug / 测试 / qa / dev` 壳都视为失败产物。

### 2.3 线上验包必须看 APK 本体，不只看 latest.json

- `latest.json` 只能证明**入口指向了什么文件**，不能证明 APK 里面是不是正式壳。
- 发布后必须至少做这两步：
  1. 请求 `official/native-app-updates/android/<channel>/latest.json`
  2. 直接下载该 `url` 对应的 APK，并检查其中的 `appId / appName`
- 有 `aapt` / `apkanalyzer` 时优先用它们；没有时，至少解包后检查：
  - `assets/capacitor.config.json`
  - `assets/public/android-build-meta.json`

### 2.4 不要把“网站下载入口更新”误解成“必须部署网站”

- 如果网站下载入口是通过 `native-app-updates/android/<channel>/latest.json` 解析出来的：
  - 更新原生下载入口 = 发布新 APK + 更新该 manifest
  - **不需要**额外部署网站
- 只有当前端文案、按钮逻辑、回退路径代码也要改时，才需要前端构建/部署。

### 2.5 原生自动更新不能回退 versionCode

- Android 原生更新优先比较 `versionCode`。
- 已安装 `562` 的设备，不会把 `558` 当成更新。
- 所以：
  - 想让旧壳自动升级，新的 `versionCode` 必须更大
  - 想让“展示口径”回到 `0.5.58`，不能直接靠原生包降版本完成
- 遇到“网页想显示 58，但旧壳要自动更新”的需求，必须先把**显示版本**和**原生递增版本码**分开处理，不能直接硬回退原生版本。

### 2.6 Android embedded 必须保持轻包

- `public/assets/**` 只允许正式运行时资源。
- 禁止把以下内容打进 Android embedded / OTA：
  - `public/assets/common/audio/**`
  - `public/assets/common/images/mascot/**`
  - `public/assets/common/images/home-v2/book-close/**`
  - `public/assets/common/images/home-v2/catalog-thumbnails/**`
  - `public/assets/common/images/home-v2/generated-reference-homepage/**`
  - `public/assets/common/images/home-v2/overview-spread/**`
  - `public/assets/common/images/home-v2/reference-homepage/**`
  - `public/assets/common/images/home-v2/reference-thumbnails/**`
  - `public/assets/i18n/**`
  - 参考图、预览图、生成图、中间产物
- 一旦包体异常变大，先查 `public/assets/**` 和 `dist/`，不要先猜 CDN、缓存或签名。

### 2.7 用户说“上传 / 发原生更新 / 改网站下载 app”时，默认自动做完

- 除非用户明确说“先别上传 / 只本地打包”，否则不能等用户再催一次“上传”。
- 完整收口默认到“线上可下载并已验包”为止。

## 3. 路径选择

### 3.1 只改 H5 内容

- 走 OTA：

```bash
node scripts/mobile/release-android.mjs ota --channel stable
```

- 不要顺手 bump 原生版本。

### 3.2 改了原生壳 / 要更新网站下载的 APK / 要让用户安装新包

- 走 native：

```bash
node scripts/mobile/release-android.mjs native --channel stable
```

- 如果需要正式递增版本，显式加：

```bash
node scripts/mobile/release-android.mjs native --channel stable --bump patch
```

### 3.3 只想本地重打 APK，不上传

```bash
npm run mobile:android:build:release
```

- 但这不算发布完成，最终汇报必须明确写“未上传，线上仍不变”。

## 4. 发布工作流

### 4.1 本地构建前检查

至少确认：

- 当前目标是 `OTA` 还是 `native`
- 是否真的需要部署网站
- 是否涉及原生版本码递增

如果用户说“不要部署，只更新网站下载的 app”，默认是 **native publish，不是 deploy**。

### 4.2 本地构建与本地产物验证

推荐入口：

```bash
node scripts/mobile/release-android.mjs native --channel stable
```

或：

```bash
npm run mobile:android:build:release
```

本地至少验证：

- `android/app/build/outputs/apk/release/output-metadata.json`
- `android/app/src/main/res/values/strings.xml`
- `android/app/build.gradle`

必须确认：

- `applicationId = top.easyboardgame.app`
- `versionName / versionCode` 符合预期
- APK 大小没有异常暴涨

### 4.3 上传原生更新

预演：

```bash
npm run mobile:android:native-update:publish -- --channel stable --dry-run
```

正式上传：

```bash
npm run mobile:android:native-update:publish -- --channel stable
```

如果只想先上传版本文件，不切最新：

```bash
npm run mobile:android:native-update:publish -- --channel stable --skip-latest
```

### 4.4 线上回查

发布后必须回查：

```text
https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json
```

至少确认：

- `version`
- `versionCode`
- `url`
- `checksum`
- `size`

### 4.5 直接下载线上 APK 验包

必须直接下载 `latest.json.url` 指向的 APK。

验包至少确认：

- `appId` 不是 `top.easyboardgame.app.debug`
- `appName` 不是 `易桌游测试`
- 包体大小与本地预期一致量级

没有 `aapt` / `apkanalyzer` 时，允许解包后检查：

- `assets/capacitor.config.json`
- `assets/public/android-build-meta.json`

## 5. 最终汇报最少证据

只要对外说“Android 包已经更新 / 网站下载已可用 / 原生更新已发”，必须同时给出：

- 本地产物路径
- 线上 `latest.json` 的 `version/versionCode/url/size`
- 线上实际 APK 的正式壳验证结果
- 如果没做部署，要明确说“本次未部署网站，只更新原生下载入口”

## 6. 失败分类

### 6.1 本地成功，线上还是旧包

优先排查：

1. 还没执行 publish
2. publish 用了 `--skip-latest`
3. 线上 `latest.json` 仍指向旧版本
4. CDN 缓存未失效，但 APK URL 未变

### 6.2 线上 version 对了，但还是测试壳

优先排查：

1. 上传的其实是旧 APK
2. `build-release` 当时仍走了测试壳
3. `latest.json` 指向的 URL 不是刚构建的新包

### 6.3 用户说旧壳没自动更新

优先排查：

1. 新包 `versionCode` 是否真的更大
2. 旧设备当前已装版本码是多少
3. 用户要的是 OTA 还是 native 更新

不要把 `OTA` 和 `native` 混成一种更新。
