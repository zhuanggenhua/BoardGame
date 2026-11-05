## ADDED Requirements
### Requirement: Access/Refresh Token 签发
系统 SHALL 在注册/登录成功后返回短期 Access Token，并通过 httpOnly Cookie 下发 Refresh Token。

#### Scenario: 登录成功签发双令牌
- **WHEN** 用户提交有效账号密码并登录成功
- **THEN** 响应体包含 Access Token 与用户信息
- **AND** 响应头下发 Refresh Token Cookie

#### Scenario: 注册成功签发双令牌
- **WHEN** 用户注册成功
- **THEN** 响应体包含 Access Token 与用户信息
- **AND** 响应头下发 Refresh Token Cookie

### Requirement: Refresh Token 续签
系统 SHALL 提供 `/auth/refresh` 接口，用 Refresh Token 换取新的 Access Token，并进行 Refresh 轮换。

#### Scenario: Refresh 成功续签
- **WHEN** 客户端携带有效 Refresh Token 调用 `/auth/refresh`
- **THEN** 服务端返回新的 Access Token
- **AND** 下发新的 Refresh Token Cookie

#### Scenario: Refresh 复用被拒绝
- **WHEN** 客户端使用已轮换失效的 Refresh Token 调用 `/auth/refresh`
- **THEN** 服务端在并发宽限期外拒绝该旧凭证且不清理可能已更新的 Cookie
- **AND** 不撤销该用户其它设备的 Refresh 会话

### Requirement: Refresh Token 撤销
系统 SHALL 支持仅凭当前设备 Refresh Cookie 执行登出并撤销该会话；有效 Access Token 如有提供也加入黑名单，不得要求仍有效的 Access Token 才能撤销 Refresh 会话。

#### Scenario: 登出撤销 Refresh
- **WHEN** 用户调用 `/auth/logout`
- **THEN** 服务端撤销当前 Refresh Token
- **AND** 后续 refresh 请求被拒绝

### Requirement: 持久化的多设备登录会话
系统 SHALL 将活跃 Refresh 会话的哈希和状态持久保存于 MongoDB，不得依赖进程内存或有 TTL 的通用缓存作为会话真相源。每次注册或登录 MUST 创建与该客户端独立的会话；同一账号的其它设备会话不得因本次登录而被撤销。

#### Scenario: 新设备登录保留其它设备
- **GIVEN** 同一账号已有一个或多个有效设备会话
- **WHEN** 用户在新的浏览器或设备成功登录
- **THEN** 系统创建独立的 Refresh 会话
- **AND** 已有设备会话仍可续签

#### Scenario: API 重启后已有会话仍可续签
- **GIVEN** 有效 Refresh 会话已写入 MongoDB
- **WHEN** API 进程重启或通用缓存被清空
- **THEN** 客户端仍可使用该 Refresh Cookie 续签

### Requirement: 无固定服务端寿命的活跃会话
系统 SHALL 不因固定的绝对服务端 TTL 自动撤销 Refresh 会话；Cookie 与 Mongo 会话闲置期限均 MUST 在成功续签时滚动延长，期限为 400 天。连续 400 天无续签的会话可过期清理。用户退出、改密、重置密码或明确安全撤销不受此规则限制。该要求不承诺浏览器永不删除 Cookie 或站点数据。

#### Scenario: 持续使用的会话滚动续期
- **GIVEN** 客户端持有有效 Refresh Cookie，且服务端会话未撤销
- **WHEN** 客户端成功调用 `/auth/refresh`
- **THEN** 系统签发新的 Access Token 和 Refresh Cookie
- **AND** Refresh 会话不因固定绝对服务端期限而失效

#### Scenario: 客户端清除 Cookie 后不伪称永久登录
- **GIVEN** 浏览器清除了 Refresh Cookie 或站点数据
- **WHEN** 客户端无法携带有效 Refresh 凭证续签
- **THEN** 系统要求用户重新登录
- **AND** 文档不得承诺客户端存储永不丢失

### Requirement: 会话级并发轮换与撤销
系统 SHALL 原子地轮换和撤销单个 Refresh 会话。正常并发刷新或旧会话令牌重放 MUST NOT 因单一会话异常而撤销该账号的其它设备会话。

