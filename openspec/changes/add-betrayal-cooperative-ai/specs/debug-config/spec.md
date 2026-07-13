## ADDED Requirements

### Requirement: 小黑屋 SHALL 提供公共调试配置入口
系统 SHALL 在小黑屋真实游戏路由中挂载公共调试面板，并 SHALL 复用公共状态、命令、控制与 AI 座位调试能力。

#### Scenario: 三种游戏阶段均可使用调试面板
- **GIVEN** 开发或 E2E 调试模式已启用
- **WHEN** 小黑屋处于角色选择、正式对局或终局阶段
- **THEN** 公共调试面板 MUST 可在当前真实页面打开
- **AND** MUST 使用小黑屋 manifest 的玩家人数与 AI 能力配置

#### Scenario: 无路由组件测试不强制挂载调试面板
- **GIVEN** 小黑屋棋盘在无真实路由的纯组件测试环境渲染
- **WHEN** 页面检查调试入口
- **THEN** 系统 MUST 跳过调试面板挂载
- **AND** 小黑屋正式界面 MUST 继续正常渲染
