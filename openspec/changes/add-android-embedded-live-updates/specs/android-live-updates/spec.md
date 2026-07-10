## ADDED Requirements

### Requirement: Android embedded 模式必须支持 OTA 更新 H5 bundle

系统 SHALL 在 Android `embedded` 模式下支持下载并激活新的 H5 bundle，而不要求重新发布 APK/AAB。

#### Scenario: 客户端激活新的 H5 bundle
- **GIVEN** Android App 当前使用 `embedded` 模式
- **AND** 服务端存在一个与当前二进制兼容的新 bundle
- **WHEN** 客户端完成 bundle 下载与校验
- **THEN** 系统 MUST 将该 bundle 标记为可激活版本
- **AND** 后续启动 MUST 能加载该新 bundle，而不是继续停留在 APK 内置 bundle

### Requirement: OTA bundle 必须经过完整性与兼容性校验

系统 SHALL 在激活 OTA bundle 之前校验 bundle 完整性、来源可信性与二进制兼容性。

#### Scenario: 不兼容 bundle 被拒绝
- **GIVEN** 服务端发布了一个 `minBinaryVersion` 高于当前 App 二进制版本的 bundle
- **WHEN** 客户端检查更新
- **THEN** 系统 MUST 不激活该 bundle
- **AND** MUST 保持当前已激活 bundle 或 APK 内置 bundle 继续运行

#### Scenario: bundle 校验失败被拒绝
- **GIVEN** 客户端下载的 bundle hash 或签名校验失败
- **WHEN** 系统准备激活该 bundle
- **THEN** 系统 MUST 拒绝激活
- **AND** MUST 记录错误原因供排查

### Requirement: OTA 激活失败必须自动回滚

系统 SHALL 在新 bundle 激活后发生启动失败或健康检查失败时，自动回滚到上一个可用 bundle 或 APK 内置 bundle。

#### Scenario: 新 bundle 启动失败
- **GIVEN** 客户端已将新 bundle 标记为当前激活版本
- **AND** 新 bundle 在启动阶段触发致命错误或未通过健康检查
- **WHEN** App 下次尝试进入主站
- **THEN** 系统 MUST 自动回滚到上一个成功版本
- **AND** 不得让用户永久卡在白屏或崩溃循环中

### Requirement: OTA 只覆盖 Web 内容，不覆盖原生二进制变更

系统 SHALL 明确区分可通过 OTA 下发的 Web 内容与必须重新发包的原生侧变更。

#### Scenario: 原生改动仍要求重新发包
- **GIVEN** 某次更新包含原生插件、权限、Manifest 或原生代码改动
- **WHEN** 发布者尝试仅通过 OTA 发布该变更
- **THEN** 系统 MUST 将其视为不受支持的更新类型
- **AND** 发布规范 MUST 明确要求重新发 APK/AAB

### Requirement: OTA 发布流水线必须支持自动化与正式门禁

系统 SHALL 提供自动化 Android 发布流水线，使主线 push 可以直接产出正式版本，同时保留按 channel 手动发布 OTA 的能力。

#### Scenario: main push 自动发布正式版本
- **GIVEN** 仓库已配置 Android 自动发布工作流
- **AND** 开发者向 `main` 分支合入会影响 Android H5 bundle 的改动
- **WHEN** GitHub Actions 自动执行 Android 发版
- **THEN** 系统 MUST 发布 `stable` OTA 与 `stable` native update
- **AND** 发布成功后 MUST 自动把仓库版本号 bump 到下一个 patch 版本
- **AND** 版本回写提交 MUST 带显式跳过标记，避免触发无限发版循环

#### Scenario: 手动 OTA 仍可独立选择 channel
- **GIVEN** 发布者要把 Android OTA 发布到 `stable`
- **WHEN** 发布者触发正式 OTA 工作流
- **THEN** 系统 MUST 要求显式指定正式 channel
- **AND** MUST 支持 `stable` / `gray` / `edge` 等 channel 的单独预演或发布

### Requirement: 所有 Android OTA 必须强制应用

系统 SHALL 将所有 Android OTA 视为强制更新；所有 channel 的 manifest MUST 写入 `forceUpdate = true`，发布入口 MUST NOT 生成非强制 OTA。

#### Scenario: 任意 channel 发布 OTA
- **GIVEN** 发布者选择 `stable`、`gray`、`edge` 或后续新增 channel
- **WHEN** 系统生成 OTA manifest
- **THEN** manifest MUST 包含 `forceUpdate = true`
- **AND** MUST 包含非空的 `forceUpdateTitle` 与 `forceUpdateMessage`

#### Scenario: 自动启动检查发现新 OTA
- **GIVEN** Android 客户端启动检查发现一个版本高于当前 bundle 的 OTA
- **WHEN** 客户端开始处理该更新
- **THEN** 系统 MUST 显示全屏阻塞式更新页
- **AND** MUST 显示下载或切换进度
- **AND** 下载完成后 MUST 立即切换到新 bundle，而不是后台排队

#### Scenario: 发布者尝试关闭强制更新
- **GIVEN** 发布者传入 `--no-force-update`、`forceUpdate=false` 或等价配置
- **WHEN** 发布入口处理该请求
- **THEN** 系统 MUST 拒绝该发布或固定改写为强制更新
- **AND** MUST NOT 产出 `forceUpdate` 缺失或为 `false` 的可发布 manifest

### Requirement: Android OTA bundle 必须排除服务器运行时资源

系统 SHALL 为 OTA 使用独立于 embedded APK 的文件分类规则，只携带 Web 本体与资源清单，不重复携带服务器资源主源或移动游戏包提供的嵌套运行时资源。

#### Scenario: dist 同时包含 Web 代码和游戏资源
- **GIVEN** `dist/` 包含 Vite 根级 JS/CSS、中文语言包、字体、`assets-manifest.json` 和嵌套游戏资源
- **WHEN** 系统生成 OTA zip
- **THEN** 系统 MUST 保留 Web 代码、中文语言包、字体和资源清单
- **AND** MUST 排除 `assets/atlas-configs/**`、`assets/common/**`、`assets/i18n/**`、`logos/**` 下除资源清单外的文件
- **AND** MUST 输出排除文件数量与字节数供发布审计
