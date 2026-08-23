---
name: android-app-release
description: "BoardGame Android 打包、上传、发布和验包流程。用于 APK、原生更新、OTA/native、线上下载包、包体缩减和正式/测试版核验。"
---

# Android App 发布 Skill

## 触发

用户提到以下任一目标时使用本 skill：

- 打 APK / AAB、发布 native、发布 OTA。
- 更新网站下载 App 入口。
- “更新部署 / 部署最新 / 发线上”。
- 排查旧包、测试包、大包、旧壳不自动更新、OTA 无法读取。

先读：

- [mobile-release](../../../docs/mobile-release.md)
- [android-app-build](../../../docs/android-app-build.md)
- [deploy](../../../docs/deploy.md)
- [asset-pipeline](../../knowledge/standards/asset-pipeline.md)

## 目标裁决

先把用户目标拆成交付矩阵：`server / OTA / native APK / game package / device` 分别是否要做。没有这张矩阵，不开始发布。

默认口径：

- “更新网站下载的 App / 发原生更新”默认走 native 发布，不部署网站。
- “只改 H5 内容”走 OTA，不顺手 bump 原生版本。
- “改原生壳、插件、权限、系统栏、返回键、方向映射、网站下载 APK”走 native。
- “更新部署 / 部署最新 / 发线上”默认包含服务器生产部署 + Android stable OTA；除非用户明确排除 OTA。
- 真机安装只在用户明确要求设备验收时做；线上修复默认回到正式 OTA/native 发布链和线上回查。

## 硬规则

- 本地构建成功只证明本地产物 OK；目标包含上传、发包、下载入口或旧壳更新时，必须继续发布、回查线上 manifest、下载线上 APK 验包。
- 对外发布与用户明确要求的真机验收必须使用正式壳：`appId = top.easyboardgame.app`，`appName = 易桌游`。debug / qa / dev 壳都是失败产物，除非用户明确要求并存测试包。
- `latest.json` 只能证明入口指向；不能证明 APK 内部是正式壳。发布后必须下载 `latest.json.url` 指向的 APK 并检查 appId / appName。
- Android native 自动更新比较 `versionCode`；旧设备不会把更低 versionCode 当更新。展示版本和原生递增版本码必须分开处理。
- OTA 发布真相源必须是已推送 git ref；本地无关脏改不阻塞指定 ref 的 OTA，但不得混入本次发布。
- 服务器部署版本、OTA 包版本、商业产品版本和原生壳版本必须分开：服务器看 git ref / 镜像，OTA 在上传时生成或显式传版本，商业产品版本只在正式产品发布时调整，原生壳版本只在 native 发布时递增。
- Android 所有 OTA channel 必须 `forceUpdate: true`；`--no-force-update` 或等价关闭入口必须拒绝。
- OTA 清单读取失败不得静默当作“没有更新”；网络、CORS、超时、非 2xx、内容类型错误、JSON 解析失败都必须显式暴露。
- Docker 镜像构建、Android stable OTA、native workflow 和部署整步上限统一按 30 分钟处理；超时必须失败，不得后台假卡死。

## 包体边界

`public/assets/**` 只允许正式运行时资源。

Android embedded APK 可以保留经过白名单确认的最小首装/离线资源。OTA zip 不得复用 embedded 白名单，禁止进入 OTA：

- `public/assets/common/audio/**`
- `public/assets/common/images/**`
- `public/assets/atlas-configs/**`
- `public/assets/i18n/**` 下除 `assets-manifest.json` 外的图片、音频和运行时配置
- `public/logos/**`
- 参考图、预览图、生成图、中间产物

OTA 只允许 H5 代码、样式、`locales/zh-CN/**`、字体、必要小型公共文件和 `assets-manifest.json`。包体异常变大时，先查 `public/assets/**` 和 `dist/`，不要先猜 CDN、缓存或签名。

## 路径选择

### OTA

只改 H5 内容：

```bash
node scripts/mobile/release-android.mjs ota --channel stable
```

验收必须回查线上 OTA `latest.json`、bundle URL、checksum、size、notes 和 CORS 预检。

### Native

改原生壳、方向映射、插件、权限、系统栏、返回键、网站下载 APK 或需要用户安装新包：

```bash
node scripts/mobile/release-android.mjs native --channel stable
```

需要正式递增版本时：

```bash
node scripts/mobile/release-android.mjs native --channel stable --bump patch
```

发布后必须下载线上 APK 验证正式壳和目标原生内容。

### 本地构建

只想本地重打 APK、不上传：

```bash
npm run mobile:android:build:release
```

最终汇报必须明确“未上传，线上不变”。

## 横竖屏与方向映射

修改以下任一项属于 native 改动，只发 OTA 不会生效：

- `preferredOrientation`
- `scripts/game/generate_game_manifests.js` 的方向表生成规则
- `android/app/src/main/assets/game-orientation-map.json`
- `MainActivity` / `GameOrientationPolicy`

项目方向不变量：游戏默认强制横屏；未配置或非法方向回退横屏。只有 manifest / 方向映射明确登记为竖屏且通过验收的游戏，才允许 `portrait`。

若同轮还改 H5 样式/交互，同时发布 stable OTA 和 stable native。发布后直接检查线上 APK 内 `assets/game-orientation-map.json`，再回目标游戏真实 App 页面验证方向；源码或 OTA manifest 不能替代用户可见验收。

## “更新部署”组合发布

