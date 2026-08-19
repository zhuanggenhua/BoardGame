# game-ai-system Specification

## Purpose
TBD - created by archiving change add-strong-singleplayer-ai-difficulty. Update Purpose after archive.
## Requirements
### Requirement: 强单机模式 SHALL 建立在本地确定性 AI 之上
系统 SHALL 将“强单机对手”定义为本地可复现、可预算控制、可离线运行的 AI 模式，而不是默认依赖远程 provider 或外部大模型服务。

#### Scenario: 专家难度默认使用本地 AI
- **GIVEN** 某个游戏启用了强单机 AI 模式
- **WHEN** 玩家选择 `hard` 或 `expert` 等高难度档位
- **THEN** 系统 MUST 使用本地 AI 执行路径完成决策
- **AND** 不得把远程 provider 作为该档位的默认实现

#### Scenario: 远程 provider 仍可作为实验模式存在
- **GIVEN** 某个游戏已接入远程 provider
- **WHEN** 项目启用远程 AI 试验入口
- **THEN** 系统 MAY 允许其作为独立模式运行
- **AND** 不得把该模式冒充为正式强单机档位

### Requirement: 难度档位 SHALL 由统一预算模型驱动
系统 SHALL 为本地强单机 AI 提供统一难度档位，并要求难度差异主要由搜索预算、评估精度、随机扰动和隐藏信息采样策略共同决定，而不是仅靠动作权重常数的松散修改。

#### Scenario: 难度档位映射到统一参数
- **GIVEN** 某个本地 AI 座位配置了难度
- **WHEN** 系统归一化该座位的 AI 设置
- **THEN** 系统 MUST 将该难度映射到统一参数集
- **AND** 参数集 MUST 至少覆盖搜索预算、候选 shortlist 规模、随机扰动强度与评估配置

#### Scenario: 同一档位在不同游戏保持总体语义一致
- **GIVEN** 两个不同游戏都声明支持强单机 AI
- **WHEN** 玩家分别选择 `normal` 或 `hard`
- **THEN** 系统 MUST 保持这些档位在总体强度语义上的一致性
- **AND** 允许游戏在同一语义下覆盖具体预算数值

### Requirement: 公共搜索框架 SHALL 复用 legalActions 根动作集合
系统 SHALL 提供跨游戏可复用的本地搜索框架，并要求所有浅层搜索、rollout 或 MCTS 增强逻辑都以当前 `legalActions` 作为根动作集合。

#### Scenario: 搜索从合法动作出发
- **GIVEN** 本地 AI 进入搜索模式
- **WHEN** 系统准备展开候选动作
- **THEN** 搜索根节点 MUST 仅包含当前 `AiDecisionContext.legalActions`
- **AND** 不得另起一套绕过统一合法性边界的专用动作构造器

#### Scenario: 搜索结果仍返回统一决策对象
- **GIVEN** 搜索流程已经完成候选动作评估
- **WHEN** 系统输出最终决策
- **THEN** 系统 MUST 仍返回统一 `AiActionDecision`
- **AND** 后续执行链 MUST 继续走既有 validate / execute / reduce / systems

### Requirement: 公共层与游戏层 SHALL 明确分工
系统 SHALL 将强单机 AI 的通用算法能力收敛到公共层，并要求游戏层仅提供局面评估、动作剪枝、隐藏信息采样和少量专属 rollout hook，而不是在每个游戏中重复实现整套搜索、预算和调试逻辑。

#### Scenario: 游戏层提供评估与剪枝
- **GIVEN** 某个游戏接入强单机 AI
- **WHEN** 该游戏实现自己的 AI 适配器
- **THEN** 适配器 MUST 至少能够提供局面评估或动作估值能力
- **AND** 适配器 MAY 提供动作剪枝与隐藏信息采样逻辑

#### Scenario: 公共层统一控制预算与 trace
- **GIVEN** 本地 AI 在任意游戏中运行搜索
- **WHEN** 系统记录本次决策过程
- **THEN** 搜索预算、候选 shortlist、tie-break 与调试 trace MUST 由公共层统一生成
- **AND** 游戏层不得各自维护第二套预算与 trace 协议

