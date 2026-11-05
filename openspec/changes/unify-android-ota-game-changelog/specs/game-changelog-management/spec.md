## ADDED Requirements
### Requirement: 完整部署可选同步网页更新日志到 Android OTA
完整更新部署 MUST 在确认存在玩家可感知的游戏更新时，通过现有游戏更新日志系统发布玩家可见记录，并将同一记录的标题与正文写入 OTA manifest，供 Android 更新页展示。

#### Scenario: OTA 发布同步网页更新日志
- **WHEN** 完整更新部署审查发现有可公开的游戏改动，并提供对应的简洁日志内容
- **THEN** 发布流程 MUST 按受影响的 `gameId` 通过现有后台权限模型创建或复用更新日志
- **AND** OTA manifest 的 `notes` MUST 与对应更新日志标题、正文一致
- **AND** PC 网页与 Android 更新页 MUST 展示同一段玩家可见内容
- **AND** 文案 MUST 简洁并过滤测试、验证、规范、审计、提交门禁等内部内容

#### Scenario: 本次没有值得公开的内容
- **WHEN** 完整更新部署审查发现本次改动没有玩家可感知的游戏更新
- **THEN** 流程 MUST 跳过网页更新日志创建
- **AND** 完整部署写入 OTA manifest 的 `notes` MUST 留空
- **AND** MUST NOT 把测试、文档、规范或部署流水线改动写成玩家更新

#### Scenario: 更新日志写入失败
- **WHEN** 本机无法认证或无法写入现有更新日志 API
- **THEN** 完整部署流程 MUST 报告服务器部署已完成但 OTA 未启动
- **AND** MUST NOT 静默地只把一份不同的自动摘要发布到 Android

#### Scenario: 实施中游戏不进入玩家日志
- **WHEN** 所有受影响游戏均标记为实施中
- **THEN** 流程 MUST NOT 创建空白或内部内容的网页更新日志
