# Requirements Document

## Introduction

本文档定义 Cardia 游戏的 AI 对手机制需求。Cardia 是一个基于卡牌的回合制对战游戏,玩家通过打出卡牌进行遭遇战,目标是在场上累积 5 枚印戒获胜。AI 对手需要能够进行基本的游戏决策,包括选择卡牌、激活能力、管理资源等,并支持不同的策略倾向。

AI 系统将复用项目统一的引擎层 AI 框架 (`src/engine/ai/`),参考 Dice Throne 和 Summoner Wars 的实现模式,使用策略标签系统 (`AiStrategyProfile` + `LocalAiActionScorer`) 实现可配置的决策行为。

## Glossary

- **AI_System**: Cardia 游戏的 AI 决策系统,负责为 AI 玩家生成合法动作并评分
- **Strategy_Profile**: AI 策略配置文件,定义 AI 的行为倾向和标签权重
- **Legal_Action**: 合法动作,包含一个或多个命令的完整决策单元
- **Action_Scorer**: 动作评分器,根据策略配置为动作打分
- **Strategy_Tag**: 策略标签,用于标记动作的战术特征 (如 'aggro', 'control', 'economy')
- **Encounter**: 遭遇战,双方各打出一张卡牌进行影响力对抗的回合
- **Influence**: 影响力,卡牌的战斗力数值,决定遭遇战胜负
- **Signet**: 印戒,放置在获胜卡牌上的标记,累积 5 枚获胜
- **Ability**: 卡牌能力,只有输掉遭遇战的卡牌才能激活
- **Modifier**: 修正标记,用于增减卡牌影响力的标记 (+1/-3/+5)
- **Ongoing_Ability**: 持续能力,带有持续标记的能力,效果永久生效

## Requirements

### Requirement 1: AI 决策系统初始化

**User Story:** 作为游戏引擎,我需要初始化 AI 决策系统,以便 AI 玩家能够参与游戏

#### Acceptance Criteria

1. THE AI_System SHALL 实现 `GameAiRuntime` 接口
2. WHEN 游戏开始时,THE AI_System SHALL 注册到引擎的 AI 运行时
3. THE AI_System SHALL 支持配置 Strategy_Profile 参数
4. THE AI_System SHALL 复用 `src/engine/ai/` 框架的核心类型和工具函数

### Requirement 2: 打牌阶段决策

**User Story:** 作为 AI 玩家,我需要在打牌阶段选择合适的卡牌,以便参与遭遇战

#### Acceptance Criteria

1. WHEN 轮到 AI 玩家打牌时,THE AI_System SHALL 枚举手牌中所有可打出的卡牌
2. FOR ALL 可打出的卡牌,THE AI_System SHALL 生成对应的 Legal_Action
3. THE AI_System SHALL 为每个打牌动作标记 Strategy_Tag
4. WHEN 评估打牌动作时,THE AI_System SHALL 考虑卡牌影响力、派系、能力类型和当前场面状态
5. THE AI_System SHALL 使用 Action_Scorer 根据 Strategy_Profile 为动作打分
6. THE AI_System SHALL 选择得分最高的动作执行

### Requirement 3: 能力激活决策

**User Story:** 作为 AI 玩家,我需要在输掉遭遇战后决定是否激活能力,以便获得战术优势

#### Acceptance Criteria

1. WHEN AI 玩家输掉遭遇战时,THE AI_System SHALL 检查输掉的卡牌是否有可激活能力
2. IF 卡牌有可激活能力,THEN THE AI_System SHALL 生成激活能力和跳过能力两种 Legal_Action
3. THE AI_System SHALL 评估激活能力的预期收益 (印戒变化、资源变化、场面控制)
4. THE AI_System SHALL 为能力激活动作标记 Strategy_Tag (如 'tempo', 'value', 'control')
5. WHEN 能力需要选择目标时,THE AI_System SHALL 枚举所有合法目标并生成对应动作
6. THE AI_System SHALL 根据 Strategy_Profile 决定是否激活能力

### Requirement 4: 交互选择决策

**User Story:** 作为 AI 玩家,我需要在能力执行过程中做出选择,以便完成能力效果

#### Acceptance Criteria

