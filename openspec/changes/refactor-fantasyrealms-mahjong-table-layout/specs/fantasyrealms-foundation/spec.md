## ADDED Requirements

### Requirement: FantasyRealms 桌面端 Board 必须采用 `fr-merge-pass2` 中央承接牌桌路线
系统 SHALL 在 `fantasyrealms` 的桌面端 Board 中采用当前已批准的 `fr-merge-pass2` 中央承接牌桌路线，而不是继续保留三栏后台式布局、旧麻将桌候选或其它并行桌面候选。

#### Scenario: 玩家进入桌面端开局或无待处理对象的对局
- **WHEN** 玩家以桌面端视口进入 `fantasyrealms` 常规对局
- **THEN** Board MUST 保留大面积干净牌桌，不得摆出巨型空盒、永久底部厚带或等权内容栏
- **AND** 牌库 MUST 作为左侧牌堆物件出现
- **AND** 回合、轮次、进度、分数等状态 MUST 退到顶部或边缘轻量信息位
- **AND** 桌面进行页 MUST 不常驻描述性说明块、规则解释块或推演说明块
- **AND** 系统 MUST 不继续使用左中右三栏等权布局承载主内容

#### Scenario: 玩家进入需要摸牌、选牌、弃牌或确认的桌面端位点
- **WHEN** 玩家在桌面端进入 `draw / discard / confirm` 等真实待处理位点
- **THEN** 当前真正要处理的牌 MUST 集中承接在桌面中央
- **AND** 页面 MUST NOT 以底部常驻提示横条承接当前正式方向
- **AND** 若当前步骤需要确认动作，确认按钮 MUST 作为右侧次级物件出现，而不是重新展开厚面板或另一套桌面家族

### Requirement: FantasyRealms 桌面端只能保留一套正式 live 家族
系统 SHALL 将 `fantasyrealms` 当前 worktree 中的桌面 live 方向收敛成一套正式真相，不得继续让多个桌面候选并行冒充“当前完成态”。

#### Scenario: 仓库同时存在旧 current、rework、旧麻将桌候选
- **WHEN** 仓库中同时保留旧 `current` 阶段图、`rework-v*`、旧麻将桌草图或历史截图
- **THEN** 只有 `fr-merge-pass2` live 路线 MAY 作为当前正式桌面实现方向
- **AND** 其它候选 MUST 被标记为历史候选、过程材料或旧真相
- **AND** 规范、任务、evidence 口径 MUST 不再把旧候选写成“当前正式方向”

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

### Requirement: FantasyRealms 桌面端公共或待处理牌必须进入中央承接区
系统 SHALL 将 `fantasyrealms` 当前桌面端真正需要玩家看的公共牌、待处理牌或待弃牌对象，收回到桌面中央承接区，而不是分散在侧栏、厚面板或永久空槽里。

#### Scenario: 当前位点存在公开弃牌或待处理牌
- **WHEN** 玩家在桌面端查看存在公开弃牌、待摸牌选择或待弃牌确认的位点
- **THEN** 当前需要处理的牌 MUST 以中央承接区展示
- **AND** 页面 MUST 让玩家一眼看出“这一步要处理的是哪几张牌”

#### Scenario: 当前位点没有公共牌或待处理牌
- **WHEN** 玩家在桌面端查看当前没有公共牌或待处理牌的 `fantasyrealms` 对局
- **THEN** 空态 MUST 保持干净，不得成为页面最大视觉盒子
- **AND** 页面 MUST 继续保持“开阔牌桌 + 轻量边缘物件”的 `fr-merge-pass2` live 路线

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