### Requirement: 不完全信息游戏 SHALL 支持 belief sampling 扩展点
系统 SHALL 为存在隐藏信息的桌游提供统一的 belief sampling 扩展点，使高难度本地 AI 可以在 `playerView` 边界内进行保守采样，而不是直接读取对手隐藏信息。

#### Scenario: 高难度使用采样而不是透视
- **GIVEN** 某个游戏存在隐藏手牌、牌堆顺序或其他隐藏信息
- **WHEN** `hard` 或 `expert` 难度需要估计后续局面
- **THEN** 系统 MUST 通过采样或保守估计生成搜索用状态
- **AND** 不得把真实隐藏信息直接暴露给 AI

#### Scenario: 未实现采样时允许保守降级
- **GIVEN** 某个游戏尚未实现专属 belief sampling
- **WHEN** 该游戏先接入第一版强单机框架
- **THEN** 系统 MAY 退化为基于可见信息的保守估计
- **AND** 必须保持统一 `playerView` 边界不被突破

### Requirement: 统一 AI 决策上下文
系统 SHALL 为所有 AI 运行时提供统一的结构化决策上下文，而不是按不同游戏、不同模型类型分别设计输入协议。

#### Scenario: 本地 AI 与远程 AI 共用同一上下文
- **GIVEN** 某个座位被配置为 `local-ai` 或 `remote-ai`
- **WHEN** 该座位进入可决策状态
- **THEN** 系统 MUST 生成同一种 `AiDecisionContext`
- **AND** 上下文 MUST 至少包含 `gameId`、`matchId`、`playerId`、可见状态、交互上下文、响应窗口、`legalActions`、规则版本与时间预算

#### Scenario: AI 只能看到该座位可见的信息
- **GIVEN** 某个游戏存在隐藏信息
- **WHEN** 系统为 AI 生成 `AiDecisionContext`
- **THEN** 系统 MUST 仅提供经过 `playerView` 过滤后的可见状态
- **AND** 不得把对手手牌、牌堆顺序或其他隐藏信息直接暴露给 AI

### Requirement: AI 座位控制器
系统 SHALL 以 seat controller 的方式统一管理人类玩家、本地 AI 和远程 AI。

#### Scenario: 本地 AI 座位自动接管回合
- **GIVEN** 某个座位配置为 `local-ai`
- **WHEN** 轮到该座位操作或响应
- **THEN** 系统 MUST 自动触发本地 policy 求解
- **AND** 求解结果 MUST 仍通过现有命令执行链提交

#### Scenario: 远程 AI 座位通过 provider 决策
- **GIVEN** 某个座位配置为 `remote-ai`
- **WHEN** 轮到该座位操作或响应
- **THEN** 系统 MUST 调用已注册的 `RemoteAiProvider`
- **AND** provider 的输入输出 MUST 复用统一 AI 决策契约

### Requirement: AI 决策合法性门控
系统 SHALL 先提供结构化 `legalActions`，并要求所有 AI 决策都在合法动作范围内完成。

#### Scenario: AI 选择合法动作
- **GIVEN** `AiDecisionContext.legalActions` 已生成
- **WHEN** AI 返回某个动作引用
- **THEN** 系统 MUST 能将其映射到某个合法动作
- **AND** 该动作 MUST 再经过现有 validate / execute / reduce / systems 链执行

#### Scenario: AI 返回非法动作
- **GIVEN** AI 返回了不在 `legalActions` 中的动作
- **WHEN** 系统准备执行该动作
- **THEN** 系统 MUST 拒绝执行
- **AND** 系统 MUST 记录该次失败
- **AND** 系统 MUST 进入明确的 fallback 策略，而不是让对局卡死

### Requirement: 结构化训练样本采集
系统 SHALL 以与业务日志分离的结构化样本格式采集对局决策数据，供后续分析、训练和评估复用。

#### Scenario: 成功决策写入训练样本
- **GIVEN** 某次真人或 AI 的命令执行成功
- **WHEN** 命令完成状态落盘并更新对局
- **THEN** 系统 MUST 记录一条结构化训练样本
- **AND** 样本 MUST 包含规则版本、命令、决策前后状态、交互上下文、响应窗口和 `legalActions`

