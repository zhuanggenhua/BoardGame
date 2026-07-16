## ADDED Requirements

### Requirement: DiceThrone AI SHALL 使用统一局面价值函数
DiceThrone 本地 AI SHALL 使用统一局面价值函数评估当前玩家视角下的战术局面，并将生命安全、即将承伤、伤害竞速、CP/手牌经济、升级引擎、状态/token、护盾和骰面计划纳入同一评分口径。

#### Scenario: 普攻与关键技能在同一口径比较
- **GIVEN** 真人当前公开骰面只能发动普攻或低价值攻击
- **WHEN** DiceThrone AI 评估是否花响应资源改骰
- **THEN** AI MUST 将该攻击的实际伤害和附加收益纳入统一局面价值
- **AND** 不得仅因“能降低对手骰面点数”就稳定选择改骰

#### Scenario: 生命安全压过普通资源收益
- **GIVEN** AI 面临致命或高压伤害
- **WHEN** AI 同时拥有防御响应、补牌、资源或普通出牌动作
- **THEN** 局面价值 MUST 对生存收益施加显著权重
- **AND** 可阻止失败的动作 MUST 能压过普通经济动作

### Requirement: DiceThrone AI SHALL 使用响应窗口实际收益门槛
DiceThrone 本地 AI SHALL 在响应窗口中先判断候选动作能阻止、确保或改变的实际收益，再决定是否花费手牌、CP、token 或骰面干预资源。

#### Scenario: 普攻不稳定触发改骰
- **GIVEN** 真人投出的骰面只对应普攻或低价值攻击
- **AND** AI 的改骰牌不能降低有效伤害档位、不能阻止关键效果、不能改变斩杀状态
- **WHEN** AI 在响应窗口评估改骰牌与跳过响应
- **THEN** 改骰牌的机会成本 MUST 使其低于跳过响应或其他保守动作

#### Scenario: 关键技能必须触发高优先响应
- **GIVEN** 真人投出的骰面对应大招、斩杀、高伤害、强状态、强回血或强资源技能
- **AND** AI 存在能有效打断或显著降低该收益的合法响应动作
- **WHEN** AI 在响应窗口评估候选动作
- **THEN** 该响应动作 MUST 获得高优先级
- **AND** trace MUST 记录被阻止的收益类型与机会成本

### Requirement: DiceThrone AI SHALL 使用动作后局面差值投影
DiceThrone 本地 AI SHALL 将可安全模拟的候选动作投影升级为“动作后局面价值 - 当前局面价值”的差值评估，使同一张牌、同一次改骰或同一个阶段动作在不同局势下获得不同价值。

#### Scenario: 同一改骰牌在普攻和关键技能下评分反转
- **GIVEN** 同一张改骰牌在两个公开局势下均为合法响应动作
- **AND** 第一个局势中真人只会发动普攻
- **AND** 第二个局势中真人会发动关键技能或斩杀攻击
- **WHEN** AI 进行动作后局面差值投影
- **THEN** 第一个局势中的改骰收益 MUST 被机会成本压低
- **AND** 第二个局势中的改骰收益 MUST 反映阻止关键技能后的局面提升

#### Scenario: 不可安全模拟时保守降级
- **GIVEN** 某个 DiceThrone 候选动作涉及交互型额外骰、未知 custom action 或尚未统一的掷骰上下文
- **WHEN** AI 无法在预算内安全模拟该动作
- **THEN** AI MUST 保守降级到 scorer-only 或既有 fallback
- **AND** 不得绕过 `legalActions` 或正式 validate / execute / reduce / systems 链构造专用结果

### Requirement: DiceThrone AI SHALL 搜索阶段内短线组合
DiceThrone 本地 AI SHALL 在预算允许时搜索同一阶段内最多 2-3 步的候选动作序列，用于识别单步评分难以捕捉的掷骰、出牌和响应组合。

#### Scenario: 掷骰阶段搜索锁骰与改骰组合
- **GIVEN** AI 当前骰面接近高价值技能线
- **AND** AI 还有锁骰、改骰牌、被动重掷、重投或确认动作
- **WHEN** AI 启用阶段内短线搜索
- **THEN** 系统 MUST 能评估锁骰后再改骰或重投的后续收益
- **AND** 不得把第一步锁骰或改骰误判为孤立动作