用户说“更新部署 / 部署最新 / 发线上”且未排除 OTA 时，按顺序收口：

1. 确认目标提交已推送到远端。
2. 等待 Docker 镜像流水线完成，确认 `web` 与 `game-server` 镜像可用。
3. 触发统一发布入口，让 CI 构建并把镜像 tar 直传生产机后执行服务器本地更新：`node scripts/release/deploy-and-ota.mjs --skip-wait`。若 OTA 单独触发，再加 `--skip-ota`。
4. 验证生产容器和健康接口。
5. 触发 Android stable OTA，使用本次已推送 ref；默认自动生成 OTA 包版本，需要显式商业产品版本时传 `--ota-extra "--product-version <version>"`。
6. 等 OTA workflow 成功。
7. 回查 OTA `latest.json`、bundle URL、checksum、size、notes 和 `OPTIONS` 预检。
8. 若交付矩阵包含 native 能力，再触发 native workflow 并下载线上 APK 验包。
9. 回到用户原始失败位点验收；横竖屏、权限或插件问题必须在真实 App 页面确认。

任一步失败，只能汇报该步骤真实阻塞；不得用前一步成功替代整条完成。

## OTA 清单验收

发布脚本和人工回查都必须覆盖：

- `GET latest.json` 返回新内容，且正文摘要能对上本次发布。
- bundle URL 可读，checksum 和 size 对上。
- `OPTIONS latest.json` 预检允许来源、允许 `GET`，并允许客户端会发送的请求头，例如 `cache-control`。

如果 `GET` 成功但 `OPTIONS` 失败，结论是“资源入口不支持旧壳读取更新清单”，不是“手机没有更新”。

## Native 本地验证

本地构建或 native 发布前至少检查：

- `android/app/build/outputs/apk/release/output-metadata.json`
- `android/app/src/main/res/values/strings.xml`
- `android/app/build.gradle`

确认：

- `applicationId = top.easyboardgame.app`
- `versionName / versionCode` 符合预期
- APK 大小没有异常暴涨

## Native 上传与线上验包

预演：

```bash
npm run mobile:android:native-update:publish -- --channel stable --dry-run
```

正式上传：

```bash
npm run mobile:android:native-update:publish -- --channel stable
```

只上传版本文件、不切 latest：

```bash
npm run mobile:android:native-update:publish -- --channel stable --skip-latest
```

线上回查：

- 读取 `https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json`
- 确认 `version / versionCode / url / checksum / size`
- 下载 `url` 指向的 APK
- 有 `aapt` / `apkanalyzer` 时优先用它们；没有时解包检查 `assets/capacitor.config.json` 和 `assets/public/android-build-meta.json`
- 确认 appId 不是 debug，appName 不是测试壳

## 真机验收

只有用户明确要求真机安装或设备实际效果时执行。

- 安装前用 `dumpsys package top.easyboardgame.app` 读取设备当前 `versionCode / versionName`。
- 线上已发布但设备仍是旧版本时，只能说“原生包已发布，设备尚未升级”。
- `adb install -r` 返回 `INSTALL_FAILED_ABORTED: User rejected permissions` 时，停止重复执行；这表示设备安装确认未完成，不是 APK 构建或发布失败。
- ADB 被拒后的回退：把已校验 checksum 的线上 APK 放入设备下载目录，通过系统 PackageInstaller 打开，等待用户解锁并确认，安装后再次读取 versionCode。
- 不修改设备安全设置、不静默授权、不绕过锁屏。
- 安装后回到原始失败位点；横竖屏问题至少确认目标游戏页面、设备 versionCode 和系统实际方向。

## 失败分类

本地成功，线上还是旧包：

- 未执行 publish。
- publish 使用了 `--skip-latest`。
- 线上 `latest.json` 仍指旧版本。
- CDN 未传播，但 APK URL 未变。

线上 version 对了，但还是测试壳：

- 上传的是旧 APK。
- build-release 仍走测试壳。
- `latest.json.url` 指向的不是刚构建的新包。

旧壳没自动更新：

- 新包 `versionCode` 不大于设备当前版本。
- 用户需要的是 OTA 还是 native 更新未分清。
- 历史错误高游标导致新包被判旧包时，必须发布高于历史值的 stable 桥接 OTA，并保持后续游标单调递增；当前 Android OTA 内部游标不得低于 `6.0.0`。

OTA latest.json 有内容但手机仍提示没有更新：

- 检查 `version / checksum / url` 是否是本次发布。
- 检查 `GET` 是否成功且正文是新内容。
- 检查 `OPTIONS` 预检是否允许 `GET` 和客户端请求头。
- 查看手机日志是“清单读取失败”还是“已读取但版本判断为不需要更新”。

## 最终汇报证据

说“Android 包已经更新 / 网站下载已可用 / 原生更新已发”时，必须给出：

- 本地产物路径。
- 线上 `latest.json` 的 `version / versionCode / url / size`。
- 线上 APK 正式壳验证结果。
- 若未部署网站，明确“本次未部署网站，只更新原生下载入口”。

说“更新部署已完成 / 发线上已完成”时，必须给出：

- 服务器部署提交或镜像来源。
- 生产容器状态与健康接口结果。
- Android OTA workflow 结果。
- Android OTA `latest.json` 的 `version / url / checksum / size / notes`。
- Android OTA `OPTIONS` 预检结果。
- 若用户排除 OTA，明确“本次按用户要求未发 Android OTA”。
