## ADDED Requirements
### Requirement: R2 发布闭环（官方资源）
系统 SHALL 将“资源构建/准备 → 生成 manifest → 校验 → 上传到 R2 → 公开 URL 回查”作为官方资源发布闭环。

#### Scenario: 上传前校验保留集合
- **WHEN** 发布官方素材、manifest、file-index、OTA 包、原生更新包或移动素材包
- **THEN** 系统 MUST 在上传前生成本次发布保留集合
- **AND** MUST 校验路径、大小和 SHA-256
- **AND** 校验失败 MUST 阻止上传或切换公开链路

#### Scenario: 上传后公开回查
- **WHEN** 对象已经上传到 R2
- **THEN** 发布脚本 MUST 通过 `https://assets.easyboardgame.top/official/**` 读取本次对象
- **AND** MUST 校验公开响应的大小和 SHA-256
- **AND** 旧服务器对象可读 MUST NOT 被视为发布成功

### Requirement: 历史对象清理前置盘点
系统 SHALL 在删除 R2 或服务器上的历史素材对象前，先生成当前仍被引用的保留集合和删除候选清单。

#### Scenario: 删除候选 dry-run
- **WHEN** 运维执行素材清理
- **THEN** 系统 MUST 先输出 dry-run 清单
- **AND** 清单 MUST 区分当前 manifest、latest 指针、移动包 file-index、原生更新包和应急保留对象
- **AND** 未出现在删除候选清单中的对象 MUST NOT 被删除

#### Scenario: 引用对象不得删除
- **WHEN** 对象仍被任一当前 manifest、latest 指针或移动包 file-index 引用
- **THEN** 清理流程 MUST 保留该对象
- **AND** MUST NOT 因为对象较旧、路径相似或服务器空间紧张而删除

### Requirement: 服务器素材目录清理保护
系统 SHALL 将服务器素材清理与 Docker、数据库、Redis、训练数据清理分开执行，并且只删除已证明不被当前服务引用的对象。

#### Scenario: 服务器素材目录清理
- **WHEN** 清理 `/home/admin/storage/assets` 或等价服务器素材目录
- **THEN** 系统 MUST 先确认公开链路已由 R2 主源承接
- **AND** MUST 保留任何仍用于应急回滚的 release
- **AND** MUST NOT 删除 MongoDB、Redis、训练数据或仍被容器挂载的 Docker volume
