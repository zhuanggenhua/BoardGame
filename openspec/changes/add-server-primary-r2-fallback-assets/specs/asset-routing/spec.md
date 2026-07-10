## ADDED Requirements

### Requirement: 现有素材域名必须支持服务器优先和 R2 同域回退
系统 SHALL 在不改变 `https://assets.easyboardgame.top/official` 公开资源基址的前提下，对普通运行时素材优先使用服务器镜像，并在服务器无法在响应提交前可靠提供对象时使用 R2 返回同一 key。

#### Scenario: 服务器镜像正常提供对象
- **WHEN** 客户端通过现有素材域名请求普通运行时对象
- **AND** 服务器镜像在超时前返回成功响应
- **THEN** 系统 MUST 返回服务器对象
- **AND** MUST 通过诊断响应头标识服务器来源

#### Scenario: 服务器连接或响应头超时
- **WHEN** 服务器隐藏源连接失败或未在配置的响应头等待时间内响应
- **THEN** 系统 MUST 使用 R2 Binding 请求同一对象 key
- **AND** 客户端 MUST 不需要切换域名或修改资源路径

#### Scenario: 服务器缺少或拒绝本次对象
- **WHEN** 服务器隐藏源返回 `404`、`408`、`429` 或 `5xx`
- **THEN** 系统 MUST 使用 R2 Binding 请求同一对象 key
- **AND** MUST 通过诊断响应头标识 R2 回退来源

#### Scenario: 服务器流式响应中途失败
- **WHEN** 服务器响应字节已经提交给客户端后连接中断
- **THEN** 系统 MUST NOT 将同一次响应伪装为已无损切换 R2
- **AND** MUST 保留 Range/ETag 合同，使客户端重试能够重新请求对象

### Requirement: 大型发布包必须绕过服务器素材镜像
系统 SHALL 让应用更新、移动素材包和原生更新包继续由 R2 提供，不请求生产服务器静态源。

#### Scenario: Android OTA 或应用更新包下载
- **WHEN** 请求路径位于 `/official/app-updates/**`
- **THEN** 系统 MUST 直接使用 R2
- **AND** MUST NOT 向生产服务器发起素材源请求

#### Scenario: 移动素材包下载
- **WHEN** 请求路径位于 `/official/mobile-packages/**`
- **THEN** 系统 MUST 直接使用 R2
- **AND** MUST NOT 向生产服务器发起素材源请求

#### Scenario: 原生应用更新包下载
- **WHEN** 请求路径位于 `/official/native-app-updates/**`
- **THEN** 系统 MUST 直接使用 R2
- **AND** MUST NOT 向生产服务器发起素材源请求

### Requirement: 回退链必须保持现有下载协议兼容
系统 SHALL 在服务器来源和 R2 来源之间保持 GET、HEAD、Range、条件请求、HTTP metadata、ETag、缓存和跨域响应兼容。

#### Scenario: Range 下载
- **WHEN** 客户端携带合法 Range 请求下载对象
- **THEN** 服务器来源或 R2 来源 MUST 返回兼容的部分内容响应
- **AND** MUST 保持正确的范围、长度和 ETag 信息

#### Scenario: HEAD 和条件请求
- **WHEN** 客户端执行 HEAD 或携带 ETag 条件请求
- **THEN** 系统 MUST 返回与实际对象一致的 metadata 或未修改响应
- **AND** MUST NOT 为了回退而下载并缓存完整响应体

### Requirement: 素材源不得影响现有协作者上传入口
系统 SHALL 保持现有 R2 上传、manifest、file-index 和移动发布命令为素材写入入口；服务器镜像只作为派生读取副本。

#### Scenario: 协作者发布素材
- **WHEN** 协作者执行现有素材上传或移动包发布命令
- **THEN** 系统 MUST 先完成 R2 零付费容量预检
- **AND** 正式对象 MUST 在容量允许时写入 R2 并完成现有校验
- **AND** 协作者 MUST 不需要直接登录服务器或修改上传命令

#### Scenario: R2 无法容纳本批对象
- **WHEN** 本批上传预计会使 R2 超过项目配置的零付费硬上限
- **AND** 没有足够的已隔离安全候选可清理
- **THEN** 系统 MUST 在写入第一个对象前拒绝发布
- **AND** MUST NOT 只更新服务器镜像形成缺少 R2 回退副本的半发布状态

#### Scenario: 服务器镜像丢失
- **WHEN** 服务器素材目录损坏、缺失或被重新创建
- **THEN** 系统 MUST 能从 R2 和权威 manifest/file-index 重建镜像
- **AND** MUST NOT 要求从服务器反向恢复 R2 真相源

### Requirement: 服务器素材分发必须设置业务保护上限
系统 SHALL 对服务器静态源和后台同步设置固定连接、速率、CPU 和 IO 保护，使素材下载不会无界抢占游戏/API 服务资源。

#### Scenario: 素材并发达到上限
- **WHEN** 服务器静态素材连接达到配置上限
- **THEN** 服务器 MUST 拒绝或限速新增素材请求
- **AND** Cloudflare 回退层 MUST 能将可重试请求卸载到 R2

#### Scenario: 后台同步运行
- **WHEN** 服务器从 R2 增量同步素材
- **THEN** 同步任务 MUST 使用受限并发、带宽和较低 CPU/IO 优先级
- **AND** MUST 不直接覆盖当前已验证的素材 release
