## ADDED Requirements

### Requirement: FantasyRealms 必须实现单一官方计分求值入口
系统 SHALL 为幻想国度提供单一官方计分求值入口，而不是继续用“基础分预估”代替正式分数。

#### Scenario: 领域层需要计算玩家当前手牌分数
- **WHEN** 领域层为 `fantasyrealms` 玩家刷新分数摘要
- **THEN** 系统 MUST 按官方计分规则返回正式总分
- **AND** 系统 MUST 输出可供 UI 展示的分项摘要

### Requirement: FantasyRealms 计分求值必须覆盖野牌、易经与解罚顺序
系统 SHALL 在求值时正确处理 `Shapeshifter / Mirage / Doppelganger`、`Book of Changes` 与所有 `Clears` 的顺序依赖。

#### Scenario: 求值包含野牌和易经
- **WHEN** 玩家手牌中同时存在野牌、`Book of Changes` 或解罚牌
- **THEN** 系统 MUST 先确定野牌变身
- **AND** 系统 MUST 再确定 `Book of Changes` 的改花色
- **AND** 系统 MUST 在封印与减分前先应用解罚结果

### Requirement: FantasyRealms 计分求值必须覆盖封印与连锁封印
系统 SHALL 处理官方卡表中的封印语义与连锁封印结果。

#### Scenario: Blizzard 与 Great Flood 等互相影响
- **WHEN** 同一手牌中存在会互相封印或连锁封印的牌
- **THEN** 系统 MUST 求出与官方 FAQ 一致的最终 active 牌集
- **AND** 被封印的牌 MUST 不计基础分、加分和减分

### Requirement: FantasyRealms 死灵法师必须在终局引入第 8 张牌求值
系统 SHALL 在正式计分时处理 `Necromancer` 的终局取牌能力。

#### Scenario: 终局手牌含死灵法师
- **WHEN** 玩家手牌含 `Necromancer` 且弃牌堆中存在可选的军队、领袖、法师或巨兽
- **THEN** 系统 MUST 把最佳候选作为第 8 张牌一并纳入计分求值

### Requirement: FantasyRealms 双人结束态必须返回正式胜者裁定
系统 SHALL 在双人结束条件命中时返回正式胜者、平局和分数。

#### Scenario: 双人结束态裁定胜者
- **WHEN** 双方都满 7 张手牌且弃牌堆达到 12 张
- **THEN** 系统 MUST 使用官方计分结果比较双方分数
- **AND** 若总分相同，系统 MUST 继续用总基础分更低者获胜
- **AND** 若仍完全相同，系统 MUST 返回平局
