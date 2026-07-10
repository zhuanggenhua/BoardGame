---
name: android-app-release
description: "本项目 Android App 打包/上传/发布/验包 workflow。用于用户要求“打 app 包”“发安卓包”“上传 APK”“发布原生更新”“更新网站下载的 app”“检查下载到的是正式版还是测试版”“缩 Android 包体”“发 OTA / 发 native”，以及在本项目里说“更新部署 / 部署最新 / 发线上”时。核心目标是把 Android 发布固定成：选对发布类型 -> 正式壳构建或 OTA 发布 -> 上传正确入口 -> 回查 latest.json -> 验证线上产物，不允许停留在本地构建成功、服务器部署成功或只看 manifest。"
---

# Android App 发布 Skill

## 0. 什么时候用

命中以下任一场景就用本 skill：

- 打 Android APK / AAB
- 上传或发布 Android 原生更新
- 发布 Android OTA
- 用户说“更新部署 / 部署最新 / 发线上”
- 更新网站“下载 App”入口
- 排查“为什么用户下载到的还是旧包 / 测试包 / 大包”
- 排查“为什么旧壳没有自动更新”

## 1. 先读权威来源

- [docs/mobile-release.md](/abs/path/D:/gongzuo/webgame/BoardGame/docs/mobile-release.md)
- [docs/android-app-build.md](/abs/path/D:/gongzuo/webgame/BoardGame/docs/android-app-build.md)
- [docs/deploy.md](/abs/path/D:/gongzuo/webgame/BoardGame/docs/deploy.md)
- [docs/ai-rules/asset-pipeline.md](/abs/path/D:/gongzuo/webgame/BoardGame/docs/ai-rules/asset-pipeline.md)

如果用户只要“更新网站下载的 App / 发原生更新”，默认**不用部署网站**；优先走原生发布链路，不要误升级成服务器部署。

如果用户在本项目里说“更新部署 / 部署最新 / 发线上”，默认不是只部署网页/服务器，而是：

1. 先按生产部署入口更新服务器 `latest`
2. 再发布 Android `stable` OTA
3. 最后同时回查服务器健康状态与 Android OTA `latest.json`

只有用户当轮明确说“只更新服务器 / 不发 OTA / 不更新 App”，才允许缩小为只做服务器部署。

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

### 2.6 Android embedded 与 OTA 必须分别控制包体

- `public/assets/**` 只允许正式运行时资源。
- Android embedded APK 可以为首装和离线兜底保留经过明确白名单确认的最小资源。
- Android OTA 不得复用 embedded 白名单；以下内容禁止进入 OTA zip：
  - `public/assets/common/audio/**`
  - `public/assets/common/images/**`
  - `public/assets/atlas-configs/**`
  - `public/assets/i18n/**` 下除 `assets-manifest.json` 外的图片、音频和运行时配置
  - `public/logos/**`
  - 参考图、预览图、生成图、中间产物
- OTA 只允许 H5 代码、样式、`locales/zh-CN/**`、字体、必要的小型公共文件和 `assets-manifest.json`。
- 一旦包体异常变大，先查 `public/assets/**` 和 `dist/`，不要先猜 CDN、缓存或签名。

### 2.7 用户说“上传 / 发原生更新 / 改网站下载 app”时，默认自动做完

- 除非用户明确说“先别上传 / 只本地打包”，否则不能等用户再催一次“上传”。
- 完整收口默认到“线上可下载并已验包”为止。

### 2.8 用户说“更新部署 / 部署最新 / 发线上”时默认包含 OTA

- 在本项目语境里，“更新部署 / 部署最新 / 发线上”默认表示**网页/服务端生产部署 + Android stable OTA 发布**，不是二选一。
- 服务器部署完成但 Android OTA 没发，不能汇报为“更新部署已完成”；只能说“服务器已部署，OTA 尚未发布”。
- 发布 OTA 的真相源必须是已推送的 git ref。若本地存在无关未提交改动，按 `4.1.1` 处理，不得把它们混进 OTA，也不得因此漏发 OTA。
- OTA 发布后必须回查 `https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json`，确认 `version / url / checksum / size / notes` 指向本次已推送 ref。
- 如用户明确要求“不发 OTA / 只更新服务器”，最终汇报必须点明“本次未发布 Android OTA”。

### 2.9 所有 OTA 必须强制更新

- Android 所有 channel 的 OTA manifest 必须写入 `forceUpdate: true`。
- 发布脚本、统一发布入口、后台发布页、服务端接口和 GitHub Actions 都不得提供有效的关闭入口。
- `--no-force-update` 或等价的 `forceUpdate=false` 必须被拒绝；不能静默发布成后台 OTA。
- 客户端启动检查遇到强制 OTA 时，必须显示阻塞式更新界面，下载完成后立即切换 bundle。
- `--force-update` 只作为旧命令兼容参数保留；不传也必须强制更新。
- 发布后健康检查必须区分“服务器传播尚未完成”和“程序参数无效”。URL 类型错误、`Invalid URL`、`[object Object]` 等参数错误必须首轮立即失败，禁止套用最长 3 小时的传播等待反复重试。

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