#### Scenario: 训练样本按 schema 版本隔离到 raw 目录
- **GIVEN** recorder 接收到某个 `schemaVersion` 的训练样本
- **WHEN** 系统准备把样本写入本地文件存储
- **THEN** 系统 MUST 把样本写入按 `raw/v{schemaVersion}/{gameId}/{day}.jsonl` 分层的目录
- **AND** 不得把不同 schema 版本的样本混写到同一个日志文件

#### Scenario: 过期 raw 样本归档到 archive 目录
- **GIVEN** 本地训练数据采集启用了保留天数策略
- **WHEN** recorder 在新的一天执行样本写入或归档检查
- **THEN** 系统 MUST 将超过保留窗口的 raw 日志移动到对应的 `archive/v{schemaVersion}/{gameId}/` 目录
- **AND** 同一天内仍在保留窗口内的 raw 日志 MUST 继续保留在 raw 目录

#### Scenario: 训练采集失败不影响对局
- **GIVEN** recorder、文件系统或外部存储发生异常
- **WHEN** 系统尝试写入训练样本
- **THEN** 系统 MUST 记录错误或告警
- **AND** 不得回滚或阻塞该次真实对局命令

### Requirement: 桌游优先的本地策略框架
系统 SHALL 为本地逻辑 AI 提供围绕 `legalActions` 的通用评分式策略框架，并允许游戏在同一动作集合上叠加搜索，而不是把行为树作为默认总方案。

#### Scenario: 本地策略对合法动作逐个评分
- **GIVEN** 某个游戏声明支持 `local-ai`
- **WHEN** 本地 policy 接收到 `AiDecisionContext`
- **THEN** policy MUST 能基于 `legalActions` 对多个动作逐个评分
- **AND** 系统 MUST 选择总分最高的动作作为默认决策结果

#### Scenario: 同分动作保持稳定选择
- **GIVEN** 两个或多个合法动作得到相同总分
- **WHEN** 系统在评分结果中选择最终动作
- **THEN** 系统 MUST 使用稳定的 tie-break 规则
- **AND** 相同上下文下的同一 policy MUST 产生可复现的结果

#### Scenario: 搜索建立在相同动作边界上
- **GIVEN** 某个游戏后续需要使用浅层搜索或 MCTS 增强本地策略
- **WHEN** 游戏在评分框架上叠加搜索逻辑
- **THEN** 搜索 MUST 仍以当前 `legalActions` 为根动作集合
- **AND** 不得绕开统一决策契约另起一套搜索专用执行接口

### Requirement: 本地 AI 策略插件
系统 SHALL 支持每个游戏按统一接口注册本地 AI 策略，而不要求必须先有训练模型。

#### Scenario: 无训练模型时使用启发式或搜索策略
- **GIVEN** 某个游戏已经声明支持 `local-ai`
- **AND** 该游戏尚未提供训练模型
- **WHEN** 本地 AI 需要做决策
- **THEN** 系统 MUST 允许该游戏使用启发式、评分、脚本或搜索策略实现 `LocalAiPolicy`

#### Scenario: 游戏未提供本地策略
- **GIVEN** 某个游戏未声明 `local-ai` 支持
- **WHEN** 房间尝试为该游戏创建本地 AI 座位
- **THEN** 系统 MUST 拒绝该配置
- **AND** 不得通过隐式 fallback 假装该游戏支持 AI

### Requirement: 远程 AI Provider 桥接
系统 SHALL 支持通过统一 Provider 接口桥接 AstrBot、外部大模型服务或后续独立机器人进程。

#### Scenario: AstrBot 作为远程 provider 接入
- **GIVEN** 某个 `RemoteAiProvider` 实现由 AstrBot 驱动
- **WHEN** 系统向该 provider 发送 `AiDecisionContext`
- **THEN** provider MUST 返回结构化 `AiActionDecision`
- **AND** 系统 MUST 继续使用统一合法性门控和执行链

