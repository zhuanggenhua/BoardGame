## ADDED Requirements

### Requirement: Splendor 本地 AI SHALL 复用现有合法动作与强制决议链
系统 SHALL 要求 Splendor 的本地 AI 只从当前 `legalActions` 根动作集合中择优，不得另起一套私有动作协议或绕过现有 pending-resolution 约束。

#### Scenario: 强制弃牌只走 discard 动作
- **GIVEN** Splendor 当前玩家因 token 超限进入 `discardToLimit`
- **WHEN** 本地 AI 构建候选动作
- **THEN** 候选集合 MUST 只包含 `discard` 动作
- **AND** AI 不得额外生成买牌、拿宝石或私有 `PASS` 动作

#### Scenario: 多贵族选择只走 choose-noble 动作
- **GIVEN** Splendor 当前玩家进入 `chooseNoble`
- **WHEN** 本地 AI 构建候选动作
- **THEN** 候选集合 MUST 只包含 `choose-noble` 动作

### Requirement: Splendor 目标评估 SHALL 保持已预留高价值卡的持续优先级
系统 SHALL 在 Splendor 的本地 AI 目标评估中综合卡牌分数、红利需求密度、贵族连续贡献、购买距离与已预留偏置，避免 AI 在短期拿宝石后丢失自己的关键预留目标。

#### Scenario: 已预留高价值卡持续留在目标集合
- **GIVEN** AI 已预留一张高价值且仍具备中期可达性的卡
- **WHEN** AI 评估当前目标卡集合
- **THEN** 该预留卡 MUST 保持在高优先目标中
- **AND** 后续拿宝石/购买评分 MUST 优先考虑其缺口缩减

#### Scenario: 低收益颜色不会压过关键目标缺口
- **GIVEN** AI 当前存在明确高优先目标卡
- **WHEN** AI 比较多个拿宝石动作
- **THEN** 优先动作 MUST 倾向于缩短目标卡缺口
- **AND** 仅具稀缺度但不能改善目标缺口的颜色不得长期压过关键目标

### Requirement: Splendor hard/expert SHALL 基于可见态进行 projection
系统 SHALL 为 Splendor 的 `hard` 与 `expert` 本地 AI 提供基于可见态的动作 projection，并要求 projection 保持 `playerView` 边界，不得读取真实 deck 顺序或其他隐藏信息。

#### Scenario: deck 预留 projection 不得透视真实顶牌
- **GIVEN** AI 在 Splendor 中评估 `reserve-deck` 动作
- **WHEN** 系统构建 projected state
- **THEN** projected state MUST 不读取真实 deck top card id
- **AND** 后续评估 MUST 以 hidden placeholder 或 tier 期望值保守处理

#### Scenario: expert 使用合成 follow-up 而非对手回合模拟
- **GIVEN** Splendor AI 难度为 `expert`
- **WHEN** 系统完成首层动作 projection
- **THEN** 系统 MUST 基于可见态生成一组 self follow-up 候选并评估其最高收益
- **AND** 不得模拟真实对手回合或读取对手隐藏信息

### Requirement: Splendor 本地 AI SHALL 将溢出与丢弃代价纳入主评分链
系统 SHALL 在 Splendor 的拿宝石、预留和 projection 评分中显式考虑 token 超限后的丢弃代价，并优先保留黄金与高相关颜色。

#### Scenario: 可能触发糟糕丢弃的拿宝石动作被降权
- **GIVEN** 某个拿宝石动作会导致 AI 超过 token 上限
- **WHEN** AI 对该动作评分
- **THEN** 评分 MUST 扣除预期丢弃代价
- **AND** 若最优丢弃路径需要放弃黄金或关键目标颜色，则扣分 MUST 显著提高

#### Scenario: discard 评分优先丢弃低相关颜色
- **GIVEN** AI 已进入 `discardToLimit`
- **WHEN** AI 对不同弃牌颜色评分
- **THEN** 黄金 MUST 作为最低优先级丢弃项
- **AND** 与当前目标卡弱相关的颜色 MUST 高于强相关颜色

### Requirement: Splendor 难度路由 SHALL 保持现有强度语义
系统 SHALL 保持 Splendor 本地 AI 的现有难度路由语义，使 `baseline` 继续按 difficulty 分发，并确保整体强度顺序不反转。

#### Scenario: baseline 继续按 difficulty 分发
- **GIVEN** Splendor 座位只声明 `difficulty`
- **WHEN** 本地 AI 进入决策
- **THEN** `baseline` policy MUST 路由到对应难度的本地策略

#### Scenario: 难度梯度不反转
- **GIVEN** Splendor 执行本地 AI 对局基准
- **WHEN** 比较 `easy`、`normal`、`hard`、`expert`
- **THEN** 系统 MUST 保持整体强度顺序不反转
- **AND** `hard` 与 `expert` SHOULD 比低档位表现更稳定
