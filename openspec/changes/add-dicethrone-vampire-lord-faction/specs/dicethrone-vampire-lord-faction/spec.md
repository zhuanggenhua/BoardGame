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
- **AND** 仍有明确非发布级残余范围
- **WHEN** 玩家进入 DiceThrone 选角界面
- **THEN** 玩家可见可选角色列表包含吸血鬼领主
- **AND THEN** 吸血鬼领主显示 implementation-in-progress 徽标
- **AND THEN** 直接玩家选角命令可以选择 `vampire_lord`
- **AND THEN** 共享 AI 自动选角动作不会选择 `vampire_lord`

#### Scenario: 完成态吸血鬼领主进入玩家和 AI 候选

- **GIVEN** 吸血鬼领主静态接入、资源链、机制实现、审计 evidence、交互截图组和真实入口 E2E 均通过当前范围验收
- **WHEN** 玩家进入 DiceThrone 选角界面
- **THEN** 玩家可见可选角色列表包含吸血鬼领主
- **AND THEN** 吸血鬼领主不显示 implementation-in-progress 徽标
- **AND THEN** 直接玩家选角命令可以选择 `vampire_lord`
- **AND THEN** 共享 AI 自动选角动作可以选择 `vampire_lord`

#### Scenario: 吸血鬼领主初始化

- **GIVEN** 内部测试入口或状态注入入口选择 `vampire_lord`
- **WHEN** 对局从设置阶段初始化英雄
- **THEN** 玩家使用吸血鬼领主骰面、九个角色板技能和吸血鬼领主牌库
- **AND THEN** 吸血鬼领主的状态 / Token 定义使用正式图集合同

#### Scenario: 嗜血之爪按等级和相同数字结算

- **GIVEN** 内部测试入口构造了吸血鬼领主进攻骰，并通过玩家板 `fist` 槽选择嗜血之爪
- **WHEN** 进攻骰满足 3/4/5 个利爪的技能分支
- **THEN** I 级分别造成 3/5/7 点攻击伤害，II 级分别造成 3/5/7 点攻击伤害，III 级分别造成 4/6/8 点攻击伤害
- **AND THEN** I 级投出至少 4 个相同数字时获得 1 个鲜血之力
- **AND THEN** II/III 级投出至少 3 个相同数字时获得 1 个鲜血之力
- **AND THEN** 相同数字奖励读取本次攻击骰快照，不得被防御阶段当前骰覆盖
- **AND THEN** 攻击结算后对手生命、攻击者鲜血之力和攻击上下文清理写入最终权威状态

### Requirement: 鲜血之力主动能力入口与完整成本语义

系统 SHALL 将鲜血之力四档主动能力放入统一被动能力操作栏，并完整录入提示卡写明的使用门槛、实际成本、效果、时机和每回合限制。四档分别要求并消耗 1/2/3/4 个鲜血之力；拥有较高数量时累计解锁较低档位；使用后必须按扣除后的剩余数量重新判断其它档位。

#### Scenario: 四档能力按档位成本执行并分别限制一次

- **GIVEN** 吸血鬼领主持有对应数量的鲜血之力，并处于某一档能力的合法使用时机
- **WHEN** 玩家从统一被动能力操作栏执行该档能力
- **THEN** I 档要求至少 1 个并消耗 1 个鲜血之力，为当前攻击增加 3 点伤害
- **AND THEN** II 档要求至少 2 个并消耗 2 个鲜血之力，进入状态选择移除 1 个状态效果
- **AND THEN** III 档要求至少 3 个并消耗 3 个鲜血之力，抽 2 张牌
- **AND THEN** IV 档要求至少 4 个并消耗 4 个鲜血之力，治疗等同于本次成功攻击造成的伤害
- **AND THEN** 每个档位独立地每回合只能激活一次
- **AND THEN** 使用某档后，剩余鲜血之力决定其它档位是否仍可用

#### Scenario: 高档位累计解锁并在消耗后重新判断

- **GIVEN** 吸血鬼领主持有 4 个鲜血之力
- **WHEN** 玩家查看鲜血之力主动能力
- **THEN** 第 1、2、3、4 档均可用（同时满足各自使用门槛）
- **WHEN** 玩家使用第 4 档
- **THEN** 鲜血之力从 4 个减少为 0 个
- **AND THEN** 第 1、2、3、4 档均因剩余资源不足而不可用

#### Scenario: 第二档没有可移除状态时仍保留可发现入口

- **GIVEN** 吸血鬼领主处于主要阶段但场上没有可移除状态效果
- **WHEN** 玩家查看统一被动能力操作栏
- **THEN** 第二档按钮仍可见且处于禁用状态
- **AND THEN** 玩家不能通过该禁用按钮提交状态选择命令
- **AND THEN** 当场上出现可移除状态效果后，该按钮变为可用并打开状态选择

### Requirement: 吸血鬼领主素材与上传

系统 SHALL 使用 `vampire_lord -> xixuegui` 目录映射加载正式压缩资源，并通过带 `--asset-prefix` 的资源上传流程发布吸血鬼领主运行时媒体。

#### Scenario: 资源链闭合

- **WHEN** 执行吸血鬼领主资源发布
- **THEN** 本地 manifest 包含 `xixuegui` 的正式压缩媒体条目
- **AND THEN** 公开资源 URL 对 `player-board.webp`、`tip.webp`、`ability-cards.webp`、`dice.webp` 和 `status-icons-atlas.webp` 返回成功

### Requirement: 吸血鬼领主隐藏到完成态生命周期

系统 SHALL 区分静态接入、隐藏状态、实施中展示和完整完成态；未完成实施和当前范围审计前，吸血鬼领主不得进入玩家可见的实施中展示阶段。

#### Scenario: 未完成实施和审计前保持隐藏

- **WHEN** 静态接入测试通过但当前范围仍有未审计或未冻结缺口
- **THEN** 角色完整目录保留 `vampire_lord`
- **AND THEN** 玩家可见状态仍为 `hidden`
- **AND THEN** 规则文档列出尚未冻结的机制、交互或审计缺口

#### Scenario: 当前范围审计通过后进入实施中

- **WHEN** 静态接入、资源链、机制实现、审计 evidence 和真实入口 E2E 均通过当前范围验收
- **AND** 仍有明确非发布级残余范围
- **THEN** 角色完整目录保留 `vampire_lord`
- **AND THEN** 玩家可见状态为 `in_progress`
- **AND THEN** 规则文档列出仍不宣称完整完成态的非阻塞扩展范围

#### Scenario: 当前范围完成后进入完成态

- **WHEN** 静态接入、资源链、机制实现、审计 evidence、交互截图组和真实入口 E2E 均通过当前范围验收
- **AND** 规则文档没有未冻结 blocker
- **AND** 真人明确确认吸血鬼领主可以进入完成态
- **THEN** 角色完整目录保留 `vampire_lord`
- **AND THEN** 玩家可见状态为完成态
- **AND THEN** 吸血鬼领主不再带 `setupOptionStatus: in_progress`
- **AND THEN** 规则文档只保留不阻塞完成态的扩展说明
