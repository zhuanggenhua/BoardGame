## MODIFIED Requirements

### Requirement: 教程入口统一
系统 SHALL 支持 UGC 教程入口与现有 TutorialManifest 结构一致，并从包内 tutorial.js 加载。

#### Scenario: 加载 UGC 教程
- **WHEN** 用户进入 /play/:gameId/match/:matchId/tutorial 且 gameId 为 UGC packageId
- **THEN** 系统 MUST 加载 packageId 对应的 tutorial.js 并解析为 TutorialManifest
