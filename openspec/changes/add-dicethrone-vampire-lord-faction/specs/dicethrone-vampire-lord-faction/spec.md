## ADDED Requirements

### Requirement: 吸血鬼领主角色目录与初始化

系统 SHALL 将 `vampire_lord`（吸血鬼领主 / Vampire Lord）加入 DiceThrone 内部角色目录，并按吸血鬼领主静态录入合同初始化骰子、技能、牌库、Token、状态和角色板资源；在实施完毕且当前范围审计通过前 SHALL 标记为 `hidden` 并对玩家隐藏。

#### Scenario: 玩家选角列表隐藏吸血鬼领主

- **GIVEN** 吸血鬼领主当前范围尚未实施完毕或尚未审计通过
- **WHEN** 玩家进入 DiceThrone 选角界面
- **THEN** 玩家可见可选角色列表不包含吸血鬼领主
- **AND THEN** 吸血鬼领主不显示 implementation-in-progress 徽标
- **AND THEN** 直接玩家选角命令不能选择 `vampire_lord`
- **AND THEN** AI 自动选角动作不会包含 `vampire_lord`

#### Scenario: 审计通过后玩家可见实施中吸血鬼领主

- **GIVEN** 吸血鬼领主当前范围实施完毕且审计通过
- **WHEN** 玩家进入 DiceThrone 选角界面
- **THEN** 玩家可见可选角色列表包含吸血鬼领主
- **AND THEN** 吸血鬼领主显示 implementation-in-progress 徽标
- **AND THEN** 直接玩家选角命令可以选择 `vampire_lord`
- **AND THEN** 共享 AI 自动选角动作不会选择 `vampire_lord`

#### Scenario: 吸血鬼领主初始化

- **GIVEN** 内部测试入口或状态注入入口选择 `vampire_lord`
- **WHEN** 对局从设置阶段初始化英雄
- **THEN** 玩家使用吸血鬼领主骰面、九个角色板技能和吸血鬼领主牌库
- **AND THEN** 吸血鬼领主的状态 / Token 定义使用正式图集合同

### Requirement: 吸血鬼领主素材与上传

系统 SHALL 使用 `vampire_lord -> xixuegui` 目录映射加载正式压缩资源，并通过带 `--asset-prefix` 的资源上传流程发布吸血鬼领主运行时媒体。

#### Scenario: 资源链闭合

- **WHEN** 执行吸血鬼领主资源发布
- **THEN** 本地 manifest 包含 `xixuegui` 的正式压缩媒体条目
- **AND THEN** 公开资源 URL 对 `player-board.webp`、`tip.webp`、`ability-cards.webp`、`dice.webp` 和 `status-icons-atlas.webp` 返回成功

### Requirement: 吸血鬼领主隐藏到实施中生命周期

系统 SHALL 区分静态接入、隐藏状态、实施中展示和完整完成态；未完成实施和当前范围审计前，吸血鬼领主不得进入玩家可见的实施中展示阶段。

#### Scenario: 未完成实施和审计前保持隐藏

- **WHEN** 静态接入测试通过但当前范围仍有未审计或未冻结缺口
- **THEN** 角色完整目录保留 `vampire_lord`
- **AND THEN** 玩家可见状态仍为 `hidden`
- **AND THEN** 规则文档列出血力、催眠、复合升级卡和逐卡机制缺口

#### Scenario: 当前范围审计通过后进入实施中

- **WHEN** 静态接入、资源链、机制实现、审计 evidence 和真实入口 E2E 均通过当前范围验收
- **THEN** 角色完整目录保留 `vampire_lord`
- **AND THEN** 玩家可见状态为 `in_progress`
- **AND THEN** 规则文档列出仍不宣称完整完成态的非阻塞扩展范围
