# Android 0.5.1 回退调查与修复记录（2026-04-04）

## 背景

- 用户反馈：已经发出去的 Android 包在更新后出现“像回退到 0.5.0”的现象。
- 本轮目标不是掩盖，而是确认真实根因、修复线上链路、重新确认生产包。

## 本轮确认的事实

### 1. 当前生产 APK 本体是 0.5.1

- 本地 release 产物：
  - `android/app/build/outputs/apk/release/easyboardgame-release.apk`
- `aapt dump badging` 结果：
  - `versionCode='501'`
  - `versionName='0.5.1'`
- `output-metadata.json` 结果：
  - `versionCode: 501`
  - `versionName: 0.5.1`

结论：
- 当前重新打出的生产 APK 本体不是 0.5.0，而是真正的 `0.5.1`。

### 2. 当前 Android 构建产物内置的 embedded H5 也是 0.5.1

- `dist/android-build-meta.json`
  - `mode: "android"`
  - `builtAt: "2026-04-04T03:27:09.292Z"`
- `dist/assets/Home-D26lYqPh.js`
  - 可直接搜到 `version:"0.5.1"`
- `android/app/src/main/assets/public/assets/Home-D26lYqPh.js`
  - 同样可直接搜到 `version:"0.5.1"`

结论：
- 当前 release APK 的壳内 embedded bundle 也不是旧的 `0.5.0`。

### 3. 首页版本显示曾经存在误导性问题

- 首页原先把 `package.json.version` 同时拿去表示当前 H5 bundle 与 App 壳版本。
- 这会在旧 OTA bundle 运行时，把“App 壳版本”也显示成旧值，制造“整个 App 回退”的错觉。
- 当前仓库里的 `src/pages/Home.tsx` 已经显示：
  - `Bundle ...`
  - `App ...`
  - `Latest ...`
  - 若不一致显示 `OTA 未对齐`

结论：
- 用户看到“像整个 App 都回退”的一部分原因，确实可能来自首页显示口径不正确。
- 但这不是本轮唯一问题，也不能拿它掩盖线上更新链路问题。

### 4. 本轮已重新发布 stable OTA latest

2026-04-04 本轮修复后，直连线上得到：

```json
{
  "version": "0.5.1-ota-2026-04-04T03-34-46-472Z",
  "url": "https://assets.easyboardgame.top/official/app-updates/android/stable/bundles/0.5.1-ota-2026-04-04T03-34-46-472Z.zip",
  "channel": "stable",
  "forceUpdate": true,
  "publishedAt": "2026-04-04T03:34:47.088Z"
}
```

结论：
- stable OTA 最新指针现在已经被纠正到 `0.5.1` bundle。
- 之后启动 App 时，不应再被 stable OTA 拉回旧 H5。

### 5. 本轮已补发 stable 原生更新 latest

修复前，本轮直连 `native-app-updates/android/stable/latest.json` 返回 `404`。

本轮补发后，直连线上得到：

```json
{
  "version": "0.5.1",
  "versionCode": 501,
  "url": "https://assets.easyboardgame.top/official/native-app-updates/android/stable/packages/0.5.1.apk",
  "channel": "stable",
  "publishedAt": "2026-04-04T03:35:57.946Z"
}
```

说明：
- 这次发布使用了**非强制原生更新**口径。
- 目标是让原生包更新继续可用，但不在启动时直接把用户整页拦住。

## 本轮执行的修复动作

### 已完成

1. 重新确认并保留生产构建配置：
   - Android native update 指向 stable 生产地址
   - Android OTA 指向 stable 生产地址
   - OTA 开关保持开启
2. 重新构建 release APK：
   - 结果为 `0.5.1 / 501`
3. 重新发布 stable OTA latest：
   - 指向新的 `0.5.1-ota-2026-04-04T03-34-46-472Z`
4. 补发 stable 原生更新 latest：
   - 指向 `0.5.1.apk`

### 当前生产产物

- APK：
  - `android/app/build/outputs/apk/release/easyboardgame-release.apk`
- OTA latest：
  - `https://assets.easyboardgame.top/official/app-updates/android/stable/latest.json`
- Native latest：
  - `https://assets.easyboardgame.top/official/native-app-updates/android/stable/latest.json`

## 关于“测试包能不能直接热更成生产包”

结论：
- **不要把 smoke/测试态包当成生产基线。**

原因：
- smoke/测试包如果编译时关闭了 OTA，或 manifest 指到了本地地址，例如 `127.0.0.1`，那它天然就不是稳定生产壳。
- H5 bundle 理论上可以被 OTA 拉到新的生产 bundle，但前提是这个包本身：
  - OTA 开关是开的
  - manifest 指向的是生产 stable
  - 原生壳能力与当前 H5 兼容

最稳口径：
- 已经发给群友的版本，如果来源不确定，最稳的是直接覆盖安装当前 `0.5.1` 生产 APK。
- 后续 H5 小改动再走 OTA。

## 本轮未完成的验证

### 1. 本轮没有完成真机安装回归

原因不是主观跳过，而是当前连接到 `adb` 的对象不是 Android 手机：

- `adb devices`
  - `1234567890ABCDEF device`
- `adb shell uname -a`
  - `Linux DEMO 3.4.110-rt140 #2 PREEMPT RT armv7l GNU/Linux`

这台设备缺少 Android 常规命令：

- `getprop` 不存在
- `pm` 不存在
- `cmd` 不存在

结论：
- 它不是可用于安装 APK / 抓 Android WebView 证据的目标设备。

### 2. 本轮 AVD 自测也未成功拉起

尝试过：

- `BG_API31_HuaweiLike`
- `BG_API24_Compat`

结果都是：

- `启动模拟器后超时，未发现可用设备 emulator-5560`

结论：
- 本轮没有拿到“当前 0.5.1 release + 当前 stable latest”组合下的新截图证据。
- 线上 manifest 与 release 包已修正，但最终设备端截图验证需要在真正的 Android 设备或可正常启动的 AVD 上补做。

## 当前结论

- 当前重新打出的生产 APK 是正确的 `0.5.1`。
- 当前 stable OTA latest 已经被纠正到新的 `0.5.1` bundle。
- 当前 stable 原生更新 latest 已经补发到 `0.5.1.apk`。
- “更新后像回退”的问题里，至少包含两层因素：
  - 首页版本显示口径曾经误导
  - stable 更新指针必须保证始终对齐当前生产发布

如果后续再出现“更新后回到旧首页”，优先检查：

1. `official/app-updates/android/stable/latest.json` 是否仍指向最新生产 bundle
2. 当前设备运行时首页是否出现 `OTA 未对齐`
3. 当前设备实际 nativeVersion / currentBundleVersion / manifestVersion 分别是什么
