## ADDED Requirements

### Requirement: FantasyRealms 桌面端 Board 必须采用麻将桌式牌桌构图
系统 SHALL 在 `fantasyrealms` 的桌面端 Board 中采用麻将桌式牌桌构图，而不是继续使用三栏等权后台布局。

#### Scenario: 玩家进入桌面端常规对局
- **WHEN** 玩家以桌面端视口进入 `fantasyrealms` 常规对局
- **THEN** Board MUST 以底部手牌带和中央公开弃牌河作为首屏主视觉
- **AND** 回合、牌库、分数、焦点等状态 MUST 退到边缘或角落信息位
- **AND** 桌面进行页 MUST 不常驻描述性说明块、规则解释块或推演说明块
- **AND** 系统 MUST 不继续使用左中右三栏等权布局承载主内容

### Requirement: FantasyRealms 桌面端进行页不得常驻描述性信息
系统 SHALL 在 `fantasyrealms` 的桌面端进行中对局页中，默认去除描述性说明 UI，只保留最小必要的动作、数值与状态。

#### Scenario: 玩家进入桌面端进行中对局
- **WHEN** 玩家以桌面端视口进入仍未结算的 `fantasyrealms` 对局
- **THEN** 页面 MUST 不常驻 `当前焦点`、`结束进度`、观察者说明、规则说明或分数拆解
- **AND** 页面 MAY 保留最小必要的动作短标签、回合标识、牌库余量、分数数值与阈值计数

#### Scenario: 玩家查看桌面端近终盘代表态
- **WHEN** 玩家在桌面端查看接近结束但仍未结算的 `fantasyrealms` 对局
- **THEN** 页面 MUST 仍以手牌带和公开弃牌河为主视觉
- **AND** 页面 MUST 不因弃牌接近阈值而恢复解释面板或同级厚方框

### Requirement: FantasyRealms 桌面端公开弃牌区必须表现为中央公开河
系统 SHALL 将 `fantasyrealms` 的公开弃牌信息重构为桌面中央的公开河，而不是作为大空盒子或侧栏内容存在。

#### Scenario: 常规对局存在公开弃牌
- **WHEN** 玩家在桌面端查看有公开弃牌的 `fantasyrealms` 对局
- **THEN** 公开弃牌 MUST 以中央河式区域展示
- **AND** 该区域 MUST 明确承担“全桌公共信息”的角色

#### Scenario: 公开弃牌为空
- **WHEN** 玩家在桌面端查看公开弃牌为空的 `fantasyrealms` 对局
- **THEN** 空态 MUST 保持紧凑，不得成为页面最大视觉盒子
- **AND** 系统 MUST 继续保持底部手牌带是主操作区域

### Requirement: FantasyRealms 实施顺序必须先完成桌面端真实页
系统 SHALL 在 `fantasyrealms` 的主 UI 重构中，先完成桌面端真实页验收，再进入移动端适配，除非用户明确批准例外顺序。

#### Scenario: 桌面端仍存在阻塞级 UI bug
- **WHEN** `fantasyrealms` 桌面端真实页仍存在阻塞级 UI bug
- **THEN** 系统 MUST 不开始把移动端适配标记为当前主实施阶段
- **AND** 桌面端问题 MUST 继续留在当前 change 的主范围内

#### Scenario: 用户明确要求并行或先做移动端
- **WHEN** 用户明确要求 `fantasyrealms` 的移动端与桌面端并行实现，或先做移动端
- **THEN** 系统 MAY 例外调整顺序
- **AND** 该例外 MUST 在任务或证据中被显式记录
