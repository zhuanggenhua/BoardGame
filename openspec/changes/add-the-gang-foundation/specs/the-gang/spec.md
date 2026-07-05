## ADDED Requirements
### Requirement: The Gang 基础版游戏接入
系统 SHALL 提供 `the-gang` 游戏条目，首期支持 3-6 人基础版，并能通过项目游戏注册表自动发现。

#### Scenario: 游戏注册表发现 The Gang
- **WHEN** 执行游戏 manifest 生成脚本
- **THEN** 生成清单 MUST 包含 `the-gang`
- **AND** `the-gang` MUST 暴露前端 Board 与服务端 engineConfig

### Requirement: 基础抢劫流程
The Gang 基础版 SHALL 以抢劫为单局子流程，每次抢劫包含 4 轮筹码选择，并在第 4 轮后进入摊牌判定。

#### Scenario: 四轮公共牌推进
- **GIVEN** 一次新抢劫开始
- **WHEN** Round 1 开始
- **THEN** 每名玩家 MUST 获得 2 张底牌
- **WHEN** Round 2 开始
- **THEN** 系统 MUST 翻开 3 张公共牌
- **WHEN** Round 3 或 Round 4 开始
- **THEN** 系统 MUST 各额外翻开 1 张公共牌

### Requirement: 筹码排序表达
系统 SHALL 在每轮提供与玩家人数匹配的星级筹码，玩家通过选择筹码表达自己相对牌力。

#### Scenario: 玩家选择当前轮筹码
- **GIVEN** 当前处于筹码选择阶段
- **WHEN** 玩家选择一个未被其他玩家持有的当前轮筹码
- **THEN** 该玩家 MUST 持有该筹码
- **AND** 该筹码 MUST 从当前轮可选池移除

#### Scenario: 玩家更换当前轮筹码
- **GIVEN** 玩家本轮已经持有一个筹码
- **WHEN** 该玩家选择另一个未被占用的当前轮筹码
- **THEN** 原筹码 MUST 回到可选池
- **AND** 新筹码 MUST 归该玩家持有

### Requirement: 德州扑克牌力判定
系统 SHALL 依据每名玩家 2 张底牌和 5 张公共牌计算最佳 5 张德州扑克牌型，并支持相同牌型的 kicker 比较。

#### Scenario: 摊牌排序
- **GIVEN** Round 4 已结束
- **WHEN** 系统执行摊牌
- **THEN** 系统 MUST 为每名玩家计算最终牌力
- **AND** 系统 MUST 按真实牌力从弱到强得到玩家排序

### Requirement: 抢劫成功与游戏胜负
系统 SHALL 使用第 4 轮红色筹码顺序与真实牌力顺序比对来判定抢劫结果，并以 3 次成功或 3 次失败结束整局游戏。

#### Scenario: 红色筹码排序正确
- **GIVEN** 所有玩家第 4 轮红色筹码的相对顺序与真实牌力不冲突
- **WHEN** 摊牌完成
- **THEN** 本次抢劫 MUST 记为成功

#### Scenario: 红色筹码排序错误
- **GIVEN** 至少两名玩家的红色筹码顺序与真实牌力冲突
- **WHEN** 摊牌完成
- **THEN** 本次抢劫 MUST 记为失败

#### Scenario: 游戏结束
- **GIVEN** 成功次数达到 3
- **WHEN** 当前抢劫结算完成
- **THEN** 游戏 MUST 以团队胜利结束
- **GIVEN** 失败次数达到 3
- **WHEN** 当前抢劫结算完成
- **THEN** 游戏 MUST 以团队失败结束

### Requirement: 手牌信息隐藏
系统 SHALL 在非摊牌阶段只向玩家展示自己的底牌，不向其他玩家暴露隐藏手牌。

#### Scenario: 非本人玩家视图
- **GIVEN** 当前未进入摊牌公开阶段
- **WHEN** 玩家查看对局状态
- **THEN** 该玩家 MUST 只能看到自己的底牌具体内容
- **AND** 其它玩家底牌 MUST 以隐藏状态呈现
