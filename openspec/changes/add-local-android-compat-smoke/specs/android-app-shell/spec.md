## ADDED Requirements
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