#### Scenario: 主阶段搜索卖牌解锁出牌组合
- **GIVEN** AI 当前 CP 不足以打出高价值牌或升级牌
- **AND** 卖出低保留价值手牌后可以解锁该动作
- **WHEN** AI 搜索主阶段短线动作序列
- **THEN** 系统 MUST 能把后续出牌或升级收益折算回卖牌动作
- **AND** 无后续解锁收益时 MUST 降低卖牌优先级

#### Scenario: 序列搜索每步重新生成合法动作
- **GIVEN** DiceThrone AI 正在搜索阶段内动作序列
- **WHEN** 搜索模拟执行了一步候选动作
- **THEN** 系统 MUST 基于模拟后的状态重新生成 `legalActions`
- **AND** 不得继续使用旧状态上的候选动作列表作为后续步骤

### Requirement: DiceThrone AI SHALL 支持扩展英雄策略 profile
DiceThrone 本地 AI SHALL 为不同英雄提供可解释的策略 profile，使爆发、续航、防御、token、升级、改骰和响应依赖能够影响同一公共评分框架，同时不改变规则合法性。

#### Scenario: 英雄 profile 改变候选排序
- **GIVEN** 同一局面中存在多个价值接近的合法动作
- **WHEN** 当前 AI 英雄具有明确策略 profile
- **THEN** profile MUST 影响候选动作排序
- **AND** 该影响 MUST 在 trace 中以英雄策略贡献呈现

#### Scenario: 英雄 profile 不覆盖响应安全底线
- **GIVEN** AI 面临可阻止的致命伤害或关键技能
- **WHEN** 当前英雄 profile 偏向进攻、经济或升级
- **THEN** 响应安全底线 MUST 仍能压过普通进攻或经济偏好

### Requirement: DiceThrone AI SHALL 遵守可见信息预测边界
DiceThrone 本地 AI SHALL 只基于当前 `playerView` 可见状态、公开骰面、公开响应窗口和自身合法动作投影进行预测，不得读取隐藏信息或把真人未来主观选择当作确定事实。

#### Scenario: 不预测真人隐藏意图
- **GIVEN** 真人玩家后续可能在多个合法选项中选择
- **WHEN** AI 评估当前响应或后续局面
- **THEN** AI MUST 只使用当前公开可执行收益或保守威胁估计
- **AND** 不得把某个真人未来选择当作确定事实写入局面价值

#### Scenario: 不读取隐藏手牌或牌堆顺序
- **GIVEN** DiceThrone 对局存在对 AI 不可见的手牌或牌堆信息
- **WHEN** AI 进行局面评估、投影或短线搜索
- **THEN** AI MUST 遵守 `playerView` 可见信息边界
- **AND** 不得直接读取隐藏手牌、真实牌堆顺序或其他不可见信息

### Requirement: DiceThrone AI SHALL 与统一掷骰上下文提案保持兼容
DiceThrone 本地 AI SHALL 识别当前活跃掷骰上下文的能力边界；在统一掷骰上下文尚未实施完成前，AI 对额外骰、展示型骰或未归一化骰池必须保守降级。

#### Scenario: 额外骰未统一时保守降级
- **GIVEN** 当前规则链路中的额外骰仍未进入统一权威掷骰上下文
- **WHEN** AI 需要评估该额外骰上的改骰、重掷或响应收益
- **THEN** AI MUST 记录保守降级原因
- **AND** 不得伪造完整可交互骰面预测

#### Scenario: 统一掷骰上下文完成后复用同一评估边界
- **GIVEN** 后续 change 已将额外骰接入统一权威掷骰上下文
- **WHEN** DiceThrone AI 评估当前活跃骰池
- **THEN** AI MUST 通过同一局面价值、响应门槛和动作投影边界消费该上下文
- **AND** 不得为额外骰另建一套评分协议

### Requirement: DiceThrone AI tactical refactor SHALL not require MCTS
DiceThrone 本地 AI 战术重构 SHALL 将完整 MCTS 视为后续独立能力，而不是本轮响应窗口、动作差值和短线搜索升级的默认交付内容。

#### Scenario: 战术重构不要求完整 MCTS
- **GIVEN** DiceThrone AI 已接入统一局面价值、响应收益门槛、动作后差值和阶段内短线搜索
- **WHEN** 该 change 声明完成本地战术 AI 重构
- **THEN** 系统 MUST NOT 要求其同时实现完整 MCTS
- **AND** 提案、任务和收口说明 MUST 明确 MCTS 是否属于本轮范围
