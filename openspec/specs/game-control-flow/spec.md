# game-control-flow Specification

## Purpose
TBD - created by archiving change refactor-game-control-flow-stack-system. Update Purpose after archive.
## Requirements
### Requirement: resolution frame stack SHALL 成为唯一业务主链权威
系统 SHALL 使用 resolution frame stack 作为复杂游戏控制流的唯一业务主链权威。任何需要跨本体结算、交互、响应轮、延迟补发继续推进的链路，都 MUST 绑定到某个 resolution frame，而不是再由游戏私有 session 栈、pending flag 或 UI modal 栈单独持有主恢复权。

#### Scenario: 子本体打断父本体后先完整结算再恢复
- **GIVEN** 一张牌或一个能力的本体正在结算
- **AND** 该本体中途又打出了一个必须立即完整结算的新本体
- **WHEN** 系统创建子 resolution frame
- **THEN** 子 frame MUST 成为当前 active frame
- **AND** 父 frame MUST 以可恢复状态保留在同一通用 frame stack 中
- **AND** 子 frame 完成后系统 MUST 自动恢复父 frame 继续执行

#### Scenario: 游戏不得再持有第二套主结算栈
- **GIVEN** 某个游戏需要缓存自己的候选列表、UI 文案或调试视图
- **WHEN** 该游戏接入统一控制流系统
- **THEN** 它 MAY 保留派生视图状态
- **BUT** 它 MUST NOT 再把“当前结算到哪一步、被谁打断、接下来恢复哪里”只存放在游戏私有 session 栈中

### Requirement: resolution frame SHALL 支持明确的顺序语义
系统 SHALL 支持至少三种明确的顺序语义：嵌套本体优先、显式顺序链、当前玩家起顺时针响应轮。不同游戏与不同时机 MUST 显式声明使用哪种顺序语义，禁止用单一 LIFO 假装覆盖全部复杂结算。

#### Scenario: 多基地计分按显式顺序推进
- **GIVEN** 同时有多个基地达到记分条件
- **WHEN** 当前玩家锁定了本轮记分顺序
- **THEN** 系统 MUST 按该显式顺序推进每个基地的记分 frame
- **AND** 不得因为内部使用栈结构而打乱既定顺序

#### Scenario: 可选响应按顺时针轮流直到所有玩家连续 pass
- **GIVEN** 当前本体结算完成后进入“当前玩家起顺时针轮流打一张牌、发动一个能力或让过”的可选响应轮
- **WHEN** 某位玩家在本轮执行了一个合法动作
- **THEN** 系统 MUST 继续保留该响应轮
- **AND** 已经 pass 过的玩家在后续轮次仍 MAY 再次参与
- **AND** 只有当所有玩家连续 pass 时，该响应轮才 MUST 结束

### Requirement: 候选有效性 SHALL 在展示前与提交时双重重验
系统 SHALL 对所有阻塞候选进行双重有效性校验：在展示给玩家之前按最新状态裁剪一次，在玩家提交选择时按最新状态再校验一次。任何已失效的目标、触发器、special 或 ability 候选 MUST 被自动丢弃，而不是继续展示成一个“点了没效果”的按钮。

#### Scenario: 结算顺序候选在目标离场后被自动移除
- **GIVEN** 一个“选择先结算哪个效果”的候选在生成时仍然有效
- **AND** 在它真正轮到被选择前，该来源或目标已经离场或不再满足时机
- **WHEN** 系统重新构建当前 frame 的候选列表
- **THEN** 该候选 MUST 不再继续展示给玩家
- **AND** 即使客户端提交了旧 optionId，系统也 MUST 在提交期拒绝它

### Requirement: deferred follow-up SHALL 由所属 resolution frame 单一持有
系统 SHALL 要求 deferred events、deferred actions、replacement follow-up 等延迟补发内容由所属 resolution frame 单一持有并统一补发。Interaction、ResponseWindow、Modal 或游戏私有 continuationContext MUST NOT 再各自拥有同一笔 follow-up 的主控制权。

#### Scenario: frame 完成后只补发一次 deferred follow-up
- **GIVEN** 当前 resolution frame 持有待补发的延迟事件与延迟动作
- **WHEN** 该 frame 完成所有交互、响应轮与 post-reduce 恢复步骤
- **THEN** 系统 MUST 只补发一次这些 follow-up
- **AND** 补发后 MUST 清空该 frame 的 deferred follow-up

### Requirement: 统一控制流重构 SHALL 通过两游戏强制验收矩阵
系统 SHALL 通过至少两个真实复杂游戏的强制验收矩阵证明统一控制流设计可复用，而不是只服务于单一游戏。

#### Scenario: 王权骰铸同时存在 token response 与目标选择时依次收口
- **GIVEN** 4 人王权骰铸对局中同时出现枪手的目标选择与 token response 前台链路
- **WHEN** 顶层目标选择或 simple-choice 被解决或关闭
- **THEN** 系统 MUST 恢复排队的 token response 为前台阻塞面板
- **AND** 后续结算 MUST 继续落在同一业务主链上收口

#### Scenario: 大杀四方复杂插队结算链能回父本体并清理 stale 候选
- **GIVEN** 大杀四方存在嵌套本体、强制排序、可选响应轮与计分后 follow-up 的复合结算链
- **WHEN** 子本体、交互、响应轮与 deferred follow-up 依次发生
- **THEN** 系统 MUST 先完整收口子链再恢复父链
- **AND** 当前“选择结算顺序”界面中不得保留已失效候选