1. WHEN 能力需要选择卡牌目标时,THE AI_System SHALL 枚举所有合法目标卡牌
2. WHEN 能力需要选择派系时,THE AI_System SHALL 枚举所有可选派系
3. WHEN 能力需要选择修正标记时,THE AI_System SHALL 枚举所有可用修正标记类型
4. FOR ALL 交互选择,THE AI_System SHALL 生成对应的 Legal_Action
5. THE AI_System SHALL 评估每个选择的战术价值
6. WHEN 交互支持多选时,THE AI_System SHALL 枚举合法的选择组合

### Requirement 5: 策略标签系统

**User Story:** 作为 AI 设计者,我需要定义策略标签,以便区分不同类型的战术动作

#### Acceptance Criteria

1. THE AI_System SHALL 定义以下 Strategy_Tag 类型:
   - 'aggro': 进攻型动作 (打出高影响力卡牌、争夺印戒)
   - 'control': 控制型动作 (使用修正标记、移除对手印戒)
   - 'economy': 经济型动作 (抽牌、回收资源)
   - 'tempo': 节奏型动作 (激活即时能力、打断对手计划)
   - 'value': 价值型动作 (激活持续能力、长期收益)
2. THE AI_System SHALL 使用 `withAiActionStrategyTags` 为动作附加标签
3. THE AI_System SHALL 支持一个动作附加多个标签
4. THE AI_System SHALL 使用 `getAiActionStrategyTags` 读取动作标签

### Requirement 6: 策略配置文件

**User Story:** 作为游戏设计者,我需要配置不同的 AI 策略,以便提供多样化的对手

#### Acceptance Criteria

1. THE AI_System SHALL 支持定义 Strategy_Profile 配置
2. THE Strategy_Profile SHALL 包含 `tags` 字段 (偏好的策略标签列表)
3. THE Strategy_Profile SHALL 包含 `tagWeights` 字段 (标签权重映射)
4. THE Strategy_Profile SHALL 包含 `summary` 字段 (策略描述文本)
5. THE AI_System SHALL 提供至少 3 种预设策略配置:
   - 进攻型 (aggro): 优先打出高影响力卡牌,争夺印戒
   - 防守型 (control): 优先使用修正标记和控制能力
   - 平衡型 (balanced): 均衡考虑各类动作

### Requirement 7: 动作评分系统

**User Story:** 作为 AI 系统,我需要为动作打分,以便选择最优决策

#### Acceptance Criteria

1. THE AI_System SHALL 使用 `createProfileAwareActionScorer` 创建评分器
2. THE Action_Scorer SHALL 根据动作的 Strategy_Tag 和 Strategy_Profile 计算匹配分数
3. THE Action_Scorer SHALL 使用 `scoreActionAgainstStrategyProfile` 计算基础分数
4. THE AI_System SHALL 支持自定义评分逻辑 (如考虑场面状态、手牌数量)
5. THE AI_System SHALL 使用 `buildDeterministicAiNoise` 添加随机扰动,避免完全确定性
6. THE AI_System SHALL 选择得分最高的动作作为最终决策

### Requirement 8: 卡牌选择启发式

**User Story:** 作为 AI 系统,我需要评估卡牌的战术价值,以便做出合理的打牌决策

#### Acceptance Criteria

1. WHEN 评估打牌动作时,THE AI_System SHALL 考虑卡牌基础影响力
2. WHEN 评估打牌动作时,THE AI_System SHALL 考虑卡牌能力类型 (即时/持续)
3. WHEN 评估打牌动作时,THE AI_System SHALL 考虑当前场面印戒分布
4. WHEN 评估打牌动作时,THE AI_System SHALL 考虑对手可能的卡牌范围
5. WHEN 评估打牌动作时,THE AI_System SHALL 考虑手牌数量和牌库剩余
6. THE AI_System SHALL 为高影响力卡牌附加 'aggro' 标签
7. THE AI_System SHALL 为带控制能力的卡牌附加 'control' 标签

### Requirement 9: 能力价值评估

**User Story:** 作为 AI 系统,我需要评估能力的价值,以便决定是否激活

#### Acceptance Criteria

1. WHEN 评估能力激活时,THE AI_System SHALL 计算预期印戒变化
2. WHEN 评估能力激活时,THE AI_System SHALL 计算预期影响力变化
3. WHEN 评估能力激活时,THE AI_System SHALL 考虑能力的持续性 (即时 vs 持续)
4. WHEN 评估能力激活时,THE AI_System SHALL 考虑能力的目标可用性
5. THE AI_System SHALL 为即时高收益能力附加 'tempo' 标签
6. THE AI_System SHALL 为持续能力附加 'value' 标签
7. THE AI_System SHALL 为资源类能力附加 'economy' 标签

