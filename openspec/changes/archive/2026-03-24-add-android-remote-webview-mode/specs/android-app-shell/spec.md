## ADDED Requirements

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
