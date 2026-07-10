## ADDED Requirements

### Requirement: 服务器镜像集合必须由权威清单派生
系统 SHALL 使用官方 manifest/file-index 和显式排除规则生成服务器活动版本集合，不得默认把 R2 `official/` 全量同步到生产机。

#### Scenario: 生成服务器活动版本集合
- **WHEN** 后台同步准备新的服务器素材 release
- **THEN** 系统 MUST 保留普通运行时素材
- **AND** MUST 从各平台当前 `latest.json`、游戏包指针和共享包指针递归解析仍被引用的应用更新、移动素材包和原生更新包
- **AND** MUST 排除未被当前清单引用的历史发布产物

#### Scenario: 同步后校验失败
- **WHEN** 新 release 的路径、大小或哈希与目标清单不一致
- **THEN** 系统 MUST 拒绝把该 release 切换为 current
- **AND** 现有 current release MUST 继续可用

### Requirement: R2 历史对象删除必须具备可验证恢复路径
系统 SHALL 在删除 R2 历史对象前生成完整保留/删除清单、归档候选对象并完成恢复演练。

#### Scenario: 对象仍被当前或回退版本引用
- **WHEN** 对象被当前 manifest/file-index、保留版本、full fallback、OTA 桥接版本或保护清单引用
- **THEN** 系统 MUST 将对象标记为保留
- **AND** MUST NOT 将其加入删除候选

#### Scenario: 删除候选进入隔离
- **WHEN** 对象超过保留时间且未被任何保留集合引用
- **THEN** 系统 MUST 记录 key、size、hash/etag、时间和删除理由
- **AND** MUST 在从 R2 删除前将对象归档到服务器隔离目录并校验

#### Scenario: 隔离容量或校验不满足
- **WHEN** 隔离归档会让服务器磁盘低于安全空闲比例或对象校验失败
- **THEN** 系统 MUST 停止本批删除
- **AND** MUST 保持 R2 对象不变

#### Scenario: 删除后需要回滚
- **WHEN** 隔离期内发现旧客户端、回退版本或发布流程仍需要已删除对象
- **THEN** 系统 MUST 能按原 key 和 metadata 从隔离副本恢复对象
- **AND** 恢复后 MUST 校验远端对象哈希

### Requirement: R2 灾备必须执行零付费容量门禁
系统 SHALL 在后台灾备前计算 R2 当前用量和本批净增量，并将预计用量限制在项目配置的硬上限以下，但该门禁不得阻塞服务器正式发布。

#### Scenario: 本批灾备在容量预算内
- **WHEN** 当前用量加本批净增量不超过 9GiB
- **THEN** 系统 MAY 上传灾备队列并完成校验
- **AND** MUST 在完成后记录新的对象数量和总字节数

#### Scenario: 可通过安全清理释放空间
- **WHEN** 本批灾备预计超过 9GiB
- **AND** 已存在完成引用核对、隔离和恢复演练的删除候选
- **THEN** 系统 MUST 只清理该候选集合
- **AND** MUST 重新计算容量后再决定是否允许灾备

#### Scenario: 清理后仍然超限
- **WHEN** 安全清理后预计用量仍超过 9GiB
- **THEN** 系统 MUST 保留服务器灾备队列并暂停本批 R2 上传
- **AND** MUST 输出当前用量、本批净增量、缺少空间和不可删除原因
- **AND** MUST NOT 回滚或阻止已经完成的服务器正式发布
