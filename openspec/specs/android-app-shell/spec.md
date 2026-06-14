# android-app-shell Specification

## Purpose
TBD - created by archiving change add-android-remote-webview-mode. Update Purpose after archive.
## Requirements
### Requirement: Android 壳必须支持显式加载模式

系统 SHALL 为 Android App 壳提供显式的 H5 加载模式配置，至少支持 `embedded` 与 `remote` 两种模式，并由单一配置源控制当前构建使用哪一种模式。

#### Scenario: 使用 embedded 模式构建 Android 壳
- **GIVEN** Android 壳配置为 `embedded`
- **WHEN** 开发者执行 Android 正式构建
- **THEN** 系统 MUST 让 WebView 加载 APK 内嵌的 H5 资源
- **AND** 不得要求开发者手动修改 Capacitor 原生配置文件来切换模式

#### Scenario: 使用 remote 模式构建 Android 壳
- **GIVEN** Android 壳配置为 `remote`
- **WHEN** 开发者执行 Android 正式构建
- **THEN** 系统 MUST 让 WebView 直接加载配置的远程 HTTPS H5 入口
- **AND** 不得再依赖 APK 内嵌资源作为当前版本页面来源

### Requirement: 不同加载模式必须应用不同的构建校验

系统 SHALL 根据 Android 壳的当前加载模式应用对应的构建前校验，而不是对所有模式统一要求内嵌资源同步。

#### Scenario: embedded 模式继续校验内嵌资源同步
- **GIVEN** Android 壳配置为 `embedded`
- **AND** `dist/android-build-meta.json` 与 `android/app/src/main/assets/public/android-build-meta.json` 不一致
- **WHEN** 开发者执行 Android 构建
- **THEN** 系统 MUST 阻止构建继续
- **AND** 错误信息 MUST 明确要求先同步 Android 内嵌 Web 资源

#### Scenario: remote 模式跳过内嵌资源同步校验
- **GIVEN** Android 壳配置为 `remote`
- **WHEN** 开发者执行 Android 构建
- **THEN** 系统 MUST 不以 `dist` 与 `assets/public` 是否同步作为构建前置条件
- **AND** 不得因为未执行 `mobile:android:sync` 而阻止构建

### Requirement: remote 模式必须显式依赖受支持的远程站点

系统 SHALL 要求 `remote` 模式显式提供一个受支持的远程 HTTPS 站点入口，并在配置缺失或非法时阻止构建。

#### Scenario: remote 模式缺少远程入口
- **GIVEN** Android 壳配置为 `remote`
- **AND** 未提供远程 H5 入口 URL
- **WHEN** 开发者执行 Android 构建
- **THEN** 系统 MUST 直接失败
- **AND** 错误信息 MUST 明确指出缺少远程入口配置

#### Scenario: remote 模式使用同一 H5 运行时
- **GIVEN** Android 壳配置为 `remote`
- **AND** 配置的远程入口是项目正式部署的 H5 站点
- **WHEN** 用户在浏览器与 Android App 中分别打开该站点
- **THEN** 两者 MUST 复用同一套前端代码与同一套游戏 UI
- **AND** 系统不得为 Android App 额外维护一套独立页面实现

### Requirement: Android 壳必须支持本地兼容性 smoke 测试
系统 SHALL 提供一条面向本地 AVD/adb 的 Android 兼容性 smoke 命令，使 AI 或开发者能够在低版本模拟器上自动完成 APK 安装、启动、截图、日志采集与 WebView 版本探测。

#### Scenario: 在本地模拟器上完成一次兼容性 smoke
- **GIVEN** 本地已安装 Android SDK，并存在可启动的 AVD 或已连接的 adb 设备
- **WHEN** 开发者执行 Android 本地兼容性 smoke 命令
- **THEN** 系统 MUST 自动完成设备选择或模拟器启动
- **AND** MUST 安装或复用指定 APK 并启动 Android App
- **AND** MUST 产出截图、UI dump、logcat 与结构化 summary

#### Scenario: 当前 WebView 版本低于兼容基线
- **GIVEN** smoke 命令检测到当前 WebView/Chrome 主版本低于要求的兼容基线
- **WHEN** 兼容性 smoke 结束
- **THEN** 系统 MUST 以失败状态退出
- **AND** 错误信息 MUST 明确指出实际版本与要求基线

#### Scenario: 应用界面疑似黑屏
- **GIVEN** smoke 命令抓取到的截图疑似纯黑，且 UI dump 中未检测到友好提示文案
- **WHEN** 兼容性 smoke 结束
- **THEN** 系统 MUST 以失败状态退出
- **AND** summary 中 MUST 标记为疑似黑屏