### Requirement 10: 目标选择启发式

**User Story:** 作为 AI 系统,我需要选择合适的能力目标,以便最大化能力效果

#### Acceptance Criteria

1. WHEN 选择修正标记目标时,THE AI_System SHALL 优先选择接近平局的遭遇战
2. WHEN 选择印戒移除目标时,THE AI_System SHALL 优先选择对手印戒最多的卡牌
3. WHEN 选择派系时,THE AI_System SHALL 优先选择场上数量最多的派系
4. WHEN 选择卡牌目标时,THE AI_System SHALL 考虑目标卡牌的影响力和能力
5. WHEN 有多个等价目标时,THE AI_System SHALL 使用确定性随机选择

### Requirement 11: 合法动作生成

**User Story:** 作为 AI 系统,我需要生成所有合法动作,以便进行决策

#### Acceptance Criteria

1. THE AI_System SHALL 实现 `enumerateLegalActions` 函数
2. THE AI_System SHALL 根据当前游戏阶段生成对应的动作类型
3. WHEN 在打牌阶段时,THE AI_System SHALL 生成所有可打出卡牌的动作
4. WHEN 在能力阶段时,THE AI_System SHALL 生成激活能力和跳过能力的动作
5. WHEN 有交互等待时,THE AI_System SHALL 生成所有合法的交互选择动作
6. THE AI_System SHALL 使用 `createAiLegalActionId` 为每个动作生成唯一 ID
7. THE AI_System SHALL 验证生成的动作在当前状态下合法

### Requirement 12: 决策策略接口

**User Story:** 作为游戏引擎,我需要调用 AI 系统获取决策,以便驱动 AI 玩家行动

#### Acceptance Criteria

1. THE AI_System SHALL 实现 `getAiDecision` 函数
2. THE `getAiDecision` 函数 SHALL 接收当前游戏状态和 AI 玩家 ID
3. THE `getAiDecision` 函数 SHALL 返回选中的 Legal_Action
4. WHEN 没有合法动作时,THE `getAiDecision` 函数 SHALL 返回 null
5. THE AI_System SHALL 使用 `createScoredLocalAiPolicy` 或 `createLookaheadLocalAiPolicy` 实现决策逻辑
6. THE AI_System SHALL 支持配置决策延迟,模拟思考时间

### Requirement 13: 游戏状态评估

**User Story:** 作为 AI 系统,我需要评估当前游戏状态,以便做出战术决策

#### Acceptance Criteria

1. THE AI_System SHALL 实现状态评估函数
2. THE 状态评估函数 SHALL 计算双方印戒差距
3. THE 状态评估函数 SHALL 计算双方场上卡牌数量差距
4. THE 状态评估函数 SHALL 计算双方手牌数量差距
5. THE 状态评估函数 SHALL 考虑持续能力的长期价值
6. THE 状态评估函数 SHALL 返回数值评分 (正数表示 AI 优势,负数表示劣势)

### Requirement 14: 错误处理和降级

**User Story:** 作为 AI 系统,我需要处理异常情况,以便保证游戏稳定运行

#### Acceptance Criteria

1. WHEN 动作生成失败时,THE AI_System SHALL 记录错误日志
2. WHEN 动作评分失败时,THE AI_System SHALL 使用默认分数 0
3. WHEN 没有合法动作时,THE AI_System SHALL 返回 null 而不是抛出异常
4. WHEN 决策超时时,THE AI_System SHALL 选择第一个合法动作
5. THE AI_System SHALL 验证所有生成的命令在执行前合法

### Requirement 15: 测试和验证

**User Story:** 作为开发者,我需要验证 AI 系统的正确性,以便确保 AI 行为符合预期

#### Acceptance Criteria

1. THE AI_System SHALL 提供单元测试覆盖核心决策逻辑
2. THE AI_System SHALL 提供 E2E 测试验证 AI 能够完成完整对局
3. THE 测试 SHALL 验证 AI 能够在打牌阶段选择卡牌
4. THE 测试 SHALL 验证 AI 能够在能力阶段做出决策
5. THE 测试 SHALL 验证 AI 能够处理交互选择
6. THE 测试 SHALL 验证不同策略配置产生不同的行为模式
7. THE 测试 SHALL 验证 AI 不会生成非法动作

