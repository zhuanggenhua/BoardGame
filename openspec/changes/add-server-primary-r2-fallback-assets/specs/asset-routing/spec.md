## ADDED Requirements

### Requirement: 现有素材域名必须使用服务器唯一线上源
系统 SHALL 在不改变 `https://assets.easyboardgame.top/official` 公开资源基址的前提下，对全部正式素材、应用更新包、移动素材包和原生更新包只使用服务器活动版本。

#### Scenario: 服务器活动版本正常提供对象
- **WHEN** 客户端通过现有素材域名请求任意 `official/**` 正式对象
- **AND** 服务器活动版本返回成功响应
- **THEN** 系统 MUST 返回服务器对象
- **AND** MUST 通过诊断响应头标识服务器来源

#### Scenario: 服务器源不可用
- **WHEN** 服务器隐藏源连接失败、超时、返回 `404` 或返回 `5xx`
- **THEN** 系统 MUST 返回可观测错误
- **AND** MUST 通过诊断响应头标识服务器错误来源
- **AND** MUST NOT 读取对象存储同 key 对象作为自动回退

#### Scenario: 服务器流式响应中途失败
- **WHEN** 服务器响应字节已经提交给客户端后连接中断
- **THEN** 系统 MUST NOT 将同一次响应伪装为无损成功
- **AND** 客户端重试仍 MUST 命中服务器活动版本或显式错误

### Requirement: 大型发布路径必须由服务器唯一源提供
系统 SHALL 让 `/official/app-updates/**`、`/official/mobile-packages/**` 和 `/official/native-app-updates/**` 与普通素材一样只由服务器活动版本提供。

#### Scenario: Android OTA 或应用更新包下载
- **WHEN** 请求路径位于 `/official/app-updates/**`
- **THEN** 系统 MUST 从生产服务器活动版本返回对象
- **AND** MUST NOT 通过对象存储旁路返回旧对象

#### Scenario: 移动素材包下载
- **WHEN** 请求路径位于 `/official/mobile-packages/**`
- **THEN** 系统 MUST 从生产服务器活动版本返回对象
- **AND** MUST NOT 读取对象存储同 key 对象

#### Scenario: 原生应用更新包下载
- **WHEN** 请求路径位于 `/official/native-app-updates/**`
- **THEN** 系统 MUST 从生产服务器活动版本返回对象
- **AND** MUST NOT 读取对象存储同 key 对象

### Requirement: Worker 不得绑定对象存储
Cloudflare Worker 配置 SHALL NOT declare any object-storage bucket binding for the official asset router.

#### Scenario: Worker 部署配置
- **WHEN** 部署官方素材 Worker
- **THEN** Worker 配置 MUST NOT contain bucket binding entries for object storage
- **AND** Worker runtime MUST NOT reference object-storage bucket environment variables

### Requirement: 公开下载协议必须保持兼容
系统 SHALL 在服务器唯一源模式下保持 GET、HEAD、Range、条件请求、Content-Type、Cache-Control、Content-Length、ETag 和 CORS 响应兼容。

#### Scenario: Range 下载
- **WHEN** 客户端携带合法 Range 请求下载对象
- **THEN** 服务器来源 MUST 返回兼容的部分内容响应
- **AND** MUST 保持正确的范围、长度和 ETag 信息

#### Scenario: HEAD 和条件请求
- **WHEN** 客户端执行 HEAD 或携带 ETag 条件请求
- **THEN** 系统 MUST 返回与服务器活动对象一致的 metadata 或未修改响应
- **AND** MUST NOT 为了兼容下载协议读取对象存储副本

#### Scenario: CORS 预检
- **WHEN** 移动端对清单或发布对象发起 `OPTIONS` 预检
- **THEN** 系统 MUST 返回允许生产 Origin、请求方法和必要请求头的 CORS 响应
- **AND** 预检失败 MUST 被发布脚本视为发布不可用

### Requirement: 素材发布不得静默成功
系统 SHALL 保持现有素材、manifest、file-index 和移动发布命令名不变；命令内部通过受限 SSH 原子更新服务器活动版本，并在公开域名回查成功后才报告发布成功。

#### Scenario: 协作者发布素材
- **WHEN** 协作者执行现有素材上传或移动包发布命令
- **THEN** 系统 MUST 先在服务器 staging 校验路径、大小和哈希
- **AND** MUST 原子切换服务器活动版本
- **AND** 协作者 MUST 不需要直接登录服务器或修改上传命令
- **AND** 发布命令 MUST 在公开域名可读取当前对象后才报告成功

#### Scenario: 发布命令验证本次对象
- **WHEN** 服务器已经存在旧完整包、旧清单或同路径旧对象
- **THEN** 大型新产物 MUST 使用服务器来源头和本次预期大小完成验证
- **AND** 新 file-index 或 latest manifest MUST 使用服务器返回正文的大小和 SHA-256 完成验证
- **AND** 旧对象可读取 MUST NOT 被视为本次发布成功

### Requirement: 服务器素材分发必须设置业务保护上限
系统 SHALL 对服务器静态源设置固定连接、速率、CPU 和 IO 保护，使素材下载不会无界抢占游戏/API 服务资源。

#### Scenario: 素材并发达到上限
- **WHEN** 服务器静态素材连接达到配置上限
- **THEN** 服务器 MUST 拒绝或限速新增素材请求
- **AND** 拒绝或限速导致的不可用 MUST 作为服务器错误暴露
- **AND** MUST NOT 静默切换到对象存储回退

#### Scenario: 发布任务运行
- **WHEN** 服务器发布任务写入 staging 并切换 release
- **THEN** 发布任务 MUST 使用受限并发、带宽和较低 CPU/IO 优先级
- **AND** 发布失败 MUST NOT 覆盖或回滚当前已验证的服务器 release
