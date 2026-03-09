# Requirements Document

## Introduction

本文档定义 Cardia 游戏能力系统的完整实现需求。Cardia 是一个双人对抗卡牌游戏，玩家通过打出卡牌进行遭遇对抗，失败方可以发动卡牌能力。系统需要实现 32 张卡牌的能力逻辑，包括即时能力和持续能力，涵盖资源操作、影响力修正、信息控制和特殊胜利条件等多种效果类型。

## Glossary

- **System**: Cardia 能力系统（Cardia Ability System）
- **Ability_Registry**: 能力注册表，存储所有能力定义
- **Ability_Executor**: 能力执行器，负责执行能力效果
- **Validator**: 验证器，检查能力是否可以发动
- **Reducer**: 状态更新器，根据事件更新游戏状态
- **Interaction_Handler**: 交互处理器，处理玩家选择和输入
- **Encounter**: 遭遇，一次双方打牌对抗的完整流程
- **Influence**: 影响力，卡牌的基础数值
- **Modifier_Token**: 修正标记，用于修改卡牌影响力（+1/-3/+5）
- **Ongoing_Token**: 持续标记，标记持续能力生效
- **Signet**: 印戒，胜利条件资源，放置在获胜的卡牌上
- **Instant_Ability**: 即时能力，失败时触发一次
- **Ongoing_Ability**: 持续能力，失败时激活并持续生效
- **Faction**: 派系，卡牌所属的四大阵营之一（沼泽/学院/公会/王朝）
- **Played_Card**: 已打出的卡牌，位于场区的卡牌
- **Hand**: 手牌区
- **Deck**: 牌库
- **Discard_Pile**: 弃牌堆
- **Supply**: 补给区，存放未使用的印戒和标记

## Requirements

### Requirement 1: 能力触发规则

**User Story:** 作为玩家，我希望只有失败的卡牌才能发动能力，以符合游戏核心规则。

#### Acceptance Criteria

1. WHEN 遭遇结算完成且存在失败方，THE System SHALL 允许失败方发动其卡牌能力
2. WHEN 遭遇结果为平局，THE System SHALL 跳过能力阶段
3. WHEN 能力改变过去遭遇结果，THE System SHALL 不重新触发过去失败卡牌的能力
4. WHEN 修正影响力改变遭遇结果，THE System SHALL 移动印戒但不触发新失败卡牌的能力
5. THE System SHALL 在判定胜负前先结算完所有场上能力效果

### Requirement 2: 即时能力执行

**User Story:** 作为玩家，我希望即时能力能够立即执行并产生效果，以便快速推进游戏。

#### Acceptance Criteria

1. WHEN 玩家选择发动即时能力，THE Ability_Executor SHALL 立即执行该能力的所有效果
2. WHEN 即时能力执行完成，THE System SHALL 不保留任何持续状态
3. WHEN 即时能力需要玩家选择目标，THE System SHALL 创建交互请求并等待玩家响应
4. WHEN 即时能力执行失败（如无效目标），THE System SHALL 回滚状态并提示错误
5. THE Ability_Executor SHALL 按照能力定义中的 effects 数组顺序依次执行效果

### Requirement 3: 持续能力管理

**User Story:** 作为玩家，我希望持续能力能够持续生效直到被移除，以实现长期战略效果。

#### Acceptance Criteria

1. WHEN 玩家发动持续能力，THE System SHALL 在该卡牌上放置持续标记
2. WHILE 持续标记存在，THE System SHALL 持续应用该能力效果
3. WHEN 持续标记被移除，THE System SHALL 立即停止应用该能力效果并回溯结算所有影响
4. THE System SHALL 支持同一卡牌上存在多个持续标记
5. WHEN 持续能力影响遭遇结果，THE System SHALL 在结算遭遇时自动应用该效果

### Requirement 4: 影响力修正系统

**User Story:** 作为玩家，我希望能够通过修正标记改变卡牌影响力，以扭转遭遇结果。

#### Acceptance Criteria

1. WHEN 能力添加修正标记到卡牌，THE System SHALL 更新该卡牌的当前影响力
2. THE System SHALL 支持三种修正标记类型：+1、-3、+5
3. WHEN 计算卡牌最终影响力，THE System SHALL 将基础影响力与所有修正标记相加
4. WHEN 修正标记改变遭遇结果，THE System SHALL 移动印戒到新的获胜卡牌
5. THE System SHALL 允许同一卡牌上叠加多个修正标记

### Requirement 5: 资源操作能力

**User Story:** 作为玩家，我希望能够通过能力操作手牌、牌库和弃牌堆，以获得战术优势。

#### Acceptance Criteria

1. WHEN 能力要求抽牌，THE System SHALL 从玩家牌库顶抽取指定数量的牌到手牌
2. WHEN 能力要求弃牌，THE System SHALL 将指定卡牌从手牌移动到弃牌堆
3. WHEN 能力要求回收卡牌，THE System SHALL 将指定卡牌从弃牌堆移动到手牌
4. WHEN 能力要求混洗牌库，THE System SHALL 随机打乱玩家牌库顺序
5. WHEN 牌库为空且需要抽牌，THE System SHALL 不执行抽牌操作（不自动回收弃牌堆）

