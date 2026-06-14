# Change: add-local-android-compat-smoke

## Why
目前 Android 兼容性排查主要依赖真机反馈和临时手工操作，AI 无法在本地低版本模拟器上自己完成一次完整的功能性 smoke 验证，也无法稳定产出截图、日志和 WebView 版本证据。

## What Changes
- 为 Android 本地壳增加一条可脚本化的兼容性 smoke 命令
- 允许在本地 AVD/adb 环境里自动完成安装 APK、启动 App、截图、日志采集与 WebView 版本探测
- 将低版本兼容门槛收敛为 WebView/Chrome 主版本 `>= 88`
- 补充使用文档与纯逻辑测试，避免命令行为回归

## Impact
- Affected specs: `android-app-shell`
- Affected code: `scripts/mobile/android.mjs`, `scripts/mobile/android-compat-smoke*.mjs`, `package.json`, `docs/android-app-build.md`
