## ADDED Requirements
### Requirement: 单用户单房间占用
系统 SHALL 限制同一 `ownerKey` 同时只能拥有一个占用房间，且 `gameover` 仍视为占用。

#### Scenario: 已有占用房间
- **WHEN** 用户已存在 `ownerKey` 对应的占用房间
- **THEN** 创建房间返回 `ACTIVE_MATCH_EXISTS:{gameName}:{matchID}`
- **AND** 该规则对 `gameover` 房间同样生效

### Requirement: 登录用户回归座位
系统 SHALL 提供 `POST /games/:name/:matchID/claim-seat` 以支持登录用户在无本地凭据时回归占用座位。

#### Scenario: JWT 认证通过且 ownerKey 匹配
- **WHEN** 请求携带有效 JWT 且 `ownerKey == user:{userId}`
- **THEN** 系统为指定 `playerID` 重新签发 credentials 并返回

#### Scenario: JWT 认证失败或 ownerKey 不匹配
- **WHEN** JWT 无效或 `ownerKey` 不属于该用户
- **THEN** 请求被拒绝并返回 401/403

### Requirement: 游客房间覆盖策略
系统 SHALL 在游客创建房间时删除其已有占用房间并允许新建。

#### Scenario: 游客已有占用房间
- **WHEN** `ownerKey` 为 `guest:*` 且已存在占用房间
- **THEN** 系统删除旧房间并允许创建新房间
