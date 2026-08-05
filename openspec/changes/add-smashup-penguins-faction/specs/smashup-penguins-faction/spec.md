## ADDED Requirements

### Requirement: 企鹅派系必须完整接入 Smash Up 运行时

系统 MUST 将企鹅（`penguins`）作为独立 Smash Up 派系接入，包含完整卡牌组、基地、派系选择 metadata、双语文案和运行时初始化能力。

#### Scenario: 企鹅派系可被选择并初始化
- **WHEN** 玩家在 Smash Up 派系选择界面选择企鹅
- **THEN** 系统 MUST 将企鹅作为合法派系加入玩家牌组
- **AND** 玩家牌组 MUST 包含 20 张企鹅实体卡
- **AND** 基地池 MUST 包含企鹅基地

#### Scenario: 企鹅卡牌组成与 TTS deck 构成一致
- **WHEN** 系统读取企鹅牌组定义
- **THEN** 它 MUST 包含 15 个唯一卡面
- **AND** 这 15 个唯一卡面 MUST 按 TTS deck 构成展开为 20 张实体牌
- **AND** 图集最后一格 `Penguins` 派系封面 MUST NOT 被注册成运行时手牌

#### Scenario: 企鹅帝皇复用现有泰坦实现
- **WHEN** 系统查询企鹅派系关联泰坦
- **THEN** 它 MUST 返回既有 `penguins_emperor_penguin`
- **AND** 不得新增重复的企鹅帝皇泰坦定义或覆盖现有泰坦能力实现

### Requirement: 企鹅图集必须有可审计来源合同

系统 MUST 在正式实现前锁定企鹅卡牌图集、基地图集、TTS deck 结构、单卡/单基地裁图和字段级录入合同。

#### Scenario: 卡牌 atlas 锁定
- **WHEN** intake 阶段处理企鹅卡牌图集
- **THEN** 系统 MUST 记录原始路径、尺寸、hash、4 x 4 网格、row-major 索引和每格语义
- **AND** 每个运行时卡牌 MUST 能回溯到完整单卡裁图

#### Scenario: 基地 atlas 锁定
- **WHEN** intake 阶段处理企鹅基地图集
- **THEN** 系统 MUST 记录原始路径、尺寸、hash、2 x 2 网格、TTS CardID 和每张企鹅基地槽位
- **AND** 未使用或非企鹅基地槽位 MUST 明确标记为未注册或不适用

#### Scenario: 不确定字段不得进入实现
- **WHEN** 某张企鹅卡或基地的名称、正文、限定词、数值、索引或归属仍不可读或冲突
- **THEN** 该字段 MUST 标记为 `blocked` 或 `disputed`
- **AND** implementation MUST NOT 通过猜测补写该字段

### Requirement: 企鹅玩法必须按逐卡 effect atom 实现并验证

系统 MUST 按已锁定卡图/合同逐卡实现企鹅派系的规则子句，并为每个 effect atom 提供行为验证或明确阻塞记录。

#### Scenario: 牌库顶相关效果收口到权威状态
- **WHEN** 企鹅卡牌效果展示、打出、抽取、放回、洗回或重排牌库顶牌
- **THEN** 系统 MUST 更新对应玩家牌库、手牌、场上区、弃牌区和事件记录
- **AND** 测试 MUST 断言最终权威状态而不是只断言提示出现

#### Scenario: 额外随从与通常额度区分
- **WHEN** 企鹅效果允许从牌库顶或手牌打出随从作为额外随从
- **THEN** 系统 MUST 不错误消耗通常随从额度
- **AND** 若规则写明代替通常随从或消耗额度，则 MUST 按对应卡牌子句执行

#### Scenario: 移动与基地目标合法性
- **WHEN** 企鹅效果移动随从到另一个基地
- **THEN** 系统 MUST 只提供合法基地目标
- **AND** 可选移动效果 MUST 支持跳过或空选路径

#### Scenario: 基地能力参与计分与触发链
- **WHEN** 浮冰或企鹅殖民地进入基地池并触发自身能力
- **THEN** 系统 MUST 按已锁定基地正文结算
- **AND** 计分后、回合开始或打出后触发的效果 MUST 清理 interaction / triggerQueue / reaction session

### Requirement: 企鹅派系完成状态必须有对象级 evidence

系统 MUST 为企鹅派系生成 evidence，记录每张卡和基地的 L0/L1/L2/L3/L4 状态、测试命令、截图路径、残余范围和旧审计回写。

#### Scenario: 不能用结构接入冒充玩法完成
- **WHEN** 企鹅只完成 atlas、静态数据、locale 或 faction selection 展示
- **THEN** evidence MUST 将状态限制为结构接入或 intake 完成
- **AND** 不得宣称企鹅派系玩法已完成

#### Scenario: 玩法完成必须包含真实入口证据
- **WHEN** 对外宣称企鹅派系当前发布口径已收口
- **THEN** evidence MUST 至少包含一条真实入口 E2E、截图路径和 finalState/interaction/triggerQueue 收口说明
- **AND** 每个未覆盖对象 MUST 具有明确的 shared-chain 判等依据或残余范围声明
