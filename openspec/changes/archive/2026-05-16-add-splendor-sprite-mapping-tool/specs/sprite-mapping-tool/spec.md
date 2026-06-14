## ADDED Requirements

### Requirement: Splendor 雪碧图映射校对页
系统 SHALL 在现有开发工具页中提供 `splendor` 雪碧图映射校对模式，用于同时查看雪碧图格子和对应的卡牌/贵族数据模型。

#### Scenario: 打开 Splendor 映射模式
- **WHEN** 开发者进入 `assetslicer` 并切换到 `splendor` 映射模式
- **THEN** 页面 MUST 显示可选图集类型（一级、二级、三级、贵族）
- **AND** 页面 MUST 同时显示当前图集的格子视图与对应模型列表

### Requirement: 页面内映射配置与校验
系统 SHALL 支持在页面内为雪碧图格子分配模型 ID，并实时发现映射问题。

#### Scenario: 分配卡牌模型到格子
- **WHEN** 开发者在映射页中为某个格子选择 `cardId` 或 `nobleId`
- **THEN** 页面 MUST 立即反映该映射关系

#### Scenario: 检测重复或缺失映射
- **WHEN** 当前图集存在重复映射、未映射格子或缺失模型
- **THEN** 页面 MUST 明确标记这些问题

### Requirement: 映射配置导出
系统 SHALL 支持导出当前映射配置，以便回填到仓库中的真实配置文件。

#### Scenario: 导出当前映射结果
- **WHEN** 开发者在完成映射校对后触发导出
- **THEN** 系统 MUST 生成结构化导出结果
- **AND** 导出结果 MUST 能直接对应运行时映射配置的数据结构

### Requirement: Splendor 运行时映射单一来源
系统 SHALL 让 `splendor` 的运行时雪碧图索引从单一映射配置读取，而不是依赖多个分散的手写顺序定义。

#### Scenario: 运行时读取映射配置
- **WHEN** `splendor` 渲染发展卡或贵族雪碧图
- **THEN** 运行时代码 MUST 从独立映射配置读取 frame 与模型对应关系
- **AND** `sprites.ts` MUST 不再作为人工维护真值的唯一入口
