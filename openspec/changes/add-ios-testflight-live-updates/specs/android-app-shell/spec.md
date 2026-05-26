## MODIFIED Requirements

### Requirement: Android 壳必须支持显式加载模式

系统 SHALL 为 Android App 壳提供显式的 H5 加载模式配置，至少支持 `embedded` 与 `remote` 两种模式，并由单一配置源控制当前构建使用哪一种模式。新增 iOS App 壳或移动端共享抽象时，系统 MUST 保持 Android 现有加载模式配置、默认值和发布路径兼容。

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

#### Scenario: 新增 iOS 支持不改变 Android 壳默认行为
- **GIVEN** 仓库新增 iOS App 壳与移动端共享热更抽象
- **WHEN** 开发者继续执行现有 Android release、OTA 或 package 发布命令
- **THEN** Android MUST 继续读取既有 `ANDROID_*` 与 `VITE_ANDROID_*` 配置
- **AND** Android MUST 继续使用既有 Android artifact 路径
- **AND** Android 包名、签名、versionCode 和 native update 语义 MUST NOT 被 iOS 配置覆盖
