## ADDED Requirements

### Requirement: 服务器活动集合必须由权威清单派生
系统 SHALL 使用官方 manifest/file-index 和显式排除规则生成服务器活动版本集合，不得默认把历史远程对象全集同步到生产机。

#### Scenario: 生成服务器活动版本集合
- **WHEN** 后台发布准备新的服务器素材 release
- **THEN** 系统 MUST 保留普通运行时素材
- **AND** MUST 从各平台当前 `latest.json`、游戏包指针和共享包指针递归解析仍被引用的应用更新、移动素材包和原生更新包
- **AND** MUST 排除未被当前清单引用的历史发布产物

#### Scenario: 普通素材清单展开
- **WHEN** 当前发布包含 `official/**/assets-manifest.json`
- **THEN** 系统 MUST 将该清单作为活动集合根
- **AND** MUST 按 `basePrefix + files 键 + variants 扩展名` 展开每个真实素材对象

#### Scenario: 移动文件索引展开
- **WHEN** 当前游戏包 manifest 引用一个 `file-index`
- **THEN** 系统 MUST 将每个安全的 `files[].path` 映射为 `official/<path>`
- **AND** 包含 `..`、绝对路径或协议前缀的路径 MUST NOT 进入活动集合

#### Scenario: 活动集合容量保护
- **WHEN** 新 release 的活动集合超过配置上限，或切换后服务器空闲空间会低于安全阈值
- **THEN** 系统 MUST 拒绝切换该 release
- **AND** 现有 current release MUST 继续可用

#### Scenario: 同步后校验失败
- **WHEN** 新 release 的路径、大小或哈希与目标清单不一致
- **THEN** 系统 MUST 拒绝把该 release 切换为 current
- **AND** 现有 current release MUST 继续可用

### Requirement: 官方素材发布必须写入服务器活动版本
系统 SHALL 将官方素材、manifest、file-index、OTA 包、原生更新包和移动素材包发布到服务器 staging，并在校验路径、大小和哈希后原子切换服务器活动版本。

#### Scenario: 协作者发布素材
- **WHEN** 协作者执行现有素材上传命令
- **THEN** 命令名 MUST 保持兼容
- **AND** 命令内部 MUST 写入服务器素材源
- **AND** MUST NOT 上传到对象存储作为发布成功前置条件

#### Scenario: 移动发布脚本发布对象
- **WHEN** OTA、原生更新或移动素材包脚本发布对象
- **THEN** 发布批次 MUST 只包含服务器发布所需字段
- **AND** MUST NOT 标记或生成对象存储灾备队列

#### Scenario: 清单公开回查
- **WHEN** 发布脚本写入 latest manifest 或 file-index
- **THEN** 系统 MUST 从公开域名读取本次清单正文
- **AND** MUST 校验正文大小和 SHA-256
- **AND** MUST NOT 使用旧清单或旧完整包可读作为发布成功证据

### Requirement: 服务器发布不得生成对象存储灾备队列
系统 SHALL NOT 在服务器发布完成后创建面向对象存储的后台备份队列。

#### Scenario: 发布清单应用完成
- **WHEN** 服务器应用发布清单并切换 `current`
- **THEN** 系统 MUST 输出服务器 release 结果
- **AND** MUST NOT 复制本批对象到对象存储 backup queue

#### Scenario: 服务器活动版本损坏
- **WHEN** 服务器素材目录损坏、缺失或被重新创建
- **THEN** 系统 MUST 通过上一个已验证 release 或重新执行服务器发布恢复
- **AND** MUST NOT 将对象存储历史副本当作自动重建来源

### Requirement: 历史远程对象清理必须独立审批
系统 SHALL NOT 将历史对象删除、隔离、容量门禁或恢复演练混入当前服务器发布链路。

#### Scenario: 需要删除历史对象
- **WHEN** 需要清理历史远程对象以释放空间或降低费用
- **THEN** 必须建立独立变更说明清理目标、保留范围、恢复窗口和验收方式
- **AND** MUST NOT 把清理成功作为 OTA、移动素材包或普通素材发布成功的前置条件
