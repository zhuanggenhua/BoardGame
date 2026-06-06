## ADDED Requirements

### Requirement: 通用 AI 决策 SHALL 支持候选行动迭代循环
系统 SHALL 支持在同一决策阶段内执行“候选行动评估 → 选择动作 → 执行动作 → 基于新状态重评估”的迭代循环，直到无可执行收益动作或阶段结束条件达成。

#### Scenario: 候选循环在动作执行后重评估
- **GIVEN** AI 进入某个复杂决策阶段并已生成 `legalActions`
- **WHEN** AI 执行了本回合的一个合法动作
- **THEN** 系统 MUST 基于更新后的可见状态重新生成候选并继续评估
- **AND** 不得复用已过期状态上的静态候选顺序直接连做

#### Scenario: 候选循环不绕过合法性门禁
- **GIVEN** 通用决策启用了候选循环
- **WHEN** AI 选择并提交某个动作
- **THEN** 该动作 MUST 来自当前 `AiDecisionContext.legalActions`
- **AND** 仍须通过既有 validate / execute / reduce / systems 链

### Requirement: 通用动作比较 SHALL 使用相对效用与受控随机
系统 SHALL 允许动作以相对效用（relative utility）进行比较，并按难度配置可选地加入受控随机，以减少机械重复且保持主目标一致性。

#### Scenario: 高效用动作在同局势下更高概率被选中
- **GIVEN** 多个候选动作均合法且可执行
- **WHEN** 系统计算各动作相对效用
- **THEN** 效用更高的动作 MUST 具有更高选择优先级
- **AND** 低于最低有效阈值的动作 MUST 可被过滤

#### Scenario: 难度控制随机不破坏主目标
- **GIVEN** 当前难度允许随机扰动
- **WHEN** 系统在相近效用动作间注入随机性
- **THEN** 随机选择 MUST 保持在主目标约束内
- **AND** 不得使明显劣解稳定压过明显优解

### Requirement: 通用决策 SHALL 支持 assignment-first 分配层
系统 SHALL 支持在多行动体决策中先执行“任务-执行体”分配评估，再进入具体动作决策，以降低资源冲突与协同失配。

#### Scenario: 可行分配按综合评分排序
- **GIVEN** 当前阶段存在多个行动体与多个任务
- **WHEN** AI 构造任务-执行体可行组合
- **THEN** 系统 MUST 基于任务优先级、执行收益与到达成本计算综合分
- **AND** 按评分顺序优先处理更高价值分配

#### Scenario: 非法或不可达分配被剔除
- **GIVEN** 某任务-执行体组合不满足可执行条件
- **WHEN** 系统构造分配候选
- **THEN** 该组合 MUST 被过滤
- **AND** 不得进入后续动作选择阶段

### Requirement: 游戏适配层 SHALL 提供可扩展特征快照
系统 SHALL 允许游戏适配层提供统一特征快照接口，用于动作估值、候选排序与决策解释；`threat/control/objective/frontline` SHALL 作为首批推荐字段而非硬编码上限。

#### Scenario: 适配层暴露最小特征集合
- **GIVEN** 某游戏接入通用决策原语扩展
- **WHEN** AI 评估候选动作
- **THEN** 适配层 MUST 能提供不少于 `threat/control/objective/frontline` 的首批特征
- **AND** 公共层 MUST 能消费这些特征用于评分或搜索增量

#### Scenario: 特征快照进入结构化 trace
- **GIVEN** 系统输出 AI 决策 trace
- **WHEN** 某动作因战术特征获得加分或降权
- **THEN** trace MUST 记录相关特征与分数贡献
- **AND** 调试者应能从 trace 复盘该动作为何被选中

### Requirement: SummonerWars SHALL 作为通用原语首个验证对象
系统 SHALL 以 SummonerWars 作为首个验证游戏，并提供可复验的行为场景证明其决策从静态局部最优提升为回合内迭代决策最优近似。

#### Scenario: 前线推进与回防能根据压力切换
- **GIVEN** SummonerWars 同时存在推进机会与本方召唤师压力
- **WHEN** AI 执行基于通用原语的决策
- **THEN** 系统 MUST 能在推进与回防间做上下文切换
- **AND** 该切换依据应可在 trace 中解释

#### Scenario: 关键交互选择纳入战术位置价值
- **GIVEN** SummonerWars 出现多个交互目标或位置候选
- **WHEN** AI 评估交互相关动作
- **THEN** 系统 MUST 将战术位置价值纳入候选比较
- **AND** 不得仅依赖候选顺序或固定动作类型权重
