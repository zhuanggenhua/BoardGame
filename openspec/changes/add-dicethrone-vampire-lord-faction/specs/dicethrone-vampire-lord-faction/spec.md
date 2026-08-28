## ADDED Requirements

### Requirement: 吸血鬼领主角色目录与初始化

系统 SHALL 将 `vampire_lord`（吸血鬼领主 / Vampire Lord）加入 DiceThrone 可选角色目录，并按吸血鬼领主静态录入合同初始化骰子、技能、牌库、Token、状态和角色板资源；在完整机制收口前 SHALL 标记为实施中。

#### Scenario: 选角列表展示实施中吸血鬼领主

- **WHEN** 玩家进入 DiceThrone 选角界面
- **THEN** 可选角色列表包含吸血鬼领主
- **AND THEN** 吸血鬼领主显示现有 implementation-in-progress 徽标
- **AND THEN** 选中吸血鬼领主时展示吸血鬼领主玩家板、提示卡和资源预加载路径

#### Scenario: 吸血鬼领主初始化

- **GIVEN** 玩家选择 `vampire_lord`
- **WHEN** 对局从设置阶段初始化英雄
- **THEN** 玩家使用吸血鬼领主骰面、九个角色板技能和吸血鬼领主牌库
- **AND THEN** 吸血鬼领主的状态 / Token 定义使用正式图集合同

### Requirement: 吸血鬼领主素材与上传

系统 SHALL 使用 `vampire_lord -> xixuegui` 目录映射加载正式压缩资源，并通过带 `--asset-prefix` 的资源上传流程发布吸血鬼领主运行时媒体。

#### Scenario: 资源链闭合

- **WHEN** 执行吸血鬼领主资源发布
- **THEN** 本地 manifest 包含 `xixuegui` 的正式压缩媒体条目
- **AND THEN** 公开资源 URL 对 `player-board.webp`、`tip.webp`、`ability-cards.webp`、`dice.webp` 和 `status-icons-atlas.webp` 返回成功

### Requirement: 吸血鬼领主复杂机制实施中

系统 SHALL 区分静态接入与完整机制实现；未逐字核准的鲜血之力、催眠 / 凝视、复合升级下区和特殊消费机制不得被标记为完成。

#### Scenario: 复杂机制尚未完整核准

- **WHEN** 静态接入测试通过
- **THEN** 角色目录仍保留实施中状态
- **AND THEN** 规则文档列出血力、催眠、复合升级卡和逐卡机制缺口
