## ADDED Requirements
### Requirement: R2 官方素材主源
系统 SHALL 在保持 `https://assets.easyboardgame.top/official` 公开资源基址不变的前提下，将 `official/**` 正式对象的默认玩家下载主源恢复为 R2。

#### Scenario: 普通素材从 R2 返回
- **WHEN** 客户端请求 `https://assets.easyboardgame.top/official/**` 下的普通素材
- **THEN** 系统 MUST 从 R2/Cloudflare 返回同一路径对象
- **AND** MUST NOT 默认从生产服务器素材源读取对象

#### Scenario: 移动发布对象从 R2 返回
- **WHEN** 客户端请求 `/official/app-updates/**`、`/official/mobile-packages/**` 或 `/official/native-app-updates/**`
- **THEN** 系统 MUST 从 R2/Cloudflare 返回对应对象
- **AND** MUST NOT 通过服务器素材源旁路返回旧对象

### Requirement: R2 主源公开链路验收
系统 SHALL 使用真实公开资源域名验证 R2 主源，而不是用服务器本机可读、旧对象可读或静默回源服务器作为成功证据。

#### Scenario: 公开域名验证 R2 主源
- **WHEN** 验证 `https://assets.easyboardgame.top/official/**` 的完成态
- **THEN** 验收 MUST 使用真实域名和公开 HTTPS 链路
- **AND** 代表性对象 MUST 返回本次预期大小和内容哈希
- **AND** 响应或运维证据 MUST 证明请求未命中生产服务器素材源

#### Scenario: 服务器素材源不可作为默认成功路径
- **WHEN** 生产服务器素材源仍能返回同 key 对象
- **THEN** 该事实 MUST NOT 被视为 R2 主源切换成功
- **AND** 验收 MUST 回到公开域名是否命中 R2 主源

### Requirement: 服务器素材源应急边界
系统 MAY 保留服务器素材源作为迁移期回滚或受控应急路径，但该路径 MUST 被显式标记，且不得作为默认玩家下载完成态。

#### Scenario: 临时回滚到服务器素材源
- **WHEN** 运维临时把公开资源链路回滚到服务器素材源
- **THEN** 本次状态 MUST 标记为应急回滚
- **AND** MUST NOT 宣称 R2 主源已经完成
- **AND** 后续恢复验收 MUST 重新证明公开链路命中 R2 主源