### Requirement 6: 派系选择能力

**User Story:** 作为玩家，我希望能够选择派系并对该派系的卡牌执行操作，以针对性地削弱对手。

#### Acceptance Criteria

1. WHEN 能力需要选择派系，THE Interaction_Handler SHALL 创建派系选择交互
2. THE System SHALL 提供四个派系选项：沼泽、学院、公会、王朝
3. WHEN 玩家选择派系后，THE Ability_Executor SHALL 过滤出该派系的所有目标卡牌
4. WHEN 能力要求弃掉派系手牌，THE System SHALL 将对手手牌中该派系的所有卡牌移动到弃牌堆
5. WHEN 能力要求弃掉派系牌库，THE System SHALL 将对手牌库中该派系的所有卡牌移动到弃牌堆

### Requirement 7: 卡牌选择交互

**User Story:** 作为玩家，我希望能够选择场上或手牌中的卡牌作为能力目标，以精确控制能力效果。

#### Acceptance Criteria

1. WHEN 能力需要选择卡牌，THE Interaction_Handler SHALL 创建卡牌选择交互
2. THE System SHALL 根据能力定义过滤可选卡牌（如"影响力≤8"、"即时能力"）
3. WHEN 玩家选择卡牌后，THE Ability_Executor SHALL 对选中的卡牌执行效果
4. WHEN 没有可选卡牌，THE System SHALL 跳过该能力效果
5. THE System SHALL 支持多步骤选择（如先选择+3目标，再选择-3目标）

### Requirement 8: 能力复制机制

**User Story:** 作为玩家，我希望能够复制其他卡牌的能力，以重复使用强力效果。

#### Acceptance Criteria

1. WHEN 能力要求复制其他卡牌能力，THE System SHALL 创建可复制卡牌列表
2. THE System SHALL 只允许复制即时能力，不允许复制持续能力
3. WHEN 玩家选择要复制的卡牌，THE Ability_Executor SHALL 执行该卡牌的能力效果
4. WHEN 复制的能力需要玩家选择，THE System SHALL 创建新的交互请求
5. THE System SHALL 不触发被复制卡牌的原始能力（仅复制效果）

### Requirement 9: 印戒管理系统

**User Story:** 作为玩家，我希望印戒能够正确放置在获胜卡牌上并计入总数，以追踪胜利进度。

#### Acceptance Criteria

1. WHEN 遭遇结算后存在获胜方，THE System SHALL 在获胜卡牌上放置1枚印戒
2. THE System SHALL 将印戒放置在卡牌上而非玩家总池
3. WHEN 计算玩家印戒总数，THE System SHALL 统计场上所有己方卡牌上的印戒之和
4. WHEN 能力要求额外印戒，THE System SHALL 在指定卡牌上额外放置1枚印戒
5. WHEN 修正影响力改变遭遇结果，THE System SHALL 移动印戒到新的获胜卡牌

### Requirement 10: 胜利条件检测

**User Story:** 作为玩家，我希望系统能够自动检测胜利条件并结束游戏，以明确游戏结果。

#### Acceptance Criteria

1. WHEN 回合结束阶段，THE System SHALL 检查玩家场上所有卡牌的印戒总和
2. WHEN 玩家印戒总和≥5，THE System SHALL 判定该玩家获胜并结束游戏
3. WHEN 能力直接声明"你赢得游戏"，THE System SHALL 立即判定该玩家获胜
4. WHEN 双方印戒总和均≥5且相等，THE System SHALL 继续游戏直到分出多少
5. WHEN 对手无法出牌，THE System SHALL 判定当前玩家获胜

### Requirement 11: 能力验证规则

**User Story:** 作为玩家，我希望系统能够阻止无效的能力发动，以避免浪费操作。

#### Acceptance Criteria

1. WHEN 玩家尝试发动能力，THE Validator SHALL 检查该卡牌是否为失败方
2. WHEN 能力需要目标但无可选目标，THE Validator SHALL 拒绝发动该能力
3. WHEN 能力需要资源但资源不足（如牌库为空），THE Validator SHALL 允许发动但跳过无效效果
4. WHEN 能力有条件限制（如"影响力≤8"），THE Validator SHALL 检查是否满足条件
5. THE Validator SHALL 在能力执行前完成所有验证

### Requirement 12: 状态回溯机制

**User Story:** 作为玩家，我希望持续能力被移除时能够正确回溯状态，以保证游戏逻辑正确性。

#### Acceptance Criteria

1. WHEN 持续标记被移除，THE System SHALL 重新计算所有受影响卡牌的影响力
2. WHEN 持续能力影响遭遇结果，THE System SHALL 重新判定遭遇胜负并移动印戒
3. THE System SHALL 按照时间顺序回溯所有受影响的遭遇
4. WHEN 回溯改变遭遇结果，THE System SHALL 不触发新失败卡牌的能力
5. THE System SHALL 在回溯完成后更新所有相关状态

