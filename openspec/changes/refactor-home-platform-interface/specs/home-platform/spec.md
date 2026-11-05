## ADDED Requirements

### Requirement: Approved design becomes the production home interface
正式首页 SHALL 使用已确认的平台设计及真实业务信息，不以静态示例结果代替实际动作。

#### Scenario: Discover and enter a game
- **WHEN** 玩家在发现页选择游戏并创建或加入房间
- **THEN** 游戏信息来自正式注册表，动作通过现有房间服务执行，成功后进入真实房间，失败时保留可理解的错误与重试路径

### Requirement: Library and responsive navigation retain context
收藏库 SHALL 保存收藏选择，并在详情返回后保留查询、排序与滚动上下文。

#### Scenario: Return from a mobile game detail
- **WHEN** 手机玩家从收藏库进入详情再返回
- **THEN** 原列表状态恢复，主内容可滚动到达，固定底栏与对局条不阻止最后一项操作

### Requirement: Mobile prioritization preserves accessible functions
手机 SHALL 将低优先级内容收纳到可发现的展开区或抽屉，同时保留桌面同源数据和操作可用性。

#### Scenario: Inspect and dismiss mobile navigation
- **WHEN** 玩家打开移动导航抽屉或详情
- **THEN** 存在明确可点关闭入口，关闭恢复原上下文，隐藏内容仍可主动展开，桌面布局不被移动样式改变