#### Scenario: 远程 provider 超时
- **GIVEN** 远程 provider 在预算时间内未返回结果
- **WHEN** 超时阈值被触发
- **THEN** 系统 MUST 执行明确的 fallback 策略
- **AND** 不得无限等待导致整局停滞

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

### Requirement: AI Ordered Multi-Selection Enumeration
The game AI system SHALL distinguish ordered multi-selection from unordered multi-selection when generating legal actions for local AI.

#### Scenario: Ordered multi-selection enumerates permutations
- **GIVEN** a local AI seat faces a `simple-choice` interaction with ordered multi-selection
- **WHEN** two selectable options `A` and `B` are both legal
- **THEN** the AI SHALL treat `A -> B` and `B -> A` as distinct legal actions

#### Scenario: Unordered multi-selection remains combination-based
- **GIVEN** a local AI seat faces a `simple-choice` interaction with unordered multi-selection
- **WHEN** two selectable options `A` and `B` are both legal
- **THEN** the AI MAY treat `A + B` as one combination action
- **AND** it SHALL NOT duplicate the same action solely by reordering equivalent option ids

### Requirement: 准备阶段 AI 选角/选派系去重
系统 SHALL 要求本地 AI 在准备阶段优先选择未被其他玩家占用的角色或派系；当未占用候选耗尽时，允许回退到全量候选。

#### Scenario: DiceThrone 选角去重
- **GIVEN** DiceThrone 处于选角阶段，且已有玩家选择了角色
- **WHEN** AI 构建 `setup-select-character` 的候选动作
- **THEN** 候选列表 MUST 排除已被选择的角色（若仍有未占用候选）
- **AND** 当未占用候选为空时 MUST 允许回退到全量角色集合

#### Scenario: SmashUp 选派系去重
- **GIVEN** SmashUp 处于选派系阶段且 `takenFactions` 已记录占用派系
- **WHEN** AI 生成派系选择动作
- **THEN** 候选派系 MUST 优先来自未被占用的派系列表
- **AND** 当未占用派系为空时 MUST 允许回退到全量派系列表

#### Scenario: Summoner Wars 选派系去重
- **GIVEN** Summoner Wars 处于选派系阶段且存在已被选择的阵营
- **WHEN** AI 生成 `setup-select-faction` 动作
- **THEN** 候选阵营 MUST 排除已占用阵营（若仍有未占用候选）
- **AND** 当未占用候选为空时 MUST 允许回退到全量阵营列表

### Requirement: 准备阶段随机扰动独立于玩法难度随机性
系统 SHALL 在准备阶段为本地 AI 注入可复现的随机扰动，即便该难度档位的玩法随机性为 0。

#### Scenario: 专家难度仍具备选角随机扰动
- **GIVEN** AI 难度为 `expert` 且玩法随机性为 0
- **WHEN** AI 在准备阶段评估角色/派系选择动作
- **THEN** 评分流程 MUST 注入可复现的随机扰动
- **AND** 扰动仅用于准备阶段的非玩法决策

### Requirement: 响应窗口优先级规则
系统 SHALL 在响应窗口中优先选择能“阻止立即失败或确保立即得分”的动作，避免节奏型决策压过关键反应。

#### Scenario: 阻止立即失败的响应优先
- **GIVEN** 响应窗口存在可阻止立即失败的合法动作
- **WHEN** AI 在响应窗口进行决策
- **THEN** AI MUST 优先选择该动作
- **AND** 不得被常规节奏或资源型动作覆盖

#### Scenario: 确保立即得分的响应优先
- **GIVEN** 响应窗口存在可确保立即得分或立刻结算优势的合法动作
- **WHEN** AI 在响应窗口进行决策
- **THEN** AI MUST 优先选择该动作

### Requirement: DiceThrone AI 锁骰/重投策略
系统 SHALL 为 DiceThrone 的本地 AI 提供锁骰/重投策略，使其在掷骰阶段优先锁定最高价值能力所需骰子，并对剩余骰子进行重投评估。