#### Scenario: 同一浏览器多个标签页并发刷新
- **GIVEN** 同一浏览器的多个标签页同时需要刷新共享的 Refresh Cookie
- **WHEN** 刷新请求发生并发或轮换响应交错
- **THEN** 客户端通过浏览器锁协调刷新，或服务端对相同旧凭证生成同一个下一代 Refresh Token
- **AND** 迟到响应不得把 Cookie 回滚到旧凭证
- **AND** 正常竞态不会撤销该账号的其它会话

#### Scenario: 单设备检测到已撤销或重放令牌
- **GIVEN** 某设备会话的 Refresh Token 已轮换或撤销
- **WHEN** 客户端再次提交该旧令牌
- **THEN** 服务端拒绝该请求并按会话范围处置
- **AND** 其它有效设备会话继续有效

#### Scenario: 当前设备退出不影响其它设备
- **GIVEN** 账号有多个有效设备会话
- **WHEN** 用户在一个设备调用 `/auth/logout`
- **THEN** 服务端撤销当前 Refresh 会话
- **AND** 其它设备仍可续签

#### Scenario: Access Token 过期后仍可撤销当前设备 Refresh 会话
- **GIVEN** 浏览器仍持有当前设备 Refresh Cookie，但 Access Token 已过期或丢失
- **WHEN** 客户端调用 `/auth/logout`
- **THEN** 服务端撤销该 Refresh 会话并清除 Cookie
- **AND** 其它设备会话不受影响

### Requirement: 密码变更撤销会话
系统 SHALL 在用户成功修改密码或重置密码后撤销该用户所有 Refresh 会话，防止旧凭证继续续签。

#### Scenario: 成功修改密码后撤销所有 Refresh 会话
- **GIVEN** 用户有一个或多个有效设备会话
- **WHEN** 用户验证当前密码并成功修改密码
- **THEN** 该用户所有 Refresh 会话被撤销
- **AND** 撤销后的 Cookie 均不能继续换取 Access Token

#### Scenario: 成功重置密码后撤销所有 Refresh 会话
- **GIVEN** 用户有一个或多个有效设备会话
- **WHEN** 用户通过验证码成功重置密码
- **THEN** 该用户所有 Refresh 会话被撤销
- **AND** 撤销后的 Cookie 均不能继续换取 Access Token

### Requirement: 旧 Refresh 会话无感迁移
系统 SHALL 在迁移期间接受仍有效的既有缓存格式 Refresh Token，并在其首次成功续签时迁移到 MongoDB 持久会话；成功响应必须下发新格式 Refresh Cookie，不得要求所有用户因部署切换而统一重新登录。

#### Scenario: 首次续签迁移旧会话
- **GIVEN** 客户端持有迁移前签发且仍有效的 Refresh Cookie
- **WHEN** 客户端在迁移期调用 `/auth/refresh`
- **THEN** 服务端创建并持久保存 MongoDB 会话
- **AND** 返回新的 Access Token 和 Refresh Cookie
- **AND** 旧格式凭证不能再次成功续签

#### Scenario: 迁移响应丢失后允许短时幂等重试
- **GIVEN** 旧 Refresh 凭证已写入 MongoDB，但客户端没有收到迁移响应
- **WHEN** 客户端在迁移重试窗口内再次提交旧凭证
- **THEN** 服务端返回同一个已迁移 Refresh Cookie
- **AND** 只保留一个 MongoDB 会话

### Requirement: 页面启动时恢复已有会话
客户端 SHALL 在页面启动恢复用户资料时遇到 Access Token 401 后，先尝试使用 Refresh Cookie 恢复会话，再决定要求用户重新登录；成功刷新后 MUST 用新 Access Token 重试用户资料请求一次，且旧请求的迟到 401 不得清除新 Access Token 或用户状态。后台到期和页面恢复时的刷新沿用同一协调入口。

#### Scenario: 页面启动时 Access Token 已过期但 Refresh 会话有效
- **GIVEN** 浏览器保留了过期 Access Token 和有效 Refresh Cookie
- **WHEN** 页面启动并并行恢复用户资料与 Refresh 会话
- **THEN** 客户端恢复出新的 Access Token
- **AND** 迟到的旧 Access Token 401 不会清除恢复后的登录状态
