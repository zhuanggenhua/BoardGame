## MODIFIED Requirements

### Requirement: 服务端注册派生
系统 SHALL 从自动生成的权威清单派生服务端可对局游戏列表，并合并已发布 UGC 包作为动态注册条目。

#### Scenario: 启动或刷新时注册 UGC
- **WHEN** 服务端启动或触发 UGC 列表刷新
- **THEN** 系统 MUST 注册清单中的内置游戏，并追加已发布 UGC 包（packageId 作为 gameId）到可对局列表