#### Scenario: 当前骰面已满足最高价值能力
- **GIVEN** 当前骰面已满足本回合最高价值能力
- **WHEN** AI 进行锁骰/重投决策
- **THEN** AI MUST 锁定全部骰子并结束掷骰

#### Scenario: 部分骰子可构成最高价值能力
- **GIVEN** 当前骰面中已有部分骰子满足最高价值能力的必要条件
- **WHEN** AI 进行锁骰/重投决策
- **THEN** AI MUST 锁定该部分骰子
- **AND** 对剩余骰子执行重投或继续评估以提升命中概率

#### Scenario: 无显著收益时重投全部
- **GIVEN** 当前骰面无法有效匹配高价值能力或升级路径
- **WHEN** AI 进行锁骰/重投决策
- **THEN** AI SHOULD 优先选择重投全部未锁骰子以追求更高价值结果

### Requirement: DiceThrone AI 防御与资源权衡
系统 SHALL 在 DiceThrone 回合决策中综合评估生命值、安全性与资源效率，避免单纯追求进攻导致可预见的失误。

#### Scenario: 低生命值优先防御
- **GIVEN** AI 生命值处于高风险区间且存在有效防御/减伤/回血动作
- **WHEN** AI 选择行动
- **THEN** AI MUST 优先选择防御或生存类动作

#### Scenario: 资源不足时优先回收或积累
- **GIVEN** AI 当前资源不足以支持高价值攻击能力
- **WHEN** AI 在多个合法动作中择优
- **THEN** AI MUST 优先选择能恢复或积累关键资源的动作

### Requirement: SmashUp AI 基地评分与节奏优先级
系统 SHALL 在 SmashUp 中为 AI 提供“临近结算优先”的基地评分策略，优先围绕即将评分的基地进行投放或干扰。

#### Scenario: 临近评分基地优先投入力量
- **GIVEN** 某基地接近评分阈值且 AI 有可投放力量的动作
- **WHEN** AI 选择行动
- **THEN** AI MUST 优先在该基地投入力量或触发有利效果

#### Scenario: 可阻止对手立即评分
- **GIVEN** 对手即将触发基地评分且 AI 有可干扰动作
- **WHEN** AI 选择行动
- **THEN** AI MUST 优先执行干扰或阻止评分的动作

### Requirement: SmashUp AI 行动卡时机控制
系统 SHALL 要求 SmashUp AI 在使用关键行动卡时考虑“立即收益”与“保留时机”，避免过早浪费高价值行动卡。

#### Scenario: 无立即收益时保留关键行动卡
- **GIVEN** 当前行动卡无法产生立即收益且存在更高价值的后续窗口
- **WHEN** AI 选择行动
- **THEN** AI MUST 避免在当前窗口消耗该行动卡

### Requirement: Summoner Wars 召唤师安全优先
系统 SHALL 在 Summoner Wars 中将召唤师安全作为最高优先级，确保 AI 不会在明显被击杀的情形下忽视防护动作。

#### Scenario: 召唤师面临击杀风险时先防守
- **GIVEN** 召唤师在下一回合存在被击杀风险
- **WHEN** AI 选择行动
- **THEN** AI MUST 优先采取保护、撤退或阻挡动作

### Requirement: Summoner Wars 击杀与魔力经济平衡
系统 SHALL 在 Summoner Wars 中平衡击杀机会与魔力经济，避免仅堆积单位或仅追求击杀而忽略长期资源。

#### Scenario: 存在可确认击杀时优先完成击杀
- **GIVEN** AI 拥有明确可完成击杀的合法动作
- **WHEN** AI 选择行动
- **THEN** AI MUST 优先选择该击杀动作

#### Scenario: 无击杀窗口时优先魔力收益
- **GIVEN** 当前不存在可确认击杀的窗口
- **WHEN** AI 在可选动作中择优
- **THEN** AI MUST 优先选择能带来魔力收益或资源积累的动作

### Requirement: 目标型 activated ability SHALL 展开为目标候选动作
当能力声明需要目标选择时，系统 SHALL 生成按目标展开的候选动作，并在通用合法性校验通过后进入 AI 评分。

