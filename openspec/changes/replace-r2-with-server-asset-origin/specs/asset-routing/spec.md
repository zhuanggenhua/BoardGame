## ADDED Requirements

### Requirement: 官方素材域名必须使用服务器唯一线上源
系统 SHALL 在保持 `https://assets.easyboardgame.top/official` 公开资源基址不变的前提下，只从服务器素材源提供正式素材、应用更新包、移动素材包和原生更新包。

#### Scenario: 普通素材从服务器返回
- **WHEN** 客户端请求 `https://assets.easyboardgame.top/official/**` 下的普通素材
- **THEN** 系统 MUST 从服务器活动版本返回同一路径
- **AND** MUST NOT 读取 R2 或其他对象存储作为自动回退
- **AND** MUST 通过诊断响应头标识服务器来源

#### Scenario: 域名直连服务器
- **WHEN** 验证 `https://assets.easyboardgame.top/official/**`
- **THEN** DNS MUST resolve to a grey-cloud A record for the server IP
- **AND** 响应 MUST NOT contain Cloudflare Worker-only headers such as `CF-Ray`
- **AND** TLS MUST be served by the server with a public trusted certificate
- **AND** 验收 MUST use the real domain name with SNI, not `https://8.148.71.102/**` or server-local curl as a substitute
- **AND** `/official/**` MUST keep CORS, range requests, cache headers, and download rate limits

#### Scenario: 源站不可用
- **WHEN** 服务器 443 直连入口不可用、超时或抛出异常
- **THEN** 系统 MUST 返回可观测的错误响应
- **AND** MUST NOT 将响应伪装为 R2 回退成功

### Requirement: 大型发布路径必须由服务器唯一源提供
系统 SHALL 让 `/official/app-updates/**`、`/official/mobile-packages/**` 和 `/official/native-app-updates/**` 与普通素材一样只由服务器活动版本提供。

#### Scenario: 应用更新包下载
- **WHEN** 请求路径位于 `/official/app-updates/**`
- **THEN** 系统 MUST 从服务器活动版本返回对象
- **AND** MUST NOT 存在绕过服务器直连去读取 R2 的路由

#### Scenario: 移动素材包下载
- **WHEN** 请求路径位于 `/official/mobile-packages/**`
- **THEN** 系统 MUST 从服务器活动版本返回对象
- **AND** MUST NOT 读取 R2 同 key 对象

#### Scenario: 原生更新包下载
- **WHEN** 请求路径位于 `/official/native-app-updates/**`
- **THEN** 系统 MUST 从服务器活动版本返回对象
- **AND** MUST NOT 读取 R2 同 key 对象

### Requirement: Worker 不得绑定 R2
Cloudflare Worker 配置 SHALL NOT declare any R2 bucket binding for the official asset router.

#### Scenario: Worker 部署配置
- **WHEN** 部署 `boardgame-asset-router`
- **THEN** Wrangler 配置 MUST NOT contain `r2_buckets`
- **AND** Worker runtime MUST NOT reference `ASSETS_BUCKET`
