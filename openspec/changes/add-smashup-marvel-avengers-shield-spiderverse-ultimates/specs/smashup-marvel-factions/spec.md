## ADDED Requirements

### Requirement: Smash Up SHALL expose the first four Marvel factions as complete 20-card decks

系统 SHALL 将复仇者、神盾局、蜘蛛宇宙和终极战队注册为四个独立可选派系，每个派系必须生成恰好 20 张实体牌。

#### Scenario: Build the Avengers deck

- **WHEN** 系统创建复仇者牌组
- **THEN** 牌组 MUST 使用 atlas 索引 `0-17` 的 18 个唯一卡面
- **AND** `Avengers Assemble` 与 `Strategize` MUST 各生成 2 张
- **AND** 其余复仇者卡牌 MUST 各生成 1 张
- **AND** 最终牌组 MUST 恰好包含 20 张牌

#### Scenario: Build the S.H.I.E.L.D. deck

- **WHEN** 系统创建神盾局牌组
- **THEN** 牌组 MUST 使用 atlas 索引 `18-29`
- **AND** `S.H.I.E.L.D. Agent / Agent Coulson / Maria Hill / Nick Fury` MUST 分别生成 `4 / 3 / 2 / 1` 张
- **AND** `Mission Debriefing` 与 `Proving Ground` MUST 各生成 2 张
- **AND** 最终牌组 MUST 恰好包含 20 张牌

#### Scenario: Build the Spider-Verse deck

- **WHEN** 系统创建蜘蛛宇宙牌组
- **THEN** 牌组 MUST 使用 atlas 索引 `30-41`
- **AND** `Spider-Man 2099 / Miles Morales / Ghost-Spider / Spider-Man` MUST 分别生成 `4 / 3 / 2 / 1` 张
- **AND** `The View From Above` 与 `With Great Power...` MUST 各生成 2 张
- **AND** 最终牌组 MUST 恰好包含 20 张牌

#### Scenario: Build the Ultimates deck

- **WHEN** 系统创建终极战队牌组
- **THEN** 牌组 MUST 使用 atlas 索引 `42-53`
- **AND** `Blue Marvel / America Chavez / Spectrum / Captain Marvel` MUST 分别生成 `4 / 3 / 2 / 1` 张
- **AND** `First to Arrive` 与 `Power and Speed` MUST 各生成 2 张
- **AND** 最终牌组 MUST 恰好包含 20 张牌

### Requirement: Marvel card behavior SHALL follow the locked per-card image contract

系统 MUST 先把每张漫威卡的中文牌面拆成原子规则子句，再实现对应的能力入口、目标校验、事件、交互、持续状态和清理。

#### Scenario: Implement a card with multiple clauses

- **WHEN** 一张卡包含主效果、条件分支、持续效果、额外打出或后续清理
- **THEN** 每个子句 MUST 在 intake 合同和技能流程矩阵中拥有独立结论
- **AND** 测试 MUST 验证最终权威状态，而不是只验证 prompt 出现或 handler 被注册

#### Scenario: Preserve optional behavior

- **WHEN** 牌面使用“可以、至多、任意数量”或等价可选语义
- **THEN** 真实交互 MUST 允许合法跳过或空选
- **AND** 自动化测试 MUST 同时覆盖执行与跳过后不改变权威状态

#### Scenario: Reject unreadable rule guesses

- **WHEN** 单卡裁图无法锁定名称、数字、目标、时机或限定词
- **THEN** 该字段或子句 MUST 标记为 `blocked/partial`
- **AND** 系统 MUST NOT 用相似卡牌、TTS 名称或旧派系规则猜测实现

### Requirement: Marvel faction implementation SHALL close one faction at a time

系统 SHALL 按复仇者、神盾局、蜘蛛宇宙、终极战队的顺序完成单派系闭环。

#### Scenario: Advance to the next Marvel faction

- **WHEN** 当前派系的静态数据与能力实现已经完成
- **THEN** 当前派系 MUST 先完成 L2 行为测试、真实入口 L3/L4 E2E 和 evidence
- **AND** 若仍有未冻结的对象级缺口，系统 MUST NOT 将该派系标记为完成或进入批量收口

### Requirement: Marvel-specific bases SHALL remain outside this card-only intake

系统 MUST NOT 从当前卡牌 atlas 推断或生成漫威专属基地。

#### Scenario: Start a match with a Marvel faction before Marvel bases are added

- **WHEN** 玩家选择本 change 新增的任一漫威派系
- **THEN** 游戏 SHALL 使用现有公共基地池正常创建对局
- **AND** 系统 MUST NOT 伪造漫威基地名称、断点、VP 或能力
