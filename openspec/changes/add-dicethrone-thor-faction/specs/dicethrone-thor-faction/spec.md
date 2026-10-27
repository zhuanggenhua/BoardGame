## ADDED Requirements

### Requirement: 索尔规则与素材一致

系统 SHALL 从用户指定索尔原图的锁定录入合同实现九槽技能、全部物理卡、骰面、锤子与状态；资源必须使用正式manifest和远端媒体。

#### Scenario: 未完成实施的角色

- **WHEN** 索尔实现或审计仍未完成
- **THEN** 真人选角、AI选角和直接玩家命令不得绕过 `hidden` 生命周期。

#### Scenario: 当前范围通过实施验收

- **WHEN** 对象合同、资源、机制、审计和必要交互验证均通过
- **THEN** 索尔可进入 `in_progress`，保留实施中标记，等待用户明确确认完成态。
