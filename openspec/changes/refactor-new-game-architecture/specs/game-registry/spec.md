## ADDED Requirements

### Requirement: 运行环境边界与新增游戏扩展

系统 SHALL 将客户端注册保留在客户端入口，服务端规则入口不得通过传递运行时依赖载入 React、DOM 组件或浏览器注册；共享框架 SHALL 通过数据与显式 adapter 接受游戏差异。

#### Scenario: 服务端加载游戏
- **WHEN** 服务端读取正式 game manifest 并载入规则引擎
- **THEN** 客户端注册不执行，静态依赖图不进入客户端组件模块

#### Scenario: 客户端加载游戏
- **WHEN** 既有 manifest 加载 Board 客户端入口
- **THEN** 对应卡牌预览与关键图片注册保持可用，规则实现不重复拥有注册职责

#### Scenario: 新游戏扩展
- **WHEN** 新游戏接入布局、多步交互或持久化
- **THEN** 使用正式 adapter、可序列化描述与版本化接收合同，不增加共享游戏 ID 特判或自建平行恢复链
