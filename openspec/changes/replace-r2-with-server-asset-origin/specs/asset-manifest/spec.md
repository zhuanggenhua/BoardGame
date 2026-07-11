## ADDED Requirements

### Requirement: 官方素材发布必须写入服务器活动版本
系统 SHALL 将官方素材、manifest、file-index、OTA 包、原生更新包和移动素材包发布到服务器 staging，并在校验路径、大小和哈希后原子切换服务器活动版本。

#### Scenario: 协作者发布素材
- **WHEN** 协作者执行现有素材上传命令
- **THEN** 命令名 MUST 保持兼容
- **AND** 命令内部 MUST 写入服务器素材源
- **AND** MUST NOT 上传到 R2

#### Scenario: 移动发布脚本发布对象
- **WHEN** OTA、原生更新或移动素材包脚本发布对象
- **THEN** 发布批次 MUST 只包含服务器发布所需字段
- **AND** MUST NOT 标记或生成 R2 灾备队列

### Requirement: 服务器发布不得生成 R2 灾备队列
系统 SHALL NOT 在服务器发布完成后创建面向 R2 的后台备份队列。

#### Scenario: 发布清单应用完成
- **WHEN** 服务器应用发布清单并切换 `current`
- **THEN** 系统 MUST 输出服务器 release 结果
- **AND** MUST NOT 复制本批对象到 R2 backup queue
