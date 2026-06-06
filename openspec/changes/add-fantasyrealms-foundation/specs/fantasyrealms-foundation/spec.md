## ADDED Requirements

### Requirement: FantasyRealms 新游戏 foundation 必须进入正式 proposal 管理
系统 SHALL 在 `fantasyrealms` 进入具体设计、布局方案和任务拆分阶段时，使用正式的 OpenSpec proposal / design / tasks / spec 管理当前 change。

#### Scenario: 从通用新游戏 workflow 进入具体方案阶段
- **WHEN** `fantasyrealms` 的工作已经不只是通用新游戏 intake，而是进入桌面布局、玩家关注点排序和实施拆分
- **THEN** 系统 MUST 为 `fantasyrealms` 建立正式的 OpenSpec change
- **AND** 该 change MUST 包含 proposal、tasks 和 spec
- **AND** 若存在跨模块设计取舍或阶段边界，change MUST 提供 design

### Requirement: FantasyRealms Board 首屏必须以牌桌对象为主
系统 SHALL 让 `fantasyrealms` Board 的首屏主视口优先展示牌桌对象，而不是展示游戏标题、连接态或高权重状态条。

#### Scenario: 常规对局态首次进入 Board
- **WHEN** 玩家进入 `fantasyrealms` 的常规对局态 Board
- **THEN** 首屏 MUST 先看到当前正式公共桌面对象与手牌区
- **AND** Board MUST 不显示高权重的大标题 `幻想国度`
- **AND** Board MUST 不重复显示 `已连接` 等壳层状态

### Requirement: FantasyRealms foundation UI 必须跟随当前正式玩法的公共区语义
系统 SHALL 让 `fantasyrealms` 的 foundation UI 跟随当前已落地玩法的正式公共区对象，而不是继续沿用旧静态稿中的固定 7 张公共牌语义。

#### Scenario: 当前正式玩法使用公开弃牌堆作为公共区
- **WHEN** 玩家在桌面端查看 `fantasyrealms` Board
- **THEN** Board MUST 把公开弃牌堆作为当前正式公共区对象展示
- **AND** 系统 MUST 不再回退为旧静态稿中的固定 7 张公共牌展示

### Requirement: FantasyRealms foundation UI 必须保持 7 张手牌可读
系统 SHALL 在当前玩法以 7 张手牌为核心时，保持玩家手牌区 7 张完整可读。

#### Scenario: 桌面端常规对局态
- **WHEN** 玩家在桌面端查看 `fantasyrealms` Board
- **THEN** 手牌区 MUST 同时展示 7 个独立卡位
- **AND** 系统 MUST 不把手牌区折叠、分页、扇形化或只露出部分卡面

#### Scenario: 窄视口常规对局态
- **WHEN** 玩家在窄视口查看 `fantasyrealms` Board
- **THEN** 系统 MAY 使用横向滚动或压缩承载方式
- **BUT** 手牌区 MUST 仍保持 7 张完整可访问的卡位

### Requirement: FantasyRealms 的摘要与终局信息必须保持次级
系统 SHALL 把 `fantasyrealms` 的分数摘要、当前焦点卡和终局进度保持为次级信息，不得在常规对局态用大面积中央计分纸抢占主区域。

#### Scenario: 常规对局态存在分数与焦点信息
- **WHEN** `fantasyrealms` Board 需要显示分数摘要、焦点卡或终局进度
- **THEN** 这些信息 MUST 位于牌桌的侧边或次级信息位
- **AND** 系统 MUST 不在中央主区域显示大面积常驻计分纸或终局总结板

### Requirement: FantasyRealms foundation 必须维持单一实体牌桌方向并留存证据
系统 SHALL 让 `fantasyrealms` 的设计文档、Board 原型和 evidence 共同服务于单一“奇幻实体牌桌”方向，而不是并行保留多套互相冲突的风格稿。

#### Scenario: 交付 foundation 设计文档与证据
- **WHEN** 团队交付 `fantasyrealms` 的 foundation 文档、Board 原型或截图证据
- **THEN** 文档与证据 MUST 明确说明实体牌桌方向、禁止项和当前边界
- **AND** 系统 MUST 不把多套冲突风格稿同时作为当前有效方向

### Requirement: FantasyRealms foundation 完成判定必须基于真实页面端到端验收
系统 SHALL 只在 `fantasyrealms` 的真实页面主路径已经端到端通过，且没有仍阻塞完成口径的已知 UI bug 时，才把 foundation UI 判为完成。

#### Scenario: 真实页面仍存在阻塞级 UI bug
- **WHEN** 团队已经完成代码与测试，但真实页面主路径中仍存在已知阻塞级 UI bug
- **THEN** 系统 MUST 不把 `add-fantasyrealms-foundation` 表述为已完成
- **AND** 这些问题 MUST 继续留在当前任务范围内，不能直接降级成“已完成后的可选 polish”

#### Scenario: 真实页面只剩非阻塞 polish
- **WHEN** 真实页面主路径已经通过，而剩余项仅为不影响主路径验收的后续 polish
- **THEN** 系统 MAY 把这些剩余项降级为 follow-up
- **AND** 系统 MUST 不再用这些非阻塞 polish 反向否定 foundation 的完成状态

### Requirement: FantasyRealms foundation 必须与后续 gameplay/runtime change 保持职责分离
系统 SHALL 让 `add-fantasyrealms-foundation` 只负责视觉与布局基础层，不再用旧的 runtime 禁用边界覆盖后续 gameplay / scoring / runtime-entry change 的完成状态。

#### Scenario: 后续 gameplay 与 runtime-entry change 已经落地
- **WHEN** `fantasyrealms` 的 gameplay、scoring 或 runtime-entry change 已经落地
- **THEN** foundation 文档与验收 MUST 聚焦于 UI 基础层
- **AND** 系统 MUST 不继续用早期的 `manifest.enabled: false` 边界描述当前总状态