### Requirement 13: 特殊能力实现 - 傀儡师

**User Story:** 作为玩家，我希望傀儡师能够替换对手卡牌且不触发对手能力，以实现独特的战术效果。

#### Acceptance Criteria

1. WHEN 傀儡师能力发动，THE System SHALL 弃掉相对的对手卡牌
2. THE System SHALL 从对手手牌中随机抽取1张卡牌
3. THE System SHALL 将抽取的卡牌放置到对手场区原位置
4. THE System SHALL 标记该卡牌为"被替换"状态，不触发其能力
5. WHEN 遭遇重新结算，THE System SHALL 使用新卡牌的影响力计算结果

### Requirement 14: 特殊能力实现 - 调停者/审判官

**User Story:** 作为玩家，我希望调停者能够强制平局，审判官能够赢得所有平局，以实现持续能力的战略价值。

#### Acceptance Criteria

1. WHEN 调停者持续标记存在，THE System SHALL 在遭遇结算时强制结果为平局
2. WHEN 审判官持续标记存在，THE System SHALL 将所有平局判定为该玩家获胜
3. WHEN 审判官和调停者同时存在，THE System SHALL 优先应用审判官效果（平局→获胜）
4. WHEN 平局被强制或转换，THE System SHALL 跳过能力阶段
5. THE System SHALL 在遭遇结算前应用这些持续效果

### Requirement 15: 特殊能力实现 - 继承者

**User Story:** 作为玩家，我希望继承者能够大规模削弱对手资源，以实现终局翻盘效果。

#### Acceptance Criteria

1. WHEN 继承者能力发动，THE Interaction_Handler SHALL 要求对手选择保留2张手牌
2. THE System SHALL 将对手未选择的所有手牌移动到弃牌堆
3. THE System SHALL 将对手整个牌库移动到弃牌堆
4. THE System SHALL 保留对手选择的2张手牌
5. WHEN 对手手牌不足2张，THE System SHALL 保留所有手牌并弃掉牌库

### Requirement 16: 特殊能力实现 - 机械精灵

**User Story:** 作为玩家，我希望机械精灵能够在下次遭遇获胜时直接赢得游戏，以实现条件胜利。

#### Acceptance Criteria

1. WHEN 机械精灵能力发动，THE System SHALL 在该卡牌上放置持续标记
2. WHILE 机械精灵持续标记存在，THE System SHALL 监控下一次遭遇结果
3. WHEN 下一次遭遇该玩家获胜，THE System SHALL 立即判定该玩家赢得游戏
4. WHEN 下一次遭遇该玩家失败或平局，THE System SHALL 移除机械精灵持续标记
5. THE System SHALL 在遭遇结算后立即检查机械精灵条件

### Requirement 17: 能力执行顺序

**User Story:** 作为开发者，我希望能力效果按照明确的顺序执行，以保证游戏逻辑的确定性。

#### Acceptance Criteria

1. THE Ability_Executor SHALL 按照能力定义中的 effects 数组顺序执行效果
2. WHEN 能力包含多个效果，THE System SHALL 等待前一个效果完成后再执行下一个
3. WHEN 效果需要玩家交互，THE System SHALL 暂停执行并等待玩家响应
4. WHEN 效果执行失败，THE System SHALL 跳过该效果并继续执行后续效果
5. THE System SHALL 在所有效果执行完成后更新游戏状态

### Requirement 18: 错误处理与回滚

**User Story:** 作为开发者，我希望系统能够处理异常情况并回滚状态，以保证游戏稳定性。

#### Acceptance Criteria

1. WHEN 能力执行过程中发生错误，THE System SHALL 记录错误日志
2. THE System SHALL 回滚到能力执行前的状态
3. THE System SHALL 向玩家显示错误提示信息
4. WHEN 交互超时或无效，THE System SHALL 取消能力执行
5. THE System SHALL 保证状态一致性，不留下部分执行的效果

### Requirement 19: 能力效果可组合性

**User Story:** 作为开发者，我希望能力效果能够灵活组合，以支持复杂的能力设计。

#### Acceptance Criteria

1. THE System SHALL 支持单个能力包含多个效果（如"弃牌+抽牌"）
2. THE System SHALL 支持效果之间的依赖关系（如"弃牌后复制其能力"）
3. THE System SHALL 支持条件效果（如"如果满足条件则执行"）
4. THE System SHALL 支持延迟效果（如"下一次遭遇时执行"）
5. THE System SHALL 通过配置而非硬编码实现效果组合

### Requirement 20: 测试与调试支持

**User Story:** 作为开发者，我希望系统提供测试和调试工具，以便快速验证能力实现。

#### Acceptance Criteria

1. THE System SHALL 提供能力执行日志，记录每个效果的执行结果
2. THE System SHALL 支持单元测试框架，可独立测试每个能力
3. THE System SHALL 提供状态快照功能，可保存和恢复游戏状态
4. THE System SHALL 支持模拟玩家交互，可自动化测试需要选择的能力
5. THE System SHALL 提供能力注册表完整性检查，确保所有能力都已注册

