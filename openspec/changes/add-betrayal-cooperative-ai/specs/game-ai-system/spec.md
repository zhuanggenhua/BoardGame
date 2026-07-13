## ADDED Requirements

### Requirement: 小黑屋 SHALL 提供本地 AI
系统 SHALL 为小黑屋提供能通过统一合法动作与命令管线运行的本地 AI；AI 在共同探索阶段 SHALL 作为合作队友行动，并在作祟后按领域分配的真实阵营行动。

#### Scenario: 本地 AI 自动推进自己的回合
- **GIVEN** 小黑屋对局中至少一个座位配置为本地 AI
- **WHEN** 轮到该 AI 选角、处理事件、探索或执行第一剧本行动
- **THEN** 系统 MUST 从当前领域校验通过的合法命令生成 `legalActions`
- **AND** AI 的选择 MUST 继续通过 validate / execute / reduce / systems 链执行

#### Scenario: AI 不代替真人操作
- **GIVEN** 当前应操作的座位是人类玩家
- **WHEN** 系统构造小黑屋 AI 决策
- **THEN** AI MUST NOT 为该真人座位生成或提交动作

### Requirement: 小黑屋 AI SHALL 遵循真实阵营分配
系统 SHALL 以小黑屋领域状态记录的叛徒玩家为唯一阵营真相，并要求 AI 在英雄与叛徒角色之间使用不同目标策略。

#### Scenario: AI 在恶兆前合作探索
- **GIVEN** 小黑屋尚未触发作祟
- **WHEN** AI 评估移动与探索动作
- **THEN** AI MUST 优先选择能发现未知房间或推进共同探索的动作

#### Scenario: AI 被指定为叛徒
- **GIVEN** 作祟规则把某个 AI 玩家指定为叛徒
- **WHEN** 该 AI 在作祟阶段行动
- **THEN** AI MUST 使用叛徒侧合法动作追击或攻击英雄
- **AND** 不得继续使用英雄侧驱魔目标策略

#### Scenario: AI 保持英雄身份
- **GIVEN** 作祟规则把其他玩家指定为叛徒
- **WHEN** 英雄 AI 在作祟阶段行动
- **THEN** AI MUST 优先推进调查杰克、研究法阵、驱魔或攻击叛徒

### Requirement: 小黑屋 AI SHALL 覆盖第一剧本基础可玩闭环
小黑屋第一版 AI SHALL 覆盖从选角到第一剧本任一阵营结局所需的核心动作，以及剧本一正常对局中的基础持有物、交易、搜尸、改骰和房间效果动作。

#### Scenario: 恶兆前探索可持续推进
- **GIVEN** AI 处于恶兆前自己的回合
- **WHEN** 存在合法探索或移动动作
- **THEN** AI MUST 优先选择能发现未知房间或接近未知房间的动作
- **AND** 无更高价值动作时 MUST 能结束回合

#### Scenario: 英雄 AI 优先完成英雄目标
- **GIVEN** 英雄 AI 处于第一剧本作祟阶段
- **WHEN** 驱魔、研究法阵、调查杰克、攻击叛徒或目标移动中存在合法动作
- **THEN** AI MUST 按合作目标优先级选择可推进英雄胜利条件的动作
- **AND** 无可推进动作时 MUST 能安全结束回合

#### Scenario: 叛徒 AI 追击英雄
- **GIVEN** 叛徒 AI 处于第一剧本作祟阶段
- **WHEN** 攻击英雄、控制杰克之灵或向英雄移动中存在合法动作
- **THEN** AI MUST 优先选择能推进叛徒胜利条件的动作
- **AND** 无可推进动作时 MUST 能安全结束回合

### Requirement: 小黑屋 AI SHALL 执行有收益的基础规则动作
小黑屋 AI SHALL 为主动持有物、普通交易、狗的远程交易、尸体搜刮、兔脚重掷和房间效果生成领域校验通过的合法动作，并 SHALL 避免无收益消耗、交易循环和成功结果重掷。

#### Scenario: AI 主动使用持有物
- **GIVEN** AI 回合开始时已经持有可主动使用的物品或预兆
- **WHEN** 治疗、放置移动、面具移动或下一次检定准备能产生实际收益
- **THEN** AI MUST 提供该持有物所需的目标玩家、目标房间或逐目标房间参数
- **AND** 该动作 MUST 通过领域 validator 后才能进入 `legalActions`

#### Scenario: AI 执行普通交易或狗交易
- **GIVEN** 同阵营队友比当前持有者更适合使用某件持有物
- **WHEN** 队友在同房间，或 AI 可使用狗与 4 格以内队友交易
- **THEN** AI MUST 生成对应的普通交易或狗交易动作
- **AND** AI MUST NOT 交易已使用持有物、通过狗交易狗本身，或生成没有稳定收益提升的往返交易

#### Scenario: AI 搜刮尸体
- **GIVEN** AI 与一具尚未在本回合被搜刮的探索者尸体同房
- **WHEN** 尸体上存在物品或预兆
- **THEN** AI MUST 同时选择尸体玩家与具体持有物生成搜刮动作
- **AND** 立即获胜动作的优先级 MUST 高于普通搜刮收益

#### Scenario: AI 使用兔脚重掷
- **GIVEN** AI 持有当前投骰窗口可用的兔脚
- **WHEN** 最近投骰失败、攻击未成功或事件结果尚未处于最佳分支
- **THEN** AI MUST 优先选择最低点的合法骰子重掷
- **AND** 最近投骰已成功或已处于最佳分支时 AI MUST NOT 生成兔脚重掷动作

#### Scenario: AI 使用房间效果
- **GIVEN** AI 当前所在房间存在领域允许使用的房间效果
- **WHEN** AI 构造当前回合合法动作
- **THEN** AI MUST 生成房间效果候选并通过领域 validator 过滤
- **AND** 神秘电梯使用后 MUST 通过正式命令管线更新房间位置、使用次数和最近投骰

#### Scenario: AI 行动进入公开日志但不占用真人撤回
- **GIVEN** 小黑屋某个座位由本地 AI 控制
- **WHEN** AI 通过正式命令管线执行任意合法命令
- **THEN** 系统 MUST 生成与真人同格式的公开操作日志
- **AND** 撤回系统 MUST NOT 为该 AI 命令新增真人可用快照