### 3.3 改了游戏横竖屏或原生方向映射

- 修改下列任一项都属于 **native 改动**，只发 OTA 不会生效：
  - `preferredOrientation`
  - `scripts/game/generate_game_manifests.js` 的方向表生成规则
  - `android/app/src/main/assets/game-orientation-map.json`
  - `MainActivity` / `GameOrientationPolicy`
- 本项目方向不变量是：**除井字棋外，所有游戏默认强制横屏**；未配置或非法方向也必须回退到横屏，只有 `tictactoe` 允许显式 `portrait`。
- 如果同一轮还修改了 H5 样式/交互，必须同时发布：
  1. stable OTA，交付最新 H5；
  2. stable native APK，交付最新方向映射和原生锁屏逻辑。
- 判断是否需要 native 不能只看“本轮有没有修改 Android 文件”。只要用户验收目标涉及横竖屏，就必须下载线上 stable APK，对比其中的 `assets/game-orientation-map.json` 和目标提交的原生方向策略；线上 APK 缺少目标游戏、仍使用旧的缺省方向，或版本早于目标策略时，native 发布仍是必需交付。
- 发布后必须直接检查线上 APK 内的 `assets/game-orientation-map.json`，确认目标游戏为 `landscape`，不能只看源码或 OTA `latest.json`。
- 横竖屏问题的最终验收位点是更新后的真实 App 页面；workflow、manifest 和 APK 内容只能证明交付条件成立，不能替代“目标游戏实际横屏”的用户可见验收。

### 3.4 只想本地重打 APK，不上传

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
- 是否改了游戏方向；若改了，必须按 native 处理，不能只发 OTA
- 用户点名的每个现实结果分别由 `server / OTA / game package / native` 哪一层交付；没有完成这张交付矩阵前，不得开始发布。
- 即使本轮没有新增原生 diff，也必须检查线上 APK 是否落后于目标提交已有的原生能力；“源码里已经有”不等于“用户手机里的壳已经有”。

如果用户说“不要部署，只更新网站下载的 app”，默认是 **native publish，不是 deploy**。

### 4.1.1 OTA 不被无关本地脏改阻塞

- 发布 OTA 的真相源是**已推送的 git ref**。只要目标提交已经在 `origin/main`、tag 或用户指定的远端 ref 上，且发布命令显式指定 `git_ref` / `--ref`，本地工作区存在无关未提交改动时，不得因此阻塞 OTA 发布。
- 只有当未提交改动本身就是本次要发布的 H5 内容、会改变 OTA bundle、或会改变发布配置/版本参数时，才需要先提交并推送后再发 OTA。
- 如果本地存在无关脏改，发布前只需说明“本次 OTA 使用已推送 ref，以下本地改动不包含在本次发布内”，然后继续触发 workflow 或发布脚本。
- 发布后仍必须回查线上 `app-updates/android/<channel>/latest.json`，确认 `notes`、`version` 或 bundle URL 能对应本次已推送 ref；不能只看 workflow 成功。

### 4.1.2 “更新部署”组合发布顺序

用户说“更新部署 / 部署最新 / 发线上”且未排除 OTA 时，按以下顺序收口：

1. 确认目标提交已推送到远端，例如 `origin/main` 的最新提交或用户指定 ref。
2. 等待 Docker 镜像流水线完成，确认 `web` 与 `game-server` 镜像已可用。
3. 在生产机执行服务器更新：`bash scripts/deploy/deploy-image.sh update`。
4. 验证生产容器与健康接口，例如 `bash scripts/deploy/deploy-image.sh status` 和 `curl http://127.0.0.1/health`。
5. 触发 Android OTA workflow：`.github/workflows/android-ota-publish.yml`，`channel=stable`，`git_ref=<本次已推送提交>`，`expected_base_version=<package.json.version>`。
6. 等待 OTA workflow 成功。
7. 回查 Android OTA `latest.json` 与 bundle URL，确认它们对应本次提交。
8. 若交付矩阵包含方向映射、原生权限、插件、系统栏、返回键或其它 native 能力，触发 `.github/workflows/android-native-update-publish.yml`，并直接下载线上 APK 验证目标原生内容。
9. 回到用户原始失败位点做真实验收；例如横竖屏问题必须确认更新后的目标游戏实际进入横屏，不能以 OTA/APK 发布成功代替。

任一步失败时，只能汇报该步骤的真实阻塞；不得用前一步成功替代整条“更新部署”完成。

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

只要对外说“更新部署已完成 / 发线上已完成”，必须同时给出：

- 服务器部署提交或镜像来源
- 生产容器状态与健康接口结果
- Android OTA workflow 结果
- Android OTA `latest.json` 的 `version / url / checksum / size / notes`
- 如果用户明确排除了 OTA，要写明“本次按用户要求未发 Android OTA”

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
