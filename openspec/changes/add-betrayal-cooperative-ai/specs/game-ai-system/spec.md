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

### Requirement: 小黑屋 AI SHALL 覆盖第一剧本最小可玩闭环
小黑屋第一版 AI SHALL 覆盖从选角到第一剧本任一阵营结局所需的核心动作，并允许非阻塞可选动作在本轮保持未实现。

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

#### Scenario: 可选复杂动作不阻塞第一版 AI
- **GIVEN** 当前仅存在交易、搜尸、复杂持有物使用或兔脚改骰等本轮未覆盖的可选收益动作
- **WHEN** AI 评估当前回合
- **THEN** AI MAY 不选择这些可选动作
- **AND** 系统 MUST 仍允许 AI 通过其它合法推进动作或结束回合离开当前状态
