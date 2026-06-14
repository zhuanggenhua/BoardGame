## ADDED Requirements
### Requirement: 系统层 SHALL 允许游戏声明式运行时作为系统所有权内的执行器
系统层 SHALL 允许像 Smash Up 这样的游戏在系统所有权边界内定义声明式能力运行时，但该运行时必须通过 resolution frame、interaction 和其他系统桥协作，不能绕过系统层直接拥有并行主链。

#### Scenario: 游戏 runtime 使用系统桥而不绕过系统所有权
- **GIVEN** 一个 Smash Up ability program 需要创建 prompt、补发 deferred follow-up 或进入 response-style bridge
- **WHEN** 运行时解释该 ability program
- **THEN** 它 MUST 通过系统层既有的 resolution frame / interaction / response 协议完成这些动作
- **AND** 游戏 runtime MUST NOT 直接创造脱离系统层 owner 的第二条业务主链