#### Scenario: 支持的单目标能力生成多条候选动作
- **GIVEN** 某能力 requiresTargetSelection 且 count=1，目标类型为 unit 或 position
- **WHEN** AI 构建 activated ability 的合法动作候选
- **THEN** 系统 MUST 按可选目标展开为多条动作
- **AND** 每条动作 MUST 通过合法性校验后才进入评分

#### Scenario: 不支持的目标类型保持保守跳过
- **GIVEN** 目标类型为 card 或 count != 1
- **WHEN** AI 构建 activated ability 的合法动作候选
- **THEN** 系统 MUST 跳过该能力的目标展开

### Requirement: 目标语义 SHALL 影响评分并引导选择高价值目标
系统 SHALL 使用目标语义（归属、类型、关键距离、生命等）对候选目标进行评分，引导选择更符合战术意图的目标。

#### Scenario: 敌方目标优先压制
- **GIVEN** 目标候选包含敌方与友方单位
- **WHEN** AI 评估目标型 activated ability
- **THEN** 系统 MUST 将敌方目标标记为压制/进攻语义并提升其评分权重

#### Scenario: 友方目标优先保护或强化
- **GIVEN** 目标候选包含友方召唤师或冠军单位
- **WHEN** AI 评估目标型 activated ability
- **THEN** 系统 MUST 将友方关键单位标记为防守/增益语义并提升其评分权重

### Requirement: 回合制 AI SHALL 使用显式语义 hints 描述动作含义
系统 SHALL 允许 `legalActions` 及其来源候选携带 AI-only 语义 hints，用于表达目标关系、效果意图、收益风险与必要的特例覆盖，而不是只依赖动作类型或选项顺序推断。

#### Scenario: 友军与敌军目标语义被显式表达
- **GIVEN** 某个合法动作会指向玩家、单位、基地或卡牌目标
- **WHEN** 游戏为该动作或其候选目标生成 AI 语义信息
- **THEN** 语义 hints MUST 能表达该目标相对行动者是 `self`、`ally`、`enemy` 或 `neutral`
- **AND** 语义 hints MUST 能表达该动作更接近 `buff`、`debuff`、`destroy`、`move`、`inspect`、`resource` 或其他明确意图

#### Scenario: 通用语义不足时使用受控 override
- **GIVEN** 某个动作的真实语义不能仅靠目标关系与效果意图表达
- **WHEN** 游戏提供额外的 AI 语义信息
- **THEN** 游戏 MAY 提供如 `priorityHint`、`forcedTargetPolicy` 等受控 override
- **AND** 不得退化为散落在各处、无法复用的裸 `sourceId` if-else 体系

### Requirement: 公共 AI 层与游戏适配层 SHALL 明确分工
系统 SHALL 将回合制 AI 的通用框架能力收敛到公共层，并要求游戏层通过统一适配边界接入，而不是重复实现评分、搜索、预算与 trace 管理。

#### Scenario: 公共层统一管理框架能力
- **GIVEN** 任意游戏接入回合制 AI 框架
- **WHEN** 系统执行动作评分、搜索、预算控制、稳定 tie-break 或 trace 记录
- **THEN** 这些能力 MUST 由公共 AI 层统一提供
- **AND** 游戏层不得各自维护第二套同职能框架实现

#### Scenario: 游戏层专注提供语义与评估
- **GIVEN** 某个游戏实现自己的 AI 适配器
- **WHEN** 该适配器接入公共 AI 层
- **THEN** 适配器 MUST 至少能够提供合法动作、语义 hints、局面评估或动作估值能力
- **AND** 适配器 MAY 提供动作剪枝、隐藏信息采样和少量 rollout hook

### Requirement: AI 决策 trace SHALL 保持结构化且可解释
系统 SHALL 为本地回合制 AI 输出统一的结构化决策 trace，使调试者能够看见候选动作、语义 hints、评分贡献、搜索增量和最终 tie-break 结果。

#### Scenario: 评分式决策输出可解释 trace
- **GIVEN** 本地 AI 通过 scorer 对多个合法动作逐个打分
- **WHEN** 系统输出最终 `AiActionDecision`
- **THEN** 系统 MUST 能同时输出结构化 trace
- **AND** trace MUST 至少包含候选动作列表、每个动作的分数贡献和最终选中原因

