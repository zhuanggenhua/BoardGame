## ADDED Requirements

### Requirement: FantasyRealms 必须以正式真相源合同维护基础卡表
系统 SHALL 为幻想国度基础卡表维护可追溯的真相源合同，而不是只保留一份实现代码数组。

#### Scenario: 团队审计幻想国度基础卡表来源
- **WHEN** 团队核对 `fantasyrealms` 的基础卡表来源
- **THEN** 系统 MUST 记录主真相源文件、对照源文件、覆盖范围和字段映射
- **AND** 系统 MUST 明确当前覆盖的是 53 张基础卡
- **AND** 系统 MUST 明确尚未完成的字段边界与后续能力边界

### Requirement: FantasyRealms runtime 牌库必须覆盖全部 53 张官方基础卡
系统 SHALL 让当前双人变体 runtime 与 foundation 样例数据共同建立在同一份官方基础卡表之上。

#### Scenario: 创建幻想国度运行时牌库
- **WHEN** 系统创建 `fantasyrealms` 的运行时牌库
- **THEN** 运行时牌库 MUST 包含 53 张官方基础卡
- **AND** foundation 用于样例卡位的静态切片 MUST 来自同一份官方卡表
- **AND** 系统 MUST 不再维护与官方卡表脱节的临时演示牌库

### Requirement: FantasyRealms 官方基础卡的花色映射与标识必须确定且可验证
系统 SHALL 为幻想国度官方基础卡提供确定性的 `id` 与花色映射规则。

#### Scenario: 校验官方卡表映射
- **WHEN** 团队校验幻想国度基础卡表
- **THEN** 每张卡 MUST 具备唯一 `id`
- **AND** 英文花色 MUST 映射到固定中文花色
- **AND** 53 张卡的花色分布 MUST 与真相源一致

### Requirement: FantasyRealms 当前缺失的中文逐卡文案不得靠猜测补齐
系统 SHALL 在缺少正式逐卡中文真相源时保留英文原文，并把缺口显式记录下来。

#### Scenario: 当前仓库没有逐卡中文真相源
- **WHEN** 团队为幻想国度基础卡表补合同和代码
- **THEN** 系统 MUST 可以继续保留英文 `name` 与 `text`
- **AND** 系统 MUST 在合同文档中显式记录“逐卡中文卡名 / 中文效果文本未完成”
- **AND** 系统 MUST 不得把自行翻译内容表述成正式已确认数据

### Requirement: FantasyRealms card catalog 验证必须锁住克隆边界
系统 SHALL 保证运行时牌库不会直接暴露静态卡表对象引用。

#### Scenario: 调用运行时牌库工厂
- **WHEN** 系统调用 `createRuntimeDeck()`
- **THEN** 返回结果 MUST 与静态官方卡表在内容上等价
- **AND** 返回结果中的对象 MUST 是新的克隆对象
- **AND** 对运行时牌库对象的修改 MUST 不得反向污染静态官方卡表
