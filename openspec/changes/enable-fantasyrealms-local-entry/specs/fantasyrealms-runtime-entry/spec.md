## ADDED Requirements

### Requirement: FantasyRealms 必须作为本地可进入游戏暴露入口
系统 SHALL 在当前 2~6 人运行时已经落地后，把幻想国度作为可进入的本地游戏入口暴露出来。

#### Scenario: 检查 manifest
- **WHEN** 团队检查 `fantasyrealms` manifest
- **THEN** `manifest.enabled` MUST 为 `true`
- **AND** `allowLocalMode` MUST 继续为 `true`
- **AND** 玩家数描述 MUST 与当前 2~6 人实现一致

### Requirement: FantasyRealms 启用后必须进入大厅 registry 与客户端加载映射
系统 SHALL 在启用后把幻想国度接入大厅 registry 与客户端 loaderMap。

#### Scenario: 检查大厅与运行时加载
- **WHEN** 团队检查 `fantasyrealms` 的注册状态
- **THEN** `getGameById('fantasyrealms')` MUST 返回游戏配置
- **AND** `hasGameImplementation('fantasyrealms')` MUST 返回 `true`
- **AND** `loadGameImplementation('fantasyrealms')` MUST 能返回 board 与 engine runtime
