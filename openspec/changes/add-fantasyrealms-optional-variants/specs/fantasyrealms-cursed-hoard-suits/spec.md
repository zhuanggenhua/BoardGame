## ADDED Requirements
### Requirement: 幻想国度 SHALL 支持 Cursed Hoard 新花色扩展
系统 MUST 支持 `Cursed Hoard` 的 `ch_suits` 扩展，仅包含 `building / outsider / undead` 新花色与其替换牌，不包含诅咒物品。

#### Scenario: 启用新花色扩展后切换牌组
- **GIVEN** 对局 setup 启用了新花色扩展
- **WHEN** 幻想国度 setup 生成运行时牌组
- **THEN** 系统 MUST 使用 `CH01`~`CH23` 组成的扩展牌组
- **AND** `Bell Tower / Fountain of Life / Great Flood / Rangers / Necromancer / World Tree / Shapeshifter / Mirage` MUST 使用扩展替换版本

### Requirement: 新花色扩展 SHALL 切换手牌上限与终局阈值
系统 MUST 按是否启用新花色扩展，切换基础版与双人变体的手牌上限和结束阈值。

#### Scenario: 基础版多人启用新花色扩展
- **GIVEN** 对局为 3~6 人基础版，且启用了新花色扩展
- **WHEN** 系统计算回合手牌上限与结束阈值
- **THEN** 默认手牌上限 MUST 为 `8`
- **AND** 弃牌堆结束阈值 MUST 为 `12`

#### Scenario: 双人变体启用新花色扩展
- **GIVEN** 对局为双人变体，且启用了新花色扩展
- **WHEN** 系统判定“是否已进入双人常规抽 1 弃 1”与“是否满足终局”
- **THEN** 双方满手判定 MUST 以 `8` 手牌为准
- **AND** 双人终局阈值 MUST 以 `弃牌堆至少 14 张` 为准

### Requirement: 新花色扩展 SHALL 使用官方计分语义
系统 MUST 让幻想国度计分引擎覆盖 `CH01`~`CH23` 与扩展替换牌的官方计分、封印、免疫与额外条件。

#### Scenario: 扩展牌参与官方计分
- **GIVEN** 玩家手牌或弃牌堆中出现 `building / outsider / undead` 扩展卡
- **WHEN** 系统结算幻想国度总分
- **THEN** 系统 MUST 按扩展官方语义计算这些牌的加分、减分、封印与替换效果
- **AND** 不得继续沿用基础版旧牌的旧计分语义
