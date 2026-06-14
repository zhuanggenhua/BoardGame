## ADDED Requirements

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