#### Scenario: 搜索增强继续复用同一 trace 契约
- **GIVEN** 某个动作在基础评分之外还叠加了 lookahead、rollout 或其他搜索增量
- **WHEN** 系统记录该动作的决策过程
- **THEN** 搜索增量 MUST 作为同一 trace 契约中的一部分记录下来
- **AND** 不得另起一套与基础 scorer 互不兼容的调试输出格式

### Requirement: AI Legal Actions SHALL Be Generated From Choice Requests

The game AI system SHALL generate legal actions for request-owned blocking choices from Choice Requests rather than from UI surface names or game-specific duplicate candidate lists.

#### Scenario: UI shell changes but choice remains the same
- **GIVEN** a target-selection choice is rendered as a simple-choice modal in one view and as direct board selection in another view
- **WHEN** an AI-controlled seat receives the same visible choice
- **THEN** the AI legal action list MUST be generated from the same Choice Request
- **AND** the result MUST NOT depend on whether the human UI currently uses a modal, board highlight, dice panel, or card highlight

#### Scenario: Choice Request maps to a domain command
- **GIVEN** an AI chooses a legal action generated from a Choice Request
- **WHEN** the system prepares the action for execution
- **THEN** the action MUST resolve through the request's declared command mapping or owner callback
- **AND** the command MUST still pass the normal validate / execute / reduce / systems pipeline

### Requirement: AI Policies SHALL Cover Every AI-Controllable Choice Kind

The game AI system SHALL require a shared or game-specific policy for every Choice Request kind that can block an AI-controlled seat.

#### Scenario: Generic policy covers simple resolution
- **GIVEN** a request is optional skip, pass, confirm-current, or single forced candidate
- **WHEN** no game-specific strategy is needed
- **THEN** the shared AI policy MAY resolve it deterministically
- **AND** the resulting choice MUST still be represented as a normal legal action selection

#### Scenario: Game-specific policy is missing
- **GIVEN** a Choice Request kind requires game-specific strategy or target scoring
- **AND** the game has not registered a policy for that kind
- **WHEN** that request is assigned to an AI-controlled seat
- **THEN** the AI system MUST report a missing-policy diagnostic
- **AND** it MUST NOT silently return an empty action list as if the AI chose to wait

### Requirement: AI-Owned Choice Requests SHALL Resolve Or Fail Close

The game AI system SHALL ensure that an AI-owned Choice Request either resolves with a legal action, explicitly skips/passes/confirms when allowed, or fails close with diagnostics.

#### Scenario: Optional choice has no valuable candidate
- **GIVEN** an AI-owned request permits skip or pass
- **WHEN** the policy determines no candidate should be selected
- **THEN** the AI system MUST submit the explicit skip or pass legal action
- **AND** it MUST NOT leave the request open without an action

#### Scenario: Mandatory choice has no enabled candidate
- **GIVEN** an AI-owned request requires at least one enabled candidate
- **AND** the visible candidate set is empty, disabled, or below the minimum selection count
- **WHEN** AI legal actions are generated
- **THEN** the system MUST classify the request as invalid or unresolved
- **AND** it MUST emit diagnostics for recovery and feedback instead of waiting for a watchdog timeout

### Requirement: Human And AI Choice Parity SHALL Be Verified For Migrated Games

Migrated games SHALL prove that human-visible Choice Request candidates and AI legal actions remain aligned for every AI-controllable blocking choice.

#### Scenario: First-batch game migrates a choice family
- **GIVEN** Mage Wars, Qidahen, Betrayal, the DiceThrone / 王权骰铸 generic choice bridge, or a new in-progress game migrates a blocking choice family
- **WHEN** tests build a visible Choice Request for a human seat and an AI seat under equivalent visible information
- **THEN** every enabled human candidate MUST map to an AI legal action or explicit skip/pass/confirm action
- **AND** any intentional human-only decision MUST be declared unsupported before it can block an AI seat

